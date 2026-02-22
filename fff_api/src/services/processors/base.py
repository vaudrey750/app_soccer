from typing import Generic, TypeVar, Optional, List, Dict
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.domain.models.reference import Season, Federation
from src.domain.models import core
import logging

T = TypeVar("T")

logger = logging.getLogger(__name__)

class BaseProcessor:
    def __init__(self, session: AsyncSession):
        self.session = session

class ReferenceProcessor(BaseProcessor):
    """
    Handles initialization of global reference data:
    - Federation (FFF)
    - Current Season
    - Game Statuses
    - Event Types
    """
    
    async def ensure_defaults(self) -> Dict[str, int]:
        """
        Ensures reference data exists and returns a map of {status_name: status_id}.
        """
        # 1. Federation
        await self._ensure_federation()
        
        # 2. Season
        await self._ensure_season(self.get_current_season_name())
        
        # 3. Game Statuses
        status_map = await self._ensure_game_statuses()
        
        # 4. Event Type "GAME"
        await self._ensure_event_type_game()
        
        return status_map

    async def _ensure_federation(self):
        stmt = select(Federation).where(Federation.name == "Fédération Française de Football")
        res = await self.session.execute(stmt)
        if not res.scalars().first():
            fed = Federation(name="Fédération Française de Football", short_name="FFF", country_code="FR")
            self.session.add(fed)
            await self.session.commit()
            
    async def _ensure_season(self, name: str):
        stmt = select(Season).where(Season.name == name)
        res = await self.session.execute(stmt)
        if not res.scalars().first():
            season = Season(name=name, is_active=True)
            self.session.add(season)
            await self.session.commit()

    async def _ensure_game_statuses(self) -> Dict[str, int]:
        status_names = ["SCHEDULED", "PLAYED", "FORFEITED"]
        status_map = {}
        for s_name in status_names:
            stmt = select(core.GameStatus).where(core.GameStatus.name == s_name)
            res = await self.session.execute(stmt)
            obj = res.scalars().first()
            if not obj:
                obj = core.GameStatus(name=s_name)
                self.session.add(obj)
                await self.session.commit()
                await self.session.refresh(obj)
            status_map[s_name] = obj.id
        return status_map

    async def _ensure_event_type_game(self):
        # Check if "GAME" already exists
        stmt = select(core.EventType).where(core.EventType.name == "GAME")
        res = await self.session.execute(stmt)
        if res.scalars().first():
            return

        # Check if ID 1 exists (usually "MATCH" from seeding)
        stmt = select(core.EventType).where(core.EventType.id == 1)
        res = await self.session.execute(stmt)
        existing = res.scalars().first()

        if existing:
            # Rename "MATCH" (or whatever is at ID 1) to "GAME" to match expectations
            logger.info(f"Updating EventType ID 1 from '{existing.name}' to 'GAME' to match code requirements.")
            existing.name = "GAME"
            self.session.add(existing)
            await self.session.commit()
            return

        # If "GAME" missing and ID 1 missing, try to insert at ID 1
        et = core.EventType(id=1, name="GAME")
        self.session.add(et)
        try:
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            # If ID 1 insert failed (race condition?), try standard insert
            # But first sync sequence to avoid collision with ID 2, 3...
            try:
                # Sync sequence just in case
                await self.session.execute(
                    "SELECT setval('core.event_type_id_seq', (SELECT MAX(id) FROM core.event_type));"
                )
            except Exception as e:
                logger.warning(f"Could not sync sequence: {e}")

            et = core.EventType(name="GAME")
            self.session.add(et)
            await self.session.commit()

    async def get_fff_federation_id(self) -> int:
         stmt = select(Federation.id).where(Federation.short_name == "FFF")
         res = await self.session.execute(stmt)
         return res.scalars().first()

    @staticmethod
    def get_current_season_name() -> str:
        """
        Determines the current season name (Start Year) based on date.
        Season is assumed to start in September (Month 9).
        """
        now = datetime.now()
        year = now.year
        if now.month < 9:
            year -= 1
        return str(year)
