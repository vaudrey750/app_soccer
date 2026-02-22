from typing import Any, List
from .base import BaseParser
from src.domain.models.reference import Competition

class CompetitionParser(BaseParser[Competition]):
    def parse(self) -> List[Competition]:
        data = self.raw_data
        if isinstance(data, dict):
            if "hydra:member" in data:
                data = data["hydra:member"]
            else:
                data = [data]
        
        comps = []
        for item in data:
            if not item.get("cp_no"):
                continue
                
            comp = Competition(
                real_competition_id=str(item.get("cp_no")),
                name=item.get("name") or "Unknown Competition",
                # league_id, season_id logic would be here if we had the context
            )
            comps.append(comp)
        return comps
