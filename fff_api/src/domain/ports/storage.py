from abc import ABC, abstractmethod
from typing import Any

class RawStorage(ABC):
    @abstractmethod
    def save_raw(self, category: str, path: str, data: Any) -> None:
        """Saves raw data to storage."""
        pass
