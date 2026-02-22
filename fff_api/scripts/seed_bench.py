import asyncio
import sys
import os

sys.path.append(os.getcwd())

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.infrastructure.database.session import engine
from src.domain.models.sport import Formation, FormationPosition

async def seed_bench():
    print("Seeding bench positions...")
    async with AsyncSession(engine) as session:
        formations = await session.exec(select(Formation))
        formations = formations.all()
        
        for f in formations:
            print(f"Processing Formation: {f.name} ({f.id})")
            
            # Create 7 subs
            for i in range(1, 8):
                label = f"SUB{i}"
                
                # Check exist
                stmt = select(FormationPosition).where(
                    FormationPosition.formation_id == f.id,
                    FormationPosition.position_label == label
                )
                existing = await session.exec(stmt)
                if existing.first():
                    continue
                
                # Create
                # Coords: Let's put them "below" the pitch (y < 0?) or just arbitrary
                # We'll handle display in frontend based on role 'B'
                sub = FormationPosition(
                    formation_id=f.id,
                    role="B", # Bench
                    coord_x=10.0 * i, # Spread them out just in case
                    coord_y=-10.0, # Off-pitch
                    position_label=label,
                    priority=100 + i
                )
                session.add(sub)
            
        await session.commit()
    print("Done.")

if __name__ == "__main__":
    asyncio.run(seed_bench())
