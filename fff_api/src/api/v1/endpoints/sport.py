from typing import Any, Dict, List, Optional
from datetime import date, datetime, timedelta
import uuid
import json

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlmodel import select, func, desc, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.infrastructure.database.session import get_session
from src.services.websocket_manager import manager
from src.domain.models.saas import User
from src.domain.models.core import (
    Member,
    MemberRole,
    TeamMember,
    PlayerPosition,
    Events,
    MatchChat,
    GameStatus
)
from src.domain.models.reference import Game, Team, Competition
from src.domain.models.sport import Formation, FormationPosition, MatchLineup
from src.api.deps import get_current_active_user
from src.api.v1.schemas.sport import (
    FormationRead, 
    FormationWithPositionsRead, 
    FormationPositionRead,
    MatchLineupRead,
    MatchLineupUpdate,
    MatchLineupItem
)
from src.application.use_cases.dashboard.get_dashboard_summary import GetDashboardSummaryUseCase
from src.application.use_cases.matches.get_match_lineup import GetMatchLineupUseCase
from src.application.use_cases.matches.update_match_lineup import UpdateMatchLineupUseCase
from src.application.use_cases.matches.publish_match_lineup import PublishMatchLineupUseCase

router = APIRouter()

@router.get("/dashboard/summary")
async def get_dashboard_summary(
    tenant_id: Optional[uuid.UUID] = None,
    team_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session)
) -> Dict[str, Any]:
    
    use_case = GetDashboardSummaryUseCase(session)
    return await use_case.execute(current_user, tenant_id, team_id)


@router.get("/teams")
async def get_my_teams(
    tenant_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session)
):
    from src.application.use_cases.teams.get_teams import GetTeamsUseCase
    
    use_case = GetTeamsUseCase(session)
    teams = await use_case.execute(current_user, tenant_id)
    
    if not teams and not tenant_id:
        # Check if user is even a member? The use case handles empty list.
        # But legacy raised 404 if "User is not a member of any club".
        # The use case returns [] if member checks fail or no teams.
        # Let's keep it simple.
        pass
        
    return teams

@router.get("/teams/{team_id}/stats", response_model=Dict[str, Any])
async def get_team_stats(
    team_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    from src.application.use_cases.teams.get_team_stats import GetTeamStatsUseCase
    
    use_case = GetTeamStatsUseCase(session)
    stats = await use_case.execute(team_id)
    
    if stats is None:
        raise HTTPException(status_code=404, detail="Team not found")
        
    return stats



@router.get("/teams/{team_id}")
async def get_team_details(
    team_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    from src.application.use_cases.teams.get_team_details import GetTeamDetailsUseCase
    
    use_case = GetTeamDetailsUseCase(session)
    result = await use_case.execute(current_user, team_id)
    
    if result is None:
        raise HTTPException(status_code=404, detail="Team not found")
        
    if "error" in result:
         # Use case signal for forbidden access
         raise HTTPException(status_code=403, detail="Not authorized for this team")
            
    return result

class TeamMemberUpdate(BaseModel):
    member_id: uuid.UUID
    role: str
    position_id: Optional[uuid.UUID] = None

class TeamMembersUpdatePayload(BaseModel):
    members: List[TeamMemberUpdate]

@router.put("/teams/{team_id}/members")
async def update_team_members(
    team_id: uuid.UUID,
    payload: TeamMembersUpdatePayload,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update the list of members (Players & Staff) for a team.
    This performs a full sync: members not in the list are removed from the team.
    """
    from src.application.use_cases.teams.update_team_members import UpdateTeamMembersUseCase
    
    # Convert Pydantic payload to list of dicts
    updates = [
        {"member_id": m.member_id, "role": m.role, "position_id": m.position_id} 
        for m in payload.members
    ]
    
    use_case = UpdateTeamMembersUseCase(session)
    result = await use_case.execute(current_user, team_id, updates)
    
    if result["status"] == "error":
        raise HTTPException(status_code=result["code"], detail=result["message"])
        
    return result


@router.get("/competition", response_model=List[Competition])
async def get_competitions(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all available competitions.
    """
    result = await session.execute(select(Competition))
    return result.scalars().all()


@router.get("/competition_with_games")
async def get_all_competitions_with_games(
    tenant_id: Optional[uuid.UUID] = None,
    season: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all competitions with their games.
    """
    from src.application.use_cases.competitions.get_competitions_with_games import GetCompetitionsWithGamesUseCase
    
    use_case = GetCompetitionsWithGamesUseCase(session)
    results = await use_case.execute(current_user, tenant_id, season)
    
    if results is None:
         # Map use case returning None to errors, replicating original logic mostly
         if tenant_id:
             raise HTTPException(status_code=403, detail="Not authorized for this club")
         raise HTTPException(status_code=404, detail="User is not a member of any club")
    
    return results


@router.get("/competition_with_games/{competition_id}")
async def get_competition_details(
    competition_id: uuid.UUID,
    season: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get details of a specific competition, including games.
    """
    from src.application.use_cases.competitions.get_competition_details import GetCompetitionDetailsUseCase
    
    use_case = GetCompetitionDetailsUseCase(session)
    result = await use_case.execute(competition_id, season)
    
    if result is None:
        raise HTTPException(status_code=404, detail="Competition not found")
    
    return result


@router.get("/games/{game_id}/details")
async def get_game_details(
    game_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    from src.application.use_cases.games.get_game_details import GetGameDetailsUseCase
    from src.api.v1.schemas.sport import GameDetailsRead
    
    use_case = GetGameDetailsUseCase(session)
    result = await use_case.execute(game_id)
    
    if result is None:
        raise HTTPException(status_code=404, detail="Game not found")
        
    game = result["game"]
    timeline = result["timeline"]
    
    return GameDetailsRead(
        id=game.id,
        score_home=game.score_home,
        score_away=game.score_away,
        status=game.status or 0,
        timeline=timeline
    )


# --- Formations ---

@router.get("/formations", response_model=List[FormationWithPositionsRead])
async def get_formations(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    from src.application.use_cases.formations.get_formations import GetFormationsUseCase
    use_case = GetFormationsUseCase(session)
    return await use_case.execute()

@router.get("/formations/{formation_id}", response_model=FormationWithPositionsRead)
async def get_formation_details(
    formation_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    from src.application.use_cases.formations.get_formation_details import GetFormationDetailsUseCase
    
    use_case = GetFormationDetailsUseCase(session)
    result = await use_case.execute(formation_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Formation not found")
    
    formation = result["formation"]
    positions = result["positions"]
    
    return FormationWithPositionsRead(
        **formation.dict(),
        positions=[FormationPositionRead(**p.dict()) for p in positions]
    )

# --- Match Lineup ---

@router.get("/matches/{event_id}/lineup", response_model=MatchLineupRead)
async def get_match_lineup(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    use_case = GetMatchLineupUseCase(session)
    result = await use_case.execute(event_id, current_user.id)
    
    if result is None:
        raise HTTPException(status_code=404, detail="Match not found")
        
    # Map dict to Pydantic Schema
    items_mapped = []
    for item in result["items"]:
        pos_read = None
        if item["position"]:
             pos_read = FormationPositionRead(**(item["position"].dict() if hasattr(item["position"], "dict") else item["position"].__dict__))
             
        items_mapped.append(MatchLineupItem(
            id=item["id"],
            position_id=item["position_id"],
            member_id=item["member_id"],
            position=pos_read,
            member_name=item["member_name"]
        ))
    
    formation_read = None
    if result["formation"]:
        formation_read = FormationRead(**(result["formation"].dict() if hasattr(result["formation"], "dict") else result["formation"].__dict__))

    return MatchLineupRead(
        event_id=result["event_id"],
        lineup_published=result.get("lineup_published", False),
        formation=formation_read,
        items=items_mapped
    )

@router.post("/matches/{event_id}/lineup/publish", response_model=bool)
async def publish_match_lineup(
    event_id: uuid.UUID,
    publish: bool = Query(True),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    # Verify Permissions
    event = await session.get(Events, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Match not found")

    stmt = select(Member).where(Member.user_id == current_user.id).where(Member.tenant_id == event.tenant_id)
    result = await session.execute(stmt)
    member = result.scalars().first()
    
    if not member:
        raise HTTPException(status_code=403, detail="Not a member")
        
    is_authorized = False
    if member.role_in_app:
        role_obj = await session.get(MemberRole, member.role_in_app)
        if role_obj and role_obj.name in ["COACH", "ADMIN", "ASSISTANT", "PRESIDENT"]:
             is_authorized = True
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Only coaches can publish lineups")

    use_case = PublishMatchLineupUseCase(session)
    return await use_case.execute(event_id, publish)

@router.put("/matches/{event_id}/lineup", response_model=MatchLineupRead)
async def update_match_lineup(
    event_id: uuid.UUID,
    lineup_in: MatchLineupUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    event = await session.get(Events, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Match not found")

    # Verify Permissions
    stmt = select(Member).where(Member.user_id == current_user.id).where(Member.tenant_id == event.tenant_id)
    result = await session.execute(stmt)
    member = result.scalars().first()

    if not member:
        raise HTTPException(status_code=403, detail="Not a member")

    is_authorized = False
    if member.role_in_app:
        role_obj = await session.get(MemberRole, member.role_in_app)
        if role_obj and role_obj.name in ["COACH", "ADMIN", "ASSISTANT", "PRESIDENT"]:
            is_authorized = True

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Only coaches can update lineups")

    use_case = UpdateMatchLineupUseCase(session)
    # Convert payload items to format expected by use case
    items_data = [{"position_id": i.position_id, "member_id": i.member_id} for i in lineup_in.items]
    
    result = await use_case.execute(event_id, lineup_in.formation_id, items_data)
    
    if result is None:
         raise HTTPException(status_code=404, detail="Match not found")
         
    # Map back to Schema
    items_mapped = []
    for item in result["items"]:
        pos_read = None
        if item["position"]:
             pos_read = FormationPositionRead(**(item["position"].dict() if hasattr(item["position"], "dict") else item["position"].__dict__))
             
        items_mapped.append(MatchLineupItem(
            id=item["id"],
            position_id=item["position_id"],
            member_id=item["member_id"],
            position=pos_read,
            member_name=item["member_name"]
        ))
    
    formation_read = None
    if result["formation"]:
        formation_read = FormationRead(**(result["formation"].dict() if hasattr(result["formation"], "dict") else result["formation"].__dict__))

    return MatchLineupRead(
        event_id=result["event_id"],
        formation=formation_read,
        items=items_mapped
    )

# --- Match Chat ---

from src.domain.models.core import MatchChat, Events
from src.api.v1.schemas.sport import ChatMessageCreate, ChatMessageRead

@router.get("/games/{game_id}/chat", response_model=List[ChatMessageRead])
async def get_match_chat(
    game_id: uuid.UUID,
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    stmt = (
        select(MatchChat)
        .where(MatchChat.game_id == game_id)
        .where(MatchChat.is_hidden == False)
        .order_by(MatchChat.created_at.desc()) 
        .limit(limit)
    )
    result = await session.execute(stmt)
    messages = result.scalars().all()
    
    # Reverse to return them in chronological order (oldest -> newest) for the frontend
    messages = list(messages)[::-1]
    
    return [
        ChatMessageRead(
            id=m.id,
            sender_name=m.sender_name,
            message=m.message,
            created_at=m.created_at,
            is_me=(m.user_id == current_user.id)
        ) for m in messages
    ]

@router.websocket("/games/{game_id}/ws")
async def websocket_endpoint(websocket: WebSocket, game_id: uuid.UUID):
    await manager.connect(websocket, str(game_id))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, str(game_id))

from fastapi.responses import StreamingResponse
import asyncio

@router.get("/games/{game_id}/sse")
async def sse_game_stream(game_id: uuid.UUID):
    """
    Flux SSE pour les mises à jour en direct du match.
    Remplace le polling.
    """
    queue = await manager.connect_stream(str(game_id))
    
    async def event_generator():
        try:
            while True:
                # Wait for data
                # Keep-alive heartbeat every 15s to keep connection open in some proxies
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield data
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    
        except asyncio.CancelledError:
             # Disconnect
             manager.disconnect_stream(str(game_id), queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")



class ChatStatusUpdate(BaseModel):
    is_closed: bool

@router.post("/games/{game_id}/chat/status")
async def update_game_chat_status(
    game_id: uuid.UUID,
    status_update: ChatStatusUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    """
    Active ou désactive le chat du match.
    Réservé aux COACH, ADMIN, ASSISTANT.
    """
    # 1. Check Permissions
    is_allowed = False
    
    # Check Member Role
    stmt = select(Member).where(Member.user_id == current_user.id)
    res = await session.execute(stmt)
    member = res.scalars().first()
    
    if member and member.role_in_app:
        role_stmt = select(MemberRole).where(MemberRole.id == member.role_in_app)
        role_res = await session.execute(role_stmt)
        role_obj = role_res.scalars().first()
        if role_obj and role_obj.name in ['COACH', 'ADMIN', 'ASSISTANT']:
            is_allowed = True
    
    if not is_allowed:
        raise HTTPException(status_code=403, detail="Vous n'avez pas les droits pour gérer le chat.")

    # 2. Update Game
    game = await session.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Match introuvable")
    
    game.is_chat_closed = status_update.is_closed
    if status_update.is_closed:
        game.chat_closed_at = datetime.now()
    else:
        game.chat_closed_at = None
        
    session.add(game)
    await session.commit()
    await session.refresh(game)
    
    # 3. Broadcast status change
    await manager.broadcast(str(game_id), json.dumps({
        "type": "system",
        "action": "chat_status_changed",
        "is_closed": game.is_chat_closed,
        "message": "Le chat a été fermé." if game.is_chat_closed else "Le chat est ouvert."
    }))
    
    return {"status": "success", "is_chat_closed": game.is_chat_closed}

@router.get("/games/{game_id}/chat/status")
async def get_game_chat_status(
    game_id: uuid.UUID,
    session: AsyncSession = Depends(get_session)
):
    """Récupère l'état du chat (fermé ou ouvert)."""
    game = await session.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Match introuvable")
    return {"is_closed": game.is_chat_closed, "closed_at": game.chat_closed_at}

@router.post("/games/{game_id}/chat", response_model=ChatMessageRead)
async def post_match_chat(
    game_id: uuid.UUID,
    data: ChatMessageCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    # Resolve sender identity
    stmt = select(Member).where(Member.user_id == current_user.id)
    res = await session.execute(stmt)
    member = res.scalars().first()
    
    sender_name = "Anonyme"
    member_id = None
    tenant_id = None
    
    if member:
        sender_name = f"{member.first_name} {member.last_name}"
        member_id = member.id
        tenant_id = member.tenant_id
    else:
        # Fallback (e.g. SuperAdmin or weird state)
        sender_name = current_user.email.split('@')[0] if current_user.email else "User"
        # We need a tenant_id. Fetch from Game if possible?
        # Chat is stored per tenant? No, per Game.
        # But Table has tenant_id FK.
        # Fetch game to check tenant
        g = await session.get(Game, game_id)
        if g: tenant_id = g.tenant_id
        
    if not tenant_id:
         # Last resort
         tenant_id = uuid.UUID('00000000-0000-0000-0000-000000000000') # Placeholder to avoid crash if no tenant logic

    # --- CHECK CHAT STATUS ---
    game = await session.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Match introuvable")

    # 1. Check if manually closed
    if game.is_chat_closed:
        raise HTTPException(status_code=403, detail="Le chat est fermé.")

    # 2. Check Auto-Close (1h post-match)
    # Get Event details for end_date
    stmt_evt = select(Events).where(Events.game_id == game_id)
    res_evt = await session.execute(stmt_evt)
    event_obj = res_evt.scalars().first()

    if event_obj and event_obj.end_date:
        # Timezone Handling: Assume naive UTC for DB and Python
        # If event_obj.end_date is aware, use aware now.
        limit = event_obj.end_date + timedelta(hours=1)
        now = datetime.utcnow() 
        
        # Simple naive comparison (assuming consistent naive UTC storage)
        # If mismatch, try to normalize
        if event_obj.end_date.tzinfo and now.tzinfo is None:
             now = now.replace(tzinfo=event_obj.end_date.tzinfo)
        elif event_obj.end_date.tzinfo is None and now.tzinfo:
             now = now.replace(tzinfo=None)

        if now > limit:
            # Auto-close
            game.is_chat_closed = True
            game.chat_closed_at = now
            session.add(game)
            await session.commit()
            
            # Broadcast System Message about closure?
            # Optional but good UX.
            await manager.broadcast(str(game_id), json.dumps({
                "type": "system",
                "message": "Le chat est automatiquement fermé (fin du match + 1h)."
            }))
            
            raise HTTPException(status_code=403, detail="Le chat est clos (délai dépassé).")
            
    # --- END CHECK ---

    chat = MatchChat(
        game_id=game_id,
        tenant_id=tenant_id,
        user_id=current_user.id,
        member_id=member_id,
        sender_name=sender_name,
        message=data.message,
        created_at=datetime.utcnow()
    )
    session.add(chat)
    await session.commit()
    await session.refresh(chat)

    await manager.broadcast(
        str(game_id),
        {
            "id": str(chat.id),
            "sender_name": chat.sender_name,
            "message": chat.message,
            "created_at": chat.created_at.isoformat(),
            "user_id": str(chat.user_id),
        }
    )
    
    return ChatMessageRead(
        id=chat.id,
        sender_name=chat.sender_name,
        message=chat.message,
        created_at=chat.created_at,
        is_me=True
    )



