from abc import ABC, abstractmethod
from src.domain.models.job import ImportJob

class JobRepository(ABC):
    @abstractmethod
    async def add(self, job: ImportJob) -> ImportJob:
        pass

    @abstractmethod
    async def get(self, job_id: int) -> ImportJob | None:
        pass
