from typing import Any, Dict, Optional
import uuid
from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from fastapi import HTTPException

from src.domain.models.saas import User
from src.domain.models.core import (
    Member,
    Events,
    EventParticipation,
)
from src.domain.models.reference import Game, Team


class GetDashboardSummaryUseCase:
    
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, current_user: User, tenant_id: Optional[uuid.UUID] = None, team_id: Optional[uuid.UUID] = None) -> Dict[str, Any]:
        # 1. Resolve Tenant
        target_tenant_id = await self._resolve_tenant(current_user, tenant_id)
        
        dashboard_data = {
            "next_match": None,
            "training_attendance": None,
            "streak": None,
            "injuries": {
                "count": 0,
                "details": []
            } # Default
        }

        # 2. Next Match
        dashboard_data["next_match"] = await self._get_next_match(target_tenant_id, team_id)

        # 3. Training Attendance
        dashboard_data["training_attendance"] = await self._get_training_attendance(target_tenant_id)
        
        # 4. Streak (Simplified for now - Logic was incomplete in route snippet)
        dashboard_data["streak"] = await self._get_streak(target_tenant_id, team_id)

        return dashboard_data

    async def _resolve_tenant(self, current_user: User, tenant_id: Optional[uuid.UUID]) -> uuid.UUID:
        target_tenant_id = tenant_id
        if not target_tenant_id:
            statement = select(Member).where(Member.user_id == current_user.id)
            result = await self.session.execute(statement)
            member = result.scalars().first()
            if not member:
                raise HTTPException(status_code=404, detail="User is not a member of any club")
            target_tenant_id = member.tenant_id
        else:
            # Verify access
            statement = select(Member).where(
                Member.user_id == current_user.id, 
                Member.tenant_id == tenant_id
            )
            result = await self.session.execute(statement)
            if not result.scalars().first():
                 raise HTTPException(status_code=403, detail="Not authorized for this club")
        return target_tenant_id

    async def _get_next_match(self, target_tenant_id: uuid.UUID, team_id: Optional[uuid.UUID]) -> Optional[Dict[str, Any]]:
        game_query = select(Game).where(
            Game.tenant_id == target_tenant_id,
            Game.date_match >= date.today()
        )
        
        if team_id:
            game_query = game_query.where(
                or_(Game.home_team_id == team_id, Game.away_team_id == team_id)
            )
            
        game_query = game_query.order_by(Game.date_match.asc(), Game.date_time.asc())
        
        game_result = await self.session.execute(game_query)
        next_game = game_result.scalars().first()
        
        if not next_game:
            return None

        # Determine opponent
        home_team_stmt = select(Team).where(Team.id == next_game.home_team_id)
        away_team_stmt = select(Team).where(Team.id == next_game.away_team_id)
        
        home_team = (await self.session.execute(home_team_stmt)).scalars().first()
        away_team = (await self.session.execute(away_team_stmt)).scalars().first()
        
        opponent_name = "Inconnu"
        is_home = True
        
        if team_id:
             if next_game.home_team_id == team_id:
                 is_home = True
                 opponent_name = next_game.away_team_name or (away_team.name if away_team else "Inconnu")
             else:
                 is_home = False
                 opponent_name = next_game.home_team_name or (home_team.name if home_team else "Inconnu")
        elif home_team and home_team.tenant_id == target_tenant_id:
            opponent_name = next_game.away_team_name or (away_team.name if away_team else "Inconnu")
            is_home = True
        elif away_team and away_team.tenant_id == target_tenant_id:
            opponent_name = next_game.home_team_name or (home_team.name if home_team else "Inconnu")
            is_home = False
        else:
            opponent_name = next_game.away_team_name or "Adversaire"

        days_remaining = (next_game.date_match - date.today()).days if next_game.date_match else 0
        
        return {
            "opponent": opponent_name,
            "date": next_game.date_match.isoformat(),
            "time": next_game.date_time,
            "days_remaining": days_remaining,
            "location": "Domicile" if is_home else "Extérieur",
            "competition": "Championnat"
        }

    async def _get_training_attendance(self, target_tenant_id: uuid.UUID) -> Dict[str, Any]:
        training_query = select(Events).where(
            Events.tenant_id == target_tenant_id,
            Events.type == 2, # TRAINING
            Events.start_date >= datetime.now()
        ).order_by(Events.start_date.asc())
        
        training_result = await self.session.execute(training_query)
        next_training = training_result.scalars().first()

        if next_training:
            confirmed_count_stmt = select(func.count(EventParticipation.member_id)).where(
                EventParticipation.event_id == next_training.id,
                EventParticipation.status == 2 # CONFIRMED
            )
            present_count = (await self.session.execute(confirmed_count_stmt)).scalar() or 0
            
            total_members_stmt = select(func.count(Member.id)).where(Member.tenant_id == target_tenant_id)
            total_members = (await self.session.execute(total_members_stmt)).scalar() or 1
            
            percentage = int((present_count / total_members) * 100)
            
            return {
                "next_date": next_training.start_date.isoformat(),
                "present": present_count,
                "total": total_members,
                "percentage": percentage
            }
        
        return {
             "present": 0,
             "total": 0,
             "percentage": 0,
             "message": "Aucun entraînement prévu"
        }

    async def _get_streak(self, target_tenant_id: uuid.UUID, team_id: Optional[uuid.UUID]) -> Dict[str, Any]:
        past_games_query = select(Game).where(
            Game.tenant_id == target_tenant_id,
            Game.date_match < date.today(),
            Game.status == 2 # PLAYED
        )

        if team_id:
            past_games_query = past_games_query.where(
                or_(Game.home_team_id == team_id, Game.away_team_id == team_id)
            )
        
        past_games_query = past_games_query.order_by(Game.date_match.desc()).limit(10)
        
        past_games = (await self.session.execute(past_games_query)).scalars().all()
        
        streak_type = "Sans match"
        streak_count = 0
        last_score = "N/A"
        
        if past_games:
            current_streak_code = None # 'W', 'D', 'L'
            count = 0
            
            first_game = past_games[0]
            
            # Helper to fetch team info if needed
            async def get_team(tid):
                if not tid: return None
                return (await self.session.execute(select(Team).where(Team.id == tid))).scalars().first()

            home_t = await get_team(first_game.home_team_id)
            away_t = await get_team(first_game.away_team_id)
            
            am_i_home = False
            if team_id:
                 if first_game.home_team_id == team_id:
                      am_i_home = True
            elif home_t and home_t.tenant_id == target_tenant_id:
                am_i_home = True
            elif away_t and away_t.tenant_id == target_tenant_id:
                am_i_home = False
            
            s_home = first_game.score_home if first_game.score_home is not None else 0
            s_away = first_game.score_away if first_game.score_away is not None else 0
            last_score = f"{s_home}-{s_away}"
            
            result_code = 'D'
            if s_home == s_away:
                result_code = 'D' 
            elif am_i_home:
                result_code = 'W' if s_home > s_away else 'L'
            else:
                result_code = 'W' if s_away > s_home else 'L'
                
            current_streak_code = result_code
            count = 1
            
            for g in past_games[1:]:
                g_home_t = await get_team(g.home_team_id)
                g_away_t = await get_team(g.away_team_id)
                
                g_am_i_home = False
                if team_id:
                    if g.home_team_id == team_id:
                        g_am_i_home = True
                elif g_home_t and g_home_t.tenant_id == target_tenant_id:
                    g_am_i_home = True
                elif g_away_t and g_away_t.tenant_id == target_tenant_id:
                    g_am_i_home = False
                
                g_s_home = g.score_home if g.score_home is not None else 0
                g_s_away = g.score_away if g.score_away is not None else 0
                
                g_res = 'D'
                if g_s_home == g_s_away:
                    g_res = 'D'
                elif g_am_i_home:
                    g_res = 'W' if g_s_home > g_s_away else 'L'
                else:
                    g_res = 'W' if g_s_away > g_s_home else 'L'
                
                if g_res == current_streak_code:
                    count += 1
                else:
                    break
            
            streak_count = count
            if current_streak_code == 'W':
                streak_type = "Victoires"
            elif current_streak_code == 'L':
                streak_type = "Défaites"
            else:
                streak_type = "Nuls"

        return {
            "count": streak_count,
            "type": streak_type,
            "last_result": last_score
        }
