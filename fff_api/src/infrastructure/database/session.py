from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
import os
from dotenv import load_dotenv

load_dotenv()

# Build connection string from environment variables
user = os.getenv("POSTGRES_USER", "user")
password = os.getenv("POSTGRES_PASSWORD", "password")
host = os.getenv("POSTGRES_HOST", "localhost")
port = os.getenv("POSTGRES_PORT", "5432")
db_name = os.getenv("POSTGRES_DB", "dbname")

# Default to constructed URL, but allow override via DATABASE_URL
# Priority:
# 1. If POSTGRES_HOST is set to something other than localhost (e.g. 'db' in docker), use constructed URL.
# 2. Else, use DATABASE_URL if exists.
# 3. Else, use constructed URL (defaulting to localhost).

constructed_url = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db_name}"

if host != "localhost" and host != "127.0.0.1":
    DATABASE_URL = constructed_url
else:
    DATABASE_URL = os.getenv("DATABASE_URL", constructed_url)

engine = create_async_engine(DATABASE_URL, echo=False, future=True)

async def init_db():
    # Helper: Import models to ensure they are registered with SQLModel.metadata
    from src.domain.models.job import ImportJob  # noqa: F401
    from src.domain.models.reference import Season, Federation, League, Club # noqa: F401
    from src.domain.models.saas import Plan, Tenant # noqa: F401
    
    async with engine.begin() as conn:
        # await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)

async def get_session() -> AsyncGenerator[AsyncSession, None]:

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
