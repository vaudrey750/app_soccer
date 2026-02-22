from typing import Optional
from sqlmodel import Field, SQLModel

class FFFAllClubs(SQLModel, table=True):
    __tablename__ = "fff_all_clubs"
    __table_args__ = {"schema": "reference"}

    cl_no: int = Field(primary_key=True, index=True)
    short_name: Optional[str] = None
