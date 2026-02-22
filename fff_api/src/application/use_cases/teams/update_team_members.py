import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.domain.models.reference import Team
from src.domain.models.core import Member, TeamMember
from src.domain.models.saas import User

class UpdateTeamMembersUseCase:
    """
    Updates the list of members (Players & Staff) for a team.
    Performs a full sync: members not in the input list are removed from the team.
    """
    def __init__(self, session: AsyncSession):
        self.session = session
        
    async def execute(self, user: User, team_id: uuid.UUID, member_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        member_updates: List of dicts with {"member_id": UUID, "role": str, "position_id": UUID|None}
        """
        # 1. Fetch Team
        team = await self.session.get(Team, team_id)
        if not team:
            return {"status": "error", "code": 404, "message": "Team not found"}
            
        # 2. Auth Check
        stmt = select(Member).where(Member.user_id == user.id)
        result = await self.session.execute(stmt)
        current_member = result.scalars().first()
        
        if not current_member or current_member.tenant_id != team.tenant_id:
             return {"status": "error", "code": 403, "message": "Not authorized for this team"}
             
        # 3. Get existing members
        stmt_existing = select(TeamMember).where(TeamMember.team_id == team_id)
        existing_res = await self.session.execute(stmt_existing)
        existing_members = existing_res.scalars().all()
        existing_map = {em.member_id: em for em in existing_members}
        
        # 4. Process Updates
        incoming_member_ids = set()
        
        for item in member_updates:
            m_id = item["member_id"]
            incoming_member_ids.add(m_id)
            
            if m_id in existing_map:
                # Update role or position if changed
                existing_rec = existing_map[m_id]
                updated = False
                if existing_rec.role != item["role"]:
                    existing_rec.role = item["role"]
                    updated = True
                if existing_rec.position_id != item.get("position_id"):
                    existing_rec.position_id = item.get("position_id")
                    updated = True
                
                if updated:
                    self.session.add(existing_rec)
            else:
                # Create new
                new_tm = TeamMember(
                    team_id=team_id,
                    member_id=m_id,
                    role=item["role"],
                    position_id=item.get("position_id")
                )
                self.session.add(new_tm)

        # 5. Remove missing
        for em in existing_members:
            if em.member_id not in incoming_member_ids:
                await self.session.delete(em)
                
        await self.session.commit()
        
        return {"status": "success", "message": "Team members updated"}
