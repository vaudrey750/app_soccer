from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.domain.ports.job_repository import JobRepository
from src.domain.models.job import ImportJob

class SqlAlchemyJobRepository(JobRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(self, job: ImportJob) -> ImportJob:
        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)
        return job

    async def get(self, job_id: int) -> ImportJob | None:
        result = await self.session.exec(select(ImportJob).where(ImportJob.id == job_id))
        return result.first()
