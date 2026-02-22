from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON
from enum import Enum

class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class JobType(str, Enum):
    IMPORT = "import"   # Skip existing clubs (Registration mode)
    UPDATE = "update"   # Force process existing clubs (Sync mode)

class ImportJob(SQLModel, table=True):
    __tablename__ = "import_jobs"

    id: Optional[int] = Field(default=None, primary_key=True)
    type: JobType = Field(default=JobType.IMPORT)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: JobStatus = Field(default=JobStatus.PENDING)
    
    # Store the list of configs as a JSON object
    # Postgres will handle JSON, SQLite might need String, but we assume Postgres here based on project
    configs: List[Dict[str, Any]] = Field(sa_column=Column(JSON))
    
    error_message: Optional[str] = None
