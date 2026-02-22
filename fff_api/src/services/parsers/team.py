from typing import Any, List
from .base import BaseParser
from src.domain.models.reference import Team

class TeamParser(BaseParser[Team]):
    def parse(self) -> List[Team]:
        data = self.raw_data
        if isinstance(data, dict):
            if "hydra:member" in data:
                data = data["hydra:member"]
            else:
                data = [data]
        
        teams = []
        for item in data:
            engagements = item.get("engagements", [])
            if engagements is None or len(engagements) == 0:
                continue
            team = Team(
                name=item.get("club").get("short_name"),
                code=item.get("code"),
                number=item.get("number"),
                gender=item.get("category_gender"),
                category=item.get("category_label", "").lower().replace("libre", ""),
                # tenant_id and season_id need to be injected or resolved later
            )
            # Store engagements temporarily in the object (not DB mapped yet, or handle via dict return?)
            # Since Team is an SQLModel, we can attach arbitrary attributes if we don't save them.
            # Or better, return a tuple or dict. But BaseParser expects List[T].
            # Let's attach it to the instance `_engagements` attribute.
            team._engagements = engagements
            teams.append(team)
        return teams
