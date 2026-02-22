from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.domain.models.reference import Competition, League
from src.services.processors.base import BaseProcessor

class CompetitionProcessor(BaseProcessor):
    
    async def process_competitions(self, 
                                 competitions: List[Competition], 
                                 raw_comp_list: List[Dict[str, Any]], 
                                 federation_id: int) -> Dict[str, str]:
        """
        Process competitions and link them to Leagues.
        Returns a map: real_competition_id -> db_uuid
        """
        comp_map_db = {}
        
        # Map raw items by cp_no for easy lookup of 'cdg' (League info)
        raw_comp_map = {str(item["cp_no"]): item for item in raw_comp_list if "cp_no" in item}
        
        for comp in competitions:
            if not comp.real_competition_id:
                continue
            
            # 1. Resolve League from Raw Data
            raw_c = raw_comp_map.get(comp.real_competition_id)
            if raw_c and raw_c.get("cdg"):
                league_id = await self._upsert_league(raw_c.get("cdg"), federation_id)
                comp.league_id = league_id

            # 2. Upsert Competition
            existing_comp = await self._find_competition(comp.real_competition_id)
            
            if not existing_comp:
                self.session.add(comp)
                await self.session.flush()
                comp_map_db[comp.real_competition_id] = comp.id
            else:
                existing_comp.name = comp.name
                if comp.league_id:
                    existing_comp.league_id = comp.league_id
                self.session.add(existing_comp)
                await self.session.flush()
                comp_map_db[comp.real_competition_id] = existing_comp.id
                
        return comp_map_db

    async def _upsert_league(self, cdg_data: dict, federation_id: int) -> int:
        cg_no = str(cdg_data.get("cg_no"))
        stmt_l = select(League).where(League.real_league_id == cg_no)
        res_l = await self.session.execute(stmt_l)
        l_obj = res_l.scalars().first()
        
        if not l_obj:
            l_obj = League(
                real_league_id=cg_no, 
                name=cdg_data.get("name"), 
                federation_id=federation_id
            )
            self.session.add(l_obj)
            await self.session.flush()
        return l_obj.id

    async def _find_competition(self, real_id: str) -> Competition:
        stmt = select(Competition).where(Competition.real_competition_id == real_id)
        res = await self.session.execute(stmt)
        return res.scalars().first()
