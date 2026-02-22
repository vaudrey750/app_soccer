import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from src.domain.models.saas import User
from src.domain.models.core import Member, MemberRole, TeamMember
from src.domain.models.reference import Team

class GetTeamsUseCase:
    """
    Retrieves the list of teams for the current user's tenant.
    Filters based on user role (Admin sees all, others see their own teams).
    Includes roster summary (Coach, Assistants, Player IDs).
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, current_user: User, tenant_id: Optional[uuid.UUID] = None) -> List[Dict[str, Any]]:
        # 1. Resolve tenant and check role
        stmt = select(Member, MemberRole).outerjoin(MemberRole, Member.role_in_app == MemberRole.id).where(
            Member.user_id == current_user.id
        )
        result = await self.session.execute(stmt)
        row = result.first()
        
        if not row:
             # If user has no member record, return empty list or raise error?
             # Endpoint raised 404. Let's raise ValueError to be handled by caller or return empty.
             # User definitely expects to see teams if they are logged in.
             return []
        
        member, role_obj = row
        target_tenant_id = member.tenant_id
        
        # If tenant_id provided, verify access (simple check)
        if tenant_id and tenant_id != target_tenant_id:
            # We enforce the member's tenant
            pass 

        # Determine if Admin
        role_name = role_obj.name if role_obj else "MEMBER"
        is_admin = role_name in ['ADMIN', 'PRESIDENT']

        # 2. Query teams
        query = select(Team).where(
            Team.tenant_id == target_tenant_id
        )

        if not is_admin:
            # Filter: only teams where the user is a member/coach
            query = query.join(TeamMember, Team.id == TeamMember.team_id).where(TeamMember.member_id == member.id)

        query = query.order_by(desc(Team.category), Team.name)
        
        result = await self.session.execute(query)
        teams = result.scalars().all()

        if not teams:
            return []

        # 3. Fetch all assignments for these teams to build roster summary
        team_ids = [t.id for t in teams]
        stmt_members = select(TeamMember).where(TeamMember.team_id.in_(team_ids))
        res_mem = await self.session.execute(stmt_members)
        team_members = res_mem.scalars().all()

        # Map assignments
        tm_map = {}
        for tm in team_members:
            tid = tm.team_id
            if tid not in tm_map:
                tm_map[tid] = []
            tm_map[tid].append(tm)
        
        # 4. Build Response
        response = []
        for team in teams:
            members_for_team = tm_map.get(team.id, [])
            coach_id = None
            assistants = []
            players = []

            for m in members_for_team:
                r = m.role.upper() if m.role else "PLAYER"
                if r == 'COACH':
                    coach_id = str(m.member_id)
                elif r in ['ASSISTANT', 'ADJOINT']:
                    assistants.append(str(m.member_id))
                else:
                    players.append(str(m.member_id))

            response.append({
                "id": str(team.id),
                "name": team.name, 
                "category": team.category or "Non définie",
                "gender": team.gender,
                "code": team.code,
                "number": team.number,
                "coach_id": coach_id,
                "assistant_ids": assistants,
                "player_ids": players
            })
            
        return response
