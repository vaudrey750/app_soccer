from typing import List, Dict, Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.domain.models.reference import Game, Competition, Club
from src.domain.models import core
from src.services.processors.base import BaseProcessor
import logging

logger = logging.getLogger(__name__)

class GameProcessor(BaseProcessor):
    
    async def process_games(self, 
                          games: List[Game], 
                          season_name: str,
                          comp_map_db: Dict[str, str], # real_comp_id -> uuid
                          comp_team_map: Dict[str, str], # real_comp_id -> our_team_uuid
                          global_teams_map: Dict[str, str], # name -> team_uuid
                          club_db: Optional[Club],
                          game_status_map: Dict[str, int]) -> None:
        
        # Ensure 'GAME' event type ID is found/cached. 
        # RefProcessor ensures it exists, here we need the ID.
        game_event_type_id = await self._get_game_event_type_id()

        for game in games:
            # 1. Link Context
            await self._link_competition(game, comp_map_db)
            game.season = season_name
            if club_db and club_db.tenant_id:
                game.tenant_id = club_db.tenant_id
            
            # 2. Link Teams
            self._link_teams(game, club_db, comp_team_map, global_teams_map)
            
            # 3. Determine Status
            self._set_status(game, game_status_map)
            
            # 4. Upsert (Broad update based on data_hash)
            if not game.data_hash:
                continue

            stmt = select(Game).where(Game.data_hash == game.data_hash)
            res = await self.session.execute(stmt)
            existing_games = res.scalars().all()
            
            saved_game = None
            found_tenant_match = False

            if not existing_games:
                # No games found globally for this hash
                self.session.add(game)
                await self.session.flush()
                saved_game = game
            else:
                # Strategy:
                # 1. Identify "Our" game (Exact match OR Claimable orphan)
                # 2. Update common fields on ALL copies
                # 3. Update tenant fields only on "Our" game
                
                target_game = None
                
                # Search for exact match first
                for ex in existing_games:
                    if ex.tenant_id == game.tenant_id:
                        target_game = ex
                        break
                
                # If no exact match, look for an orphan to claim
                if not target_game and game.tenant_id:
                    for ex in existing_games:
                        if ex.tenant_id is None:
                            target_game = ex
                            target_game.tenant_id = game.tenant_id # Claim it
                            break

                # Update Loop
                for ex in existing_games:
                    self._update_common_fields(ex, game)
                    
                    if ex == target_game:
                        self._update_tenant_fields(ex, game)
                        saved_game = ex
                    
                    self.session.add(ex)
                
                await self.session.flush()

                # If we still have no game for our tenant, create it
                if not saved_game:
                    self.session.add(game)
                    await self.session.flush()
                    saved_game = game
            
            # 5. Sync Event (only for our tenant)
            if saved_game and saved_game.tenant_id and game_event_type_id:
                 await self._sync_event(saved_game, game_event_type_id)

    def _update_common_fields(self, existing: Game, new: Game):
        """Updates shared factual data about the match"""
        existing.status = new.status
        existing.score_home = new.score_home
        existing.score_away = new.score_away
        existing.home_is_forfeit = new.home_is_forfeit
        existing.away_is_forfeit = new.away_is_forfeit
        existing.home_penalty_score = new.home_penalty_score
        existing.away_penalty_score = new.away_penalty_score
        
        existing.date_match = new.date_match
        existing.date_time = new.date_time
        existing.seems_postponed = new.seems_postponed
        
        existing.stadium = new.stadium
        existing.address = new.address
        existing.zip_code = new.zip_code
        existing.city = new.city
        
        existing.journee = new.journee
        existing.phase_number = new.phase_number
        existing.phase_name = new.phase_name
        existing.poule_stage_number = new.poule_stage_number
        existing.poule_name = new.poule_name

        if new.competition_id: existing.competition_id = new.competition_id
        if new.home_club_id: existing.home_club_id = new.home_club_id
        if new.away_club_id: existing.away_club_id = new.away_club_id

    def _update_tenant_fields(self, existing: Game, new: Game):
        """Updates fields that are specific to the tenant context"""
        if new.home_team_id: existing.home_team_id = new.home_team_id
        if new.away_team_id: existing.away_team_id = new.away_team_id
        if new.home_team_name: existing.home_team_name = new.home_team_name
        if new.away_team_name: existing.away_team_name = new.away_team_name

    async def _link_competition(self, game: Game, comp_map: Dict[str, str]):
        if not game.data_hash: 
            # In parser game.data_hash stores ma_no
            return

        # Attempt to find comp info from game.data_hash if we had a map of ma_no -> cp_no
        # BUT the parser/processor structure here receives objects which don't carry that external map easily 
        # unless passed.
        # The parser output for Game actually doesn't have `real_competition_id` field?
        # Checking GameParser... it only put `ma_no` in `data_hash`.
        # The original code used `match_comp_map = {ma_no: cp_no}` built from raw JSON.
        # We need that map here.
        pass # Will depend on `game.competition_id` being set BEFORE calling process, or handled here.
        # Actually, let's assume the Workflow sets `game.competition_id` if it can, 
        # OR we pass the map.
        
    def _link_teams(self, game: Game, club: Optional[Club], comp_team_map: Dict, global_map: Dict):
        # Basic name matching using Global Map (for opponents or if not set previously)
        
        # 1. Home Team
        if not game.home_team_id and game.home_team_name:
            h = game.home_team_name.strip().upper()
            if h in global_map:
                game.home_team_id = global_map[h]

        # 2. Away Team
        if not game.away_team_id and game.away_team_name:
            a = game.away_team_name.strip().upper()
            if a in global_map:
                game.away_team_id = global_map[a]

    def _set_status(self, game: Game, status_map: Dict):
        sid = status_map.get("SCHEDULED")
        if game.home_is_forfeit or game.away_is_forfeit:
            sid = status_map.get("FORFEITED")
        elif game.score_home is not None or game.score_away is not None:
            sid = status_map.get("PLAYED")
        game.status = sid

    async def _sync_event(self, game: Game, type_id: int):
        if not game.date_match: return
        
        dt_start = datetime.combine(game.date_match, datetime.min.time())
        if game.date_time:
            try:
                t_str = game.date_time.replace("H", ":")
                t_part = datetime.strptime(t_str, "%H:%M").time()
                dt_start = datetime.combine(game.date_match, t_part)
            except: pass
        dt_end = dt_start + timedelta(hours=2)
        
        locs = []
        if game.stadium: locs.append(game.stadium)
        if game.city: locs.append(game.city)
        loc_str = " - ".join(locs) if locs else None
        
        stmt = select(core.Events).where(core.Events.game_id == game.id)
        res = await self.session.execute(stmt)
        ev = res.scalars().first()
        
        title = f"{game.home_team_name} vs {game.away_team_name}"
        
        if not ev:
            ev = core.Events(
                tenant_id=game.tenant_id,
                type=type_id,
                title=title,
                start_date=dt_start,
                end_date=dt_end,
                location=loc_str,
                game_id=game.id,
                description=f"Match {game.season}"
            )
            self.session.add(ev)
        else:
            ev.title = title
            ev.start_date = dt_start
            ev.end_date = dt_end
            ev.location = loc_str
            # Critical: Ensure tenant_id is synced if it was missing previously
            if game.tenant_id:
                ev.tenant_id = game.tenant_id
            self.session.add(ev)

    async def _get_game_event_type_id(self):
        stmt = select(core.EventType.id).where(core.EventType.name == "GAME")
        res = await self.session.execute(stmt)
        return res.scalars().first() or 1
