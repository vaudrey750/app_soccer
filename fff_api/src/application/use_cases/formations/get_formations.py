from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload
from src.domain.models.sport import Formation

class GetFormationsUseCase:
    """
    Use case to retrieve all available formations with their positions preloaded.
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self) -> List[Formation]:
        stmt = select(Formation).options(selectinload(Formation.positions)).order_by(Formation.id)
        result = await self.session.execute(stmt)
        return result.scalars().all()
