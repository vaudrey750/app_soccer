import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from src.infrastructure.storage.minio import MinioStorageService
from src.services.parsers.club import ClubParser
from src.services.processors.club_processor import ClubProcessor

logger = logging.getLogger(__name__)

class ProcessClubDataUseCase:
    """
    Orchestrates the transformation of raw Club JSON into structured DB data.
    Uses Parsers and Processors to handle logic.
    """
    def __init__(self, session: AsyncSession, minio: MinioStorageService):
        self.session = session
        self.minio = minio
        self.processor = ClubProcessor(session)

    async def execute(self, club_id: int, date_str: str) -> None:
        file_path = f"raw/clubs/{date_str}/{club_id}/club_info.json"
        
        try:
             raw_data = self.minio.load_raw_json(file_path)
             if not raw_data:
                 raise ValueError("Empty data")
        except Exception as e:
             logger.warning(f"Skipping processing for club {club_id}: {e}")
             return

        # 1. Parse
        parser = ClubParser(raw_data)
        clubs = parser.parse()
        
        if not clubs:
            logger.warning(f"No clubs parsed from data for {club_id}")
            return

        # 2. Process
        # We assume federation_id = 1 (FFF) for now, or we could fetch it.
        # Ideally, we should fetch the Federation object.
        federation_id = 1 
        
        await self.processor.process_clubs(clubs, raw_data, federation_id)
        
        # Commit happens in the processor or here? 
        # Processor flushes, but typically doesn't commit fully if valid for usage in larger transaction.
        # But since this is a unit of work:
        await self.session.commit()
        logger.info(f"Processed club {club_id}")
