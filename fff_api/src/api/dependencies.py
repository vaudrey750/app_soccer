from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.infrastructure.database.session import get_session
from src.infrastructure.repositories.job_repository import SqlAlchemyJobRepository
from src.domain.ports.job_repository import JobRepository
from src.application.use_cases.trigger_import import TriggerImportUseCase

async def get_job_repository(session: AsyncSession = Depends(get_session)) -> JobRepository:
    return SqlAlchemyJobRepository(session)

async def get_trigger_import_use_case(
    repo: JobRepository = Depends(get_job_repository)
) -> TriggerImportUseCase:
    return TriggerImportUseCase(repo)
