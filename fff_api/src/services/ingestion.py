import asyncio
import logging
import random
from abc import ABC, abstractmethod
from typing import List, Optional

from src.domain.schemas.import_config import ImportConfig
from src.infrastructure.clients.fff.client import FFFClient
from src.infrastructure.storage.minio import MinioStorageService
from src.infrastructure.database.session import init_db

# Configure logging
logger = logging.getLogger(__name__)

# Constants
MAX_RETRIES = 3
MAX_CONCURRENT_REQUESTS = 5

# --- Interfaces (ISP/DIP) ---

class ClubFetcher(ABC):
    """Interface for fetching club data."""
    @abstractmethod
    async def fetch(self, config: ImportConfig) -> None:
        pass

class IntegrityVerifier(ABC):
    """Interface for verifying data integrity after fetch."""
    @abstractmethod
    async def verify(self, club_id: int) -> None:
        pass

# --- Implementations (SRP) ---

class FFFClubFetcher(ClubFetcher):
    """
    Responsible for interacting with the FFF Client to retrieve club data.
    """
    def __init__(self, client: FFFClient, minio: MinioStorageService):
        self.client = client
        self.minio = minio

    async def fetch(self, config: ImportConfig) -> None:
        # Check if data already exists for today (Idempotency)
        # Note: Depending on requirements, we might want to force update.
        # Current logic: If club_info exists, we assume we already scraped it today.
        
        # If we want to strictly follow the previous logic "skip if exists":
        if self.minio.exists_raw_json("clubs", str(config.club_id), "club_info"):
            logger.info(f"Data already exists for {config.label}. Skipping fetch.")
            return

        logger.info(f"Fetching data for {config.label}")
        await self.client.get_club_info(config.club_id)
        await self.client.get_club_matches(config.club_id)
        await self.client.get_club_teams(config.club_id)
        await self.client.get_club_calendar(config.club_id)


class MinioIntegrityVerifier(IntegrityVerifier):
    """
    Responsible for verifying that files are correctly written to MinIO.
    Includes polling logic to handle eventual consistency or network latency.
    """
    def __init__(self, minio: MinioStorageService, required_files: List[str] = None):
        self.minio = minio
        self.required_files = required_files or ["club_info", "matches", "teams", "calendar"]

    async def verify(self, club_id: int) -> None:
        date_str = self.minio.run_date.strftime("%Y-%m-%d")
        loop = asyncio.get_running_loop()
        missing_files = []

        for file_type in self.required_files:
            file_path = f"raw/clubs/{date_str}/{club_id}/{file_type}.json"
            file_found = False
            
            # Polling mechanism: Wait up to 10 seconds (20 * 0.5)
            for _ in range(20): 
                try:
                    # Execute synchronous MinIO stat_object in a separate thread
                    stat = await loop.run_in_executor(
                        None, 
                        lambda: self.minio.client.stat_object(self.minio.bucket_name, file_path)
                    )
                    if stat.size > 0:
                        file_found = True
                        break
                except Exception:
                    # Object not found or error accessing it
                    pass
                
                await asyncio.sleep(0.5)
                
            if not file_found:
                missing_files.append(file_type)

        if missing_files:
            raise Exception(f"Integrity Check Failed: Missing or empty files for club {club_id}: {', '.join(missing_files)}")


class IngestionWorkflow:
    """
    Orchestrates the ingestion process for a single club.
    Handles retry logic and coordinates Fetcher and Verifier.
    """
    def __init__(self, fetcher: ClubFetcher, verifier: IntegrityVerifier, max_retries: int = MAX_RETRIES):
        self.fetcher = fetcher
        self.verifier = verifier
        self.max_retries = max_retries

    async def process(self, config: ImportConfig, semaphore: asyncio.Semaphore) -> Optional[ImportConfig]:
        async with semaphore:
            for attempt in range(self.max_retries):
                try:
                    logger.debug(f"Process {config.label}: Attempt {attempt + 1}")
                    
                    await self.fetcher.fetch(config)
                    await self.verifier.verify(config.club_id)
                    
                    return config  # Success
                    
                except Exception as e:
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    if attempt < self.max_retries - 1:
                        logger.warning(f"Error processing {config.label}: {e}. Retrying in {wait_time:.2f}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Failed to process {config.label} after {self.max_retries} attempts: {e}")
                        
            return None # Failed after retries


# --- Main Entry Point (Facade) ---

async def save_club_data_to_minio(configs: List[ImportConfig] = None) -> List[ImportConfig]:
    """
    Main entry point for batch processing of club data ingestion.
    """
    print("--- Starting Batch Import ---")
    
    # dependencies initialization
    await init_db()
    minio_service = MinioStorageService()
    
    # target configs
    target_configs = configs if configs is not None else []
    logger.info(f"Processing {len(target_configs)} configurations")
    
    # Shared Semaphore
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    # Results container
    successful_configs = []

    async with FFFClient() as fff_client:
        # Dependency Injection
        # We can implement a Factory Pattern here if instantiation becomes complex
        fetcher = FFFClubFetcher(fff_client, minio_service)
        verifier = MinioIntegrityVerifier(minio_service)
        workflow = IngestionWorkflow(fetcher, verifier)

        tasks = [
            workflow.process(config, semaphore)
            for config in target_configs
        ]
        
        results = await asyncio.gather(*tasks)
        successful_configs = [res for res in results if res is not None]

    logger.info(f"Successfully processed {len(successful_configs)}/{len(target_configs)} clubs.")
    return successful_configs
