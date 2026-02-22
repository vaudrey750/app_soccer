from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

class DataProvider(ABC):
    @abstractmethod
    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Retrieves data from the data source."""
        pass
