from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class CarpoolBase(BaseModel):
    event_id: UUID
    available_seats: int = 4
    departure_location: Optional[str] = None
    departure_time: Optional[str] = None 
    note: Optional[str] = None

class CarpoolCreate(CarpoolBase):
    pass

class CarpoolUpdate(BaseModel):
    available_seats: Optional[int] = None
    departure_location: Optional[str] = None
    departure_time: Optional[str] = None
    note: Optional[str] = None

class CarpoolPassengerRead(BaseModel):
    member_id: UUID
    first_name: str
    last_name: str
    photo_url: Optional[str] = None

class CarpoolRead(CarpoolBase):
    id: UUID
    driver_id: UUID
    driver_first_name: Optional[str] = None
    driver_last_name: Optional[str] = None
    passengers: List[CarpoolPassengerRead] = []
    
    class Config:
        from_attributes = True
