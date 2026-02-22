from typing import Optional
from pydantic import BaseModel


class ImportConfig(BaseModel):
    """
    Configuration for an import task.
    Defines the parameters necessary to retrieve data for a club or a competition.
    """
    club_id: int
    label: str
