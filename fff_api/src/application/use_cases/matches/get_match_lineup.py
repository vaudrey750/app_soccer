import uuid
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.domain.models.core import Events, Member, MemberRole
from src.domain.models.sport import MatchLineup, Formation, FormationPosition

class GetMatchLineupUseCase:
    """
    Retrieves the lineup for a specific match event.
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, event_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        # Check if event exists
        event = await self.session.get(Events, event_id)
        if not event:
            return None 

        # Check visibility logic
        stmt_member = select(Member).where(Member.user_id == user_id)
        result_member = await self.session.execute(stmt_member)
        member = result_member.scalars().first()

        is_privileged = False
        if member and member.role_in_app:
             role = await self.session.get(MemberRole, member.role_in_app)
             if role and role.name in ['COACH', 'ADMIN']:
                 is_privileged = True
        
        # Default policy: Players don't see lineup if not published
        if not is_privileged and not event.lineup_published:
             return {
                "event_id": event_id,
                "formation": None,
                "items": [],
                "lineup_published": event.lineup_published
            }

        # Get Lineup entries
        stmt = select(MatchLineup).where(MatchLineup.event_id == event_id)
        result = await self.session.execute(stmt)
        lineup_entries = result.scalars().all()
        
        if not lineup_entries:
            return {
                "event_id": event_id, 
                "formation": None, 
                "items": [], 
                "lineup_published": event.lineup_published
            }
            
        # Assume all entries have same formation_id
        formation_id = lineup_entries[0].formation_id
        formation = await self.session.get(Formation, formation_id)
        
        items = []
        for entry in lineup_entries:
            pos = await self.session.get(FormationPosition, entry.position_id)
            member = await self.session.get(Member, entry.member_id)
            
            items.append({
                "id": entry.id,
                "position_id": entry.position_id,
                "member_id": entry.member_id,
                "position": pos, # Helper helper for conversion later
                "member_name": f"{member.first_name} {member.last_name}" if member else "Inconnu"
            })
            
        return {
            "event_id": event_id,
            "formation": formation,
            "items": items,
            "lineup_published": event.lineup_published
        }
