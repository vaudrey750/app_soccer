from typing import Any, List, Optional
from datetime import datetime
from .base import BaseParser
from src.domain.models.reference import Game

class GameParser(BaseParser[Game]):
    def parse(self) -> List[Game]:
        data = self.raw_data
        if isinstance(data, dict):
            if "hydra:member" in data:
                data = data["hydra:member"]
            else:
                data = [data]
        
        games = []
        for item in data:
            if not item.get("ma_no"):
                continue

            # Basic parsing
            # Date parsing "2025-09-14T00:00:00Z"
            match_date = None
            if item.get("date"):
                try:
                    match_date = datetime.fromisoformat(item["date"].replace("Z", "+00:00")).date()
                except ValueError:
                    pass

            game = Game(
                # Store ma_no in extra_data or we need a real_game_id field? 
                # For now we don't have real_game_id in the model provided. 
                # We can construct a data_hash or rely on external handling.
                # Let's put it in data_hash for now as a placeholder or assuming the Service handles it.
                data_hash=str(item.get("ma_no")),
                
                date_match=match_date,
                date_time=item.get("time"),
                
                home_team_name=(item.get("home") or {}).get("short_name") or (item.get("home") or {}).get("name"),
                score_home=item.get("home_score"),
                home_is_forfeit=(item.get("home_is_forfeit") == "O"),
                
                away_team_name=(item.get("away") or {}).get("short_name") or (item.get("away") or {}).get("name"),
                score_away=item.get("away_score"),
                away_is_forfeit=(item.get("away_is_forfeit") == "O"),
                
                status=None, # Needs mapping logic
                seems_postponed=(item.get("seems_postponed") == "O" or item.get("status") == "Reporté"),

                phase_number=(item.get("phase") or {}).get("number"),
                phase_name=(item.get("phase") or {}).get("name"),
                poule_stage_number=(item.get("poule") or {}).get("stage_number"),
                poule_name=(item.get("poule") or {}).get("name"),
                journee=(item.get("poule_journee") or {}).get("number"),

                # Terrain / Location info
                stadium=(item.get("terrain") or {}).get("name"),
                address=(item.get("terrain") or {}).get("address"),
                zip_code=(item.get("terrain") or {}).get("zip_code"),
                city=(item.get("terrain") or {}).get("city")
            )
            games.append(game)
            
        return games
