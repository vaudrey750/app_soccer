from typing import List, Optional
import uuid
from pydantic import BaseModel

# Task Type
class TaskTypeRead(BaseModel):
    id: int
    name: str

# Task
class TaskBase(BaseModel):
    type_id: int
    description: str
    
class TaskCreate(TaskBase):
    assigned_member_ids: List[uuid.UUID]

class TaskUpdate(BaseModel):
    is_completed: Optional[bool] = None
    description: Optional[str] = None
    assigned_member_id: Optional[uuid.UUID] = None

class TaskRead(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    type_id: int
    assigned_member_id: Optional[uuid.UUID]
    description: str
    is_completed: bool

    class Config:
        orm_mode = True
