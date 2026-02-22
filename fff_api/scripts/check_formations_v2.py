import asyncio
import sys
import os

# Add cwd to path
sys.path.append(os.getcwd())

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.infrastructure.database.session import engine
from src.domain.models.sport import Formation

async def check_formations():
    print("Checking formations...")
    async with AsyncSession(engine) as session:
        result = await session.exec(select(Formation))
        formations = result.all()
        print(f"Formations found: {len(formations)}")
        for f in formations:
            print(f"- {f.name} (ID: {f.id})")

if __name__ == "__main__":
    if sys.version_info >= (3, 7):
        asyncio.run(check_formations())
    else:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(check_formations())
