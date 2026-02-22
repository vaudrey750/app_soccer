from typing import Optional, Dict, List, Any
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy.orm import selectinload

from src.domain.models.reference import Game
from src.domain.models.core import GameTimeline, Member, GameActionType

class GetGameDetailsUseCase:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, game_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        # 1. Fetch Game
        game_stmt = select(Game).where(Game.id == game_id)
        game_res = await self.session.execute(game_stmt)
        game = game_res.scalars().first()
        
        if not game:
            return None
            
        # 2. Fetch Timeline
        # We need to join with Member names to be useful for the Frontend
        # But for now, let's fetch raw timeline and maybe enrich it manually or via join
        
        timeline_stmt = (
            select(GameTimeline, GameActionType)
            .join(GameActionType, GameTimeline.action_type_id == GameActionType.id, isouter=True)
            .where(GameTimeline.game_id == game_id)
            .order_by(GameTimeline.minute)
        )
        timeline_res = await self.session.execute(timeline_stmt)
        timeline_rows = timeline_res.all() # List of (GameTimeline, GameActionType)
        
        # 3. Fetch all referenced members to map names (Bulk fetch for performance)
        member_ids = set()
        for row in timeline_rows:
            gt = row[0]
            if gt.main_home_player_id: member_ids.add(gt.main_home_player_id)
            if gt.main_away_player_id: member_ids.add(gt.main_away_player_id)
            if gt.assisting_home_player_id: member_ids.add(gt.assisting_home_player_id)
            if gt.assisting_away_player_id: member_ids.add(gt.assisting_away_player_id)
            
        members_map = {}
        if member_ids:
            mem_stmt = select(Member).where(Member.id.in_(list(member_ids)))
            mem_res = await self.session.execute(mem_stmt)
            for m in mem_res.scalars().all():
                members_map[m.id] = f"{m.first_name} {m.last_name}"

        # 4. Construct Response
        timeline_list = []
        for row in timeline_rows:
            gt = row[0]
            action_name = row[1].name if row[1] else "Unknown"
            
            # Map action to frontend types if needed, or send raw
            # Frontend expects: type: 'goal' | 'yellow_card' | 'red_card' | 'substitution'
            # Backend IDs: 1=Goal, 2=Yellow, 3=Red, 5=Sub (Check seed_types.py or existing DB)
            # For now we send raw and let frontend or validation schema handle it? 
            # Better to normalize here.
            
            fe_type = "unknown"
            if gt.action_type_id == 1: fe_type = "goal"
            elif gt.action_type_id == 2: fe_type = "yellow_card"
            elif gt.action_type_id == 3: fe_type = "red_card"
            elif gt.action_type_id == 5: fe_type = "substitution"
            
            timeline_list.append({
                "id": gt.id,
                "minute": gt.minute,
                "type": fe_type,
                "team": "home" if (gt.main_home_player_id or gt.assisting_home_player_id) else "away",
                "player": {
                    "id": gt.main_home_player_id or gt.main_away_player_id,
                    "name": members_map.get(gt.main_home_player_id or gt.main_away_player_id, "Inconnu")
                },
                "assist": {
                    "id": gt.assisting_home_player_id or gt.assisting_away_player_id,
                    "name": members_map.get(gt.assisting_home_player_id or gt.assisting_away_player_id)
                } if (gt.assisting_home_player_id or gt.assisting_away_player_id) else None,
                "extra": gt.extra_data
            })
            
        return {
            "game": game,
            "timeline": timeline_list
        }
