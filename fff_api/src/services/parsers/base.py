from abc import ABC, abstractmethod
from typing import Any, Dict, List, Generic, TypeVar, Optional

T = TypeVar("T")

class BaseParser(ABC, Generic[T]):
    def __init__(self, raw_data: Any):
        self.raw_data = raw_data

    @abstractmethod
    def parse(self) -> List[T]:
        """
        Parse raw_data and return a list of domain models.
        """
        pass
