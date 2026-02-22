import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.domain.models.core import Events, Member
from src.domain.models.sport import MatchLineup, Formation, FormationPosition

class UpdateMatchLineupUseCase:
    """
    Updates the lineup for a match event by replacing all entries.
    """
    def __init__(self, session: AsyncSession):
        self.session = session
        
    async def execute(self, event_id: uuid.UUID, formation_id: int, items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
         # Check Event
        event = await self.session.get(Events, event_id)
        if not event:
            return None # Or raise

        # Clear existing lineup
        stmt_del = select(MatchLineup).where(MatchLineup.event_id == event_id)
        existing_result = await self.session.execute(stmt_del)
        existing = existing_result.scalars().all()
        
        for e in existing:
            await self.session.delete(e)
            
        # Insert new entries
        new_entries = []
        for item in items:
            entry = MatchLineup(
                tenant_id=event.tenant_id,
                event_id=event_id,
                formation_id=formation_id,
                position_id=item['position_id'],
                member_id=item['member_id']
            )
            self.session.add(entry)
            new_entries.append(entry)
            
        await self.session.commit()
        
        # Prepare Result
        formation = await self.session.get(Formation, formation_id)
        
        items_out = []
        for entry in new_entries:
             pos = await self.session.get(FormationPosition, entry.position_id)
             member = await self.session.get(Member, entry.member_id)
             items_out.append({
                "id": entry.id,
                "position_id": entry.position_id,
                "member_id": entry.member_id,
                "position": pos,
                "member_name": f"{member.first_name} {member.last_name}" if member else "Inconnu"
             })
             
        return {
            "event_id": event_id,
            "formation": formation,
            "items": items_out
        }
