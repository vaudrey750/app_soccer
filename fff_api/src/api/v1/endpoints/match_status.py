from typing import Any, Dict
import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.infrastructure.database.session import get_session
from src.domain.models.saas import User
from src.api.deps import get_current_active_user
from src.domain.models.reference import Game
from src.domain.models.core import GameStatus

router = APIRouter()

@router.put("/matches/{match_id}/status")
async def update_match_status(
    match_id: uuid.UUID,
    status_id: int = Body(..., embed=True),
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Update the status of a match/game and manage auto-timer.
    """
    # 1. Fetch Game via Event
    from src.domain.models.core import Events
    
    stmt = select(Events).where(Events.id == match_id)
    result = await session.execute(stmt)
    event = result.scalars().first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Match (Event) not found")
        
    if not event.game_id:
        raise HTTPException(status_code=400, detail="This event is not linked to a game")
    
    # Use session.get for cleaner access if available or select
    stmt_game = select(Game).where(Game.id == event.game_id)
    res_game = await session.execute(stmt_game)
    game = res_game.scalars().first()
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
        
    # Security Check: Role Authorization
    # Only Managers can change status
    from src.domain.models.core import Member, MemberRole
    
    # 1. Check if user is member of the tenant
    stmt_mem = select(Member).where(Member.user_id == current_user.id).where(Member.tenant_id == event.tenant_id)
    res_mem = await session.execute(stmt_mem)
    member = res_mem.scalars().first()
    
    if not member:
            raise HTTPException(status_code=403, detail="Not authorized for this club")
            
    # 2. Check role permissions
    authorized = False
    if member.role_in_app:
        stmt_role = select(MemberRole).where(MemberRole.id == member.role_in_app)
        res_role = await session.execute(stmt_role)
        role_obj = res_role.scalars().first()
        if role_obj and role_obj.name in ['ADMIN', 'COACH', 'ASSISTANT', 'PRESIDENT']:
            authorized = True
    
    if not authorized:
            raise HTTPException(status_code=403, detail="Insufficient permissions to manage match status")

    old_status = game.status
    
    # 2. Timer Logic
    now = datetime.datetime.utcnow()
    
    # New Status is LIVE (5)
    if status_id == 5:
        if old_status != 5:
            # Resuming or Starting
            game.timer_start_at = now
            # elapsed_time_at_start remains as stored from previous pauses
        else:
             # Already live, noop or sync
             if game.timer_start_at is None:
                    game.timer_start_at = now

    # New Status is NOT LIVE (Paused, Halftime, End, etc.)
    elif status_id != 5:
        if status_id == 1:
            # Check for existing timeline events
            from src.domain.models.core import GameTimeline
            stmt_timeline = select(GameTimeline).where(GameTimeline.game_id == game.id)
            res_timeline = await session.execute(stmt_timeline)
            if res_timeline.scalars().first():
                 raise HTTPException(status_code=400, detail="Impossible de réinitialiser le match car des actions sont déjà enregistrées.")

            # Reset to SCHEDULED: Reset timer completely
            game.elapsed_time_at_start = 0
            game.timer_start_at = None
            # Reset server-side end timestamp so post-match windows remain correct
            event.end_date = None
            # Reset scores
            game.score_home = 0
            game.score_away = 0
            game.current_period = 1

            # Reset participation stats (MOTM, Ratings)
            from src.domain.models.core import EventParticipation
            from sqlalchemy import update
            
            # Using update statement for efficiency
            stmt_reset_stats = (
                update(EventParticipation)
                .where(EventParticipation.event_id == event.id)
                .values(motm_votes=0, rating=None)
            )
            await session.execute(stmt_reset_stats)
        elif old_status == 5:
            # Was LIVE, now stopping. Calculate elapsed since last start.
            if game.timer_start_at:
                 # Ensure tz-naive consistency if using datetime.utcnow
                 start_dt = game.timer_start_at 
                 if start_dt.tzinfo:
                     start_dt = start_dt.replace(tzinfo=None)
                 delta = (now - start_dt).total_seconds()
                 current_elapsed = (game.elapsed_time_at_start or 0) + int(delta)
                 game.elapsed_time_at_start = current_elapsed
            
            # Clear active start time
            game.timer_start_at = None

    # Handle explicit FINISHED state (Status 2)
    if status_id == 2:
         # Set end date if not set
         if not event.end_date:
             event.end_date = now

    # Update Status
    game.status = status_id
    
    session.add(game)
    # Sync Event
    event.status_id = status_id
    session.add(event)
    
    await session.commit()
    await session.refresh(game)
    
    # Broadcast status change
    from src.services.websocket_manager import manager
    await manager.broadcast(str(game.id), {
        "type": "game_update",
        "action": "status_change",
        "status_id": status_id,
        "new_status": "PLAYED" if status_id == 2 else "UNKNOWN" # Simplified
    })
    
    return {
        "status": "success", 
        "new_status": status_id,
        "timer": {
            "elapsed": game.elapsed_time_at_start,
            "start_at": game.timer_start_at
        }
    }
