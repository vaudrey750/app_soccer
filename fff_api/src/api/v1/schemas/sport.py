from typing import List, Optional, Any
import uuid
from pydantic import BaseModel

class FormationPositionRead(BaseModel):
    id: int
    formation_id: int
    role: str
    coord_x: float
    coord_y: float
    position_label: str
    priority: int

class FormationRead(BaseModel):
    id: int
    name: str
    category: Optional[str]
    description: Optional[str]
    
class FormationWithPositionsRead(FormationRead):
    positions: List[FormationPositionRead]

class MatchLineupItem(BaseModel):
    id: Optional[uuid.UUID]
    position_id: int
    member_id: Optional[uuid.UUID]
    # Optional details for reading
    position: Optional[FormationPositionRead]
    member_name: Optional[str]

class MatchLineupRead(BaseModel):
    event_id: uuid.UUID
    lineup_published: Optional[bool] = False
    formation: Optional[FormationRead]
    items: List[MatchLineupItem]

class LineupItemUpdate(BaseModel):
    position_id: int
    member_id: uuid.UUID 

class MatchLineupUpdate(BaseModel):
    formation_id: int
    items: List[LineupItemUpdate]

class TimelinePlayer(BaseModel):
    id: Optional[uuid.UUID]
    name: Optional[str]

class GameTimelineItemRead(BaseModel):
    id: uuid.UUID
    minute: int
    type: str
    team: str
    player: Optional[TimelinePlayer]
    assist: Optional[TimelinePlayer]
    extra: Optional[dict]

class GameDetailsRead(BaseModel):
    id: uuid.UUID
    score_home: Optional[int]
    score_away: Optional[int]
    status: int
    timer_start_at: Optional[Any] = None
    elapsed_time_at_start: Optional[int] = 0
    timeline: List[GameTimelineItemRead]

# Chat Schemas
class ChatMessageRead(BaseModel):
    id: uuid.UUID
    sender_name: str
    message: str
    created_at: Any
    is_me: Optional[bool] = False

class ChatMessageCreate(BaseModel):
    message: str
    sender_user_id: Optional[uuid.UUID] = None

