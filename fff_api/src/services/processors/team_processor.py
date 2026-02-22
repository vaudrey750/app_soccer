from typing import List, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from src.domain.models.reference import Team
from src.services.processors.base import BaseProcessor
import logging

logger = logging.getLogger(__name__)

class TeamProcessor(BaseProcessor):
    
    async def process_teams(self, 
                          teams: List[Team], 
                          club_tenant_id: Optional[str],
                          club_id: Optional[str],
                          season_name: str) -> Dict[str, str]:
        """
        Process teams, linking them to tenant if applicable.
        Returns a map: real_competition_id -> team_uuid (based on engagements)
        """
        comp_team_map = {}
        
        for team in teams:
            team.club_id = club_id
            saved_team = await self._upsert_team(team, club_tenant_id, season_name)
            
            # Map engagements
            if hasattr(team, '_engagements') and team._engagements:
                for eng in team._engagements:
                     if 'competition' in eng and 'cp_no' in eng['competition']:
                        cp_no_eng = str(eng['competition']['cp_no'])
                        comp_team_map[cp_no_eng] = saved_team.id
        
        return comp_team_map
    
    async def _upsert_team(self, team: Team, t_id: Optional[str], season_name: str) -> Team:
        existing_team = None
        
        # 1. Try strict match by Number
        if team.number:
            existing_team = await self._find_by_number(team, t_id, season_name)
        
        # 2. Fallback: Name + Code + Category
        if not existing_team:
            existing_team = await self._find_by_attributes(team, t_id, season_name)

        if not existing_team:
            team.tenant_id = t_id
            team.season = season_name
            self.session.add(team)
            await self.session.flush()
            return team
        else:
            if not existing_team.tenant_id and t_id:
                existing_team.tenant_id = t_id
                self.session.add(existing_team)
                await self.session.flush()

        return existing_team

    async def _find_by_number(self, team: Team, t_id: Optional[str], season: str) -> Optional[Team]:
        criteria = [
            Team.season == season,
            Team.number == team.number,
            Team.code == team.code, # Code usually redundant if number is unique, but safe
            Team.club_id == team.club_id
        ]
        
        # Strict Tenant
        c_strict = list(criteria)
        c_strict.append(Team.tenant_id == t_id if t_id else Team.tenant_id.is_(None))
        res = await self.session.execute(select(Team).where(*c_strict))
        found = res.scalars().first()
        
        if not found and t_id:
             # Try Orphan
             c_orphan = list(criteria)
             c_orphan.append(Team.tenant_id.is_(None))
             res_o = await self.session.execute(select(Team).where(*c_orphan))
             found = res_o.scalars().first()
             
        return found

    async def _find_by_attributes(self, team: Team, t_id: Optional[str], season: str) -> Optional[Team]:
        criteria = [Team.season == season]
        if team.name: criteria.append(Team.name == team.name)
        if team.code: criteria.append(Team.code == team.code)
        if team.category: criteria.append(Team.category == team.category)
        
        # Strict
        c_strict = list(criteria)
        c_strict.append(Team.tenant_id == t_id if t_id else Team.tenant_id.is_(None))
        res = await self.session.execute(select(Team).where(*c_strict))
        found = res.scalars().first()
        
        if not found and t_id:
             # Orphan
             c_orphan = list(criteria)
             c_orphan.append(Team.tenant_id.is_(None))
             res_o = await self.session.execute(select(Team).where(*c_orphan))
             found = res_o.scalars().first()
             
        return found
    
    async def preload_global_map(self, season: str) -> Dict[str, str]:
        """
        Returns Name -> UUID map for all teams in season.
        Used for opponent linking.
        """
        try:
            stmt = select(Team.id, Team.name).where(Team.season == season)
            res = await self.session.execute(stmt)
            return {name.strip().upper(): tid for tid, name in res.all() if name}
        except Exception as e:
            logger.error(f"Failed to preload teams map: {e}")
            return {}
