from abc import ABC, abstractmethod
from typing import Dict

class ClubRepository(ABC):
    @abstractmethod
    async def save_clubs_bulk(self, clubs_data: Dict[int, str]) -> None:
        """Saves or updates a bulk of clubs."""
        pass
