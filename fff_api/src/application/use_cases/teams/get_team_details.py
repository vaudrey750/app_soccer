import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.domain.models.reference import Team
from src.domain.models.core import Member, TeamMember, PlayerPosition
from src.domain.models.saas import User
from src.domain.constants.team_categories import get_readable_category

class GetTeamDetailsUseCase:
    """
    Use case to retrieve detailed information about a team, 
    including its members categorized as players and staff.
    """
    def __init__(self, session: AsyncSession):
        self.session = session
        
    async def execute(self, user: User, team_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        # 1. Fetch Team
        team = await self.session.get(Team, team_id)
        if not team:
            return None # Or raise NotFound

        # 2. Security Check: User must be a member of the tenant owning the team
        stmt = select(Member).where(Member.user_id == user.id)
        result = await self.session.execute(stmt)
        current_member = result.scalars().first()
        
        if not current_member or current_member.tenant_id != team.tenant_id:
             return {"error": "Semantically this is Forbidden/NotFound depending on policy, but we return a marker to controller"}

        # 3. Fetch Members (Staff & Players)
        # Join TeamMember -> Member -> PlayerPosition
        stmt_members = select(TeamMember, Member, PlayerPosition).join(
            Member, TeamMember.member_id == Member.id
        ).outerjoin(
            PlayerPosition, TeamMember.position_id == PlayerPosition.id
        ).where(
            TeamMember.team_id == team_id
        )
        res = await self.session.execute(stmt_members)
        rows = res.all()
        
        staff = []
        players = []
        
        for tm, m, p in rows:
            member_dto = {
                "id": str(m.id),
                "name": f"{m.first_name} {m.last_name}",
                "first_name": m.first_name,
                "last_name": m.last_name,
                "email": m.email,
                "role": tm.role, # COACH, PLAYER, ASSISTANT...
                "image": m.photo_url or f"https://ui-avatars.com/api/?name={m.first_name}+{m.last_name}&background=random",
                "position_id": str(p.id) if p else None,
                "position_name": p.name if p else None
            }
            
            # Categorize
            if tm.role and tm.role.upper() in ["COACH", "ASSISTANT", "STAFF", "ADJOINT"]:
                staff.append(member_dto)
            else:
                # Assume everything else is player for now
                players.append(member_dto)
                
        return {
            "id": str(team.id),
            "name": team.name, 
            "category": team.category,
            "category_label": get_readable_category(team.category),
            "code": team.code,
            "gender": team.gender,
            "staff": staff,
            "players": players,
            "stats": {
                "total_players": len(players),
                "total_staff": len(staff)
            }
        }
