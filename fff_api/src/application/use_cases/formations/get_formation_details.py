from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from src.domain.models.sport import Formation, FormationPosition

class GetFormationDetailsUseCase:
    """
    Use case to retrieve details of a specific formation including its positions.
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, formation_id: int) -> Optional[Dict[str, Any]]:
        # 1. Get Formation
        formation = await self.session.get(Formation, formation_id)
        if not formation:
            return None
        
        # 2. Get Positions
        stmt_pos = select(FormationPosition).where(FormationPosition.formation_id == formation_id).order_by(FormationPosition.priority)
        result_pos = await self.session.execute(stmt_pos)
        positions = result_pos.scalars().all()
        
        return {
            "formation": formation,
            "positions": positions
        }
