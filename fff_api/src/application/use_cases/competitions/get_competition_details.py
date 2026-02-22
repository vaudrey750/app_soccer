import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc
from src.domain.models.reference import Game, Competition

class GetCompetitionDetailsUseCase:
    """
    Use case to retrieve details of a specific competition including its games,
    optionally filtered by season.
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, competition_id: uuid.UUID, season: Optional[str] = None) -> Optional[Dict[str, Any]]:
        # 1. Get Competition metadata
        comp = await self.session.get(Competition, competition_id)
        if not comp:
            return None

        # 2. Determine Season and Filter
        query = select(Game).where(Game.competition_id == competition_id)
        
        if season:
            query = query.where(Game.season == season)
        
        # Order by date descending
        query = query.order_by(desc(Game.date_match))
        
        result = await self.session.execute(query)
        games = result.scalars().all()
        
        return {
            "competition": comp,
            "games": games
        }
