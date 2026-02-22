import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, desc
from src.domain.models.saas import User
from src.domain.models.core import Member
from src.domain.models.reference import Game, Competition

class GetCompetitionsWithGamesUseCase:
    """
    Use case to retrieve all competitions with their associated games 
    for a specific tenant (club), optionally filtered by season.
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, user: User, tenant_id: Optional[uuid.UUID] = None, season: Optional[str] = None) -> List[Dict[str, Any]]:
        # 1. Resolve Tenant
        target_tenant_id = tenant_id
        
        # Check user membership
        stmt = select(Member).where(Member.user_id == user.id)
        if tenant_id:
            stmt = stmt.where(Member.tenant_id == tenant_id)
            
        result = await self.session.execute(stmt)
        member = result.scalars().first()
        
        if tenant_id:
            if not member:
                # User provided a tenant_id but is not a member of it
                 return None # Or raise specific error, but returning None allows controller to decide 403/404
        else:
            if not member:
                # User didn't provide tenant_id, and we found no membership
                return None
            target_tenant_id = member.tenant_id

        # 2. Fetch all competitions
        comps_result = await self.session.execute(select(Competition))
        competitions = comps_result.scalars().all()
        
        # 3. Fetch all games for the target tenant
        games_query = select(Game).where(Game.tenant_id == target_tenant_id)
        if season:
            games_query = games_query.where(Game.season == season)
        
        games_query = games_query.order_by(desc(Game.date_match))
        
        games_result = await self.session.execute(games_query)
        all_games = games_result.scalars().all()
        
        # 4. Group games by competition
        games_by_comp = {}
        for game in all_games:
            if game.competition_id not in games_by_comp:
                games_by_comp[game.competition_id] = []
            games_by_comp[game.competition_id].append(game)
        
        # 5. Build response
        results = []
        for comp in competitions:
            comp_games = games_by_comp.get(comp.id, [])
            if comp_games:
                results.append({
                    "competition": comp,
                    "games": comp_games
                })
                
        return results
