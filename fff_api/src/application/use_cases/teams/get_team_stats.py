import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, or_, desc

from src.domain.models.reference import Team, Game

class GetTeamStatsUseCase:
    """
    Calculates statistics for a team based on played games.
    """
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, team_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        # Check team exists
        team = await self.session.get(Team, team_id)
        if not team:
            return None

        # Fetch finished games
        query = select(Game).where(
            or_(Game.home_team_id == team_id, Game.away_team_id == team_id),
            Game.status == 2 # 2 = Played/Finished usually
        ).order_by(desc(Game.date_match))

        result = await self.session.execute(query)
        games = result.scalars().all()

        return self._calculate_stats(games, team_id)

    def _calculate_stats(self, games: List[Game], team_id: uuid.UUID) -> Dict[str, Any]:
        played = len(games)
        won = 0
        drawn = 0
        lost = 0
        goals_for = 0
        goals_against = 0
        clean_sheets = 0
        
        form_guide = []
        
        # We can implement biggest win/loss tracking here too
        
        for game in games: # Games are ordered newest first
            # Determine if Home or Away
            is_home = (game.home_team_id == team_id)
            
            my_score = game.score_home if is_home else game.score_away
            opp_score = game.score_away if is_home else game.score_home
            
            if my_score is None or opp_score is None:
                continue
                
            goals_for += my_score
            goals_against += opp_score
            
            if opp_score == 0:
                clean_sheets += 1

            result_char = 'D'
            if my_score > opp_score:
                won += 1
                result_char = 'W'
            elif my_score < opp_score:
                lost += 1
                result_char = 'L'
            else:
                drawn += 1
            
            if len(form_guide) < 5:
                form_guide.append(result_char)

        return {
            "played": played,
            "won": won,
            "drawn": drawn,
            "lost": lost,
            "goals_for": goals_for,
            "goals_against": goals_against,
            "goal_difference": goals_for - goals_against,
            "clean_sheets": clean_sheets,
            "form": form_guide, # ['W', 'L', 'D'...] (Last 5)
            # Add other stats as needed
        }
