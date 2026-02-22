from typing import List
from src.domain.models.job import ImportJob, JobStatus, JobType
from src.domain.schemas.import_config import ImportConfig
from src.domain.ports.job_repository import JobRepository

class TriggerImportUseCase:
    def __init__(self, job_repository: JobRepository):
        self._job_repository = job_repository

    async def execute(self, configs: List[ImportConfig]) -> ImportJob:
        if not configs:
            raise ValueError("Config list cannot be empty")

        # Business Logic: Create Job Entity
        # Note: We convert Pydantic models to dicts for the JSON field
        job = ImportJob(
            configs=[c.model_dump() for c in configs],
            status=JobStatus.PENDING,
            type=JobType.IMPORT
        )

        return await self._job_repository.add(job)
