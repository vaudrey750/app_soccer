import asyncio
import sys
import os

sys.path.append(os.getcwd())

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.infrastructure.database.session import engine
from src.domain.models.sport import Formation, FormationPosition

async def check_formations():
    async with AsyncSession(engine) as session:
        formations = await session.exec(select(Formation))
        for f in formations.all():
            print(f"Formation: {f.name} (ID: {f.id})")
            positions = await session.exec(select(FormationPosition).where(FormationPosition.formation_id == f.id))
            for p in positions.all():
                print(f"  - Pos {p.id}: {p.role} ({p.position_label})")

if __name__ == "__main__":
    asyncio.run(check_formations())
