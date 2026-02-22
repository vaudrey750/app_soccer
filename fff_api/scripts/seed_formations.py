import asyncio
import sys
import os

# Adjust path to find src module
sys.path.append(os.getcwd())

from sqlmodel import select, text
from sqlmodel.ext.asyncio.session import AsyncSession
from src.infrastructure.database.session import engine
from src.domain.models.sport import Formation, FormationPosition

async def seed_formations():
    print("Seeding formations and positions...")
    
    # Static Data from Request
    formations_data = [
        {"id": 1, "name": "4-4-2 Classique", "category": "Équilibre", "description": "Équilibre"},
        {"id": 2, "name": "4-3-3", "category": "Attaque", "description": "Offensif / Possession"},
        {"id": 3, "name": "4-2-3-1", "category": "Équilibre", "description": "Moderne / Équilibré"},
        {"id": 4, "name": "3-5-2", "category": "Défense", "description": "Solidité / Pistons"},
        {"id": 5, "name": "4-4-2 Losange", "category": "Équilibre", "description": "Diamond"}
    ]
    
    positions_data = [
        # 1. Le 4-4-2 Classique
        (1, 'G', 50.00, 5.00, 'GK', 1),
        (1, 'D', 15.00, 25.00, 'LB', 2),
        (1, 'D', 40.00, 25.00, 'LCB', 3),
        (1, 'D', 60.00, 25.00, 'RCB', 4),
        (1, 'D', 85.00, 25.00, 'RB', 5),
        (1, 'M', 15.00, 55.00, 'LM', 6),
        (1, 'M', 40.00, 50.00, 'LCM', 7),
        (1, 'M', 60.00, 50.00, 'RCM', 8),
        (1, 'M', 85.00, 55.00, 'RM', 9),
        (1, 'F', 40.00, 85.00, 'LS', 10),
        (1, 'F', 60.00, 85.00, 'RS', 11),

        # 2. Le 4-3-3
        (2, 'G', 50.0, 5.0, 'GK', 1),
        (2, 'D', 15.0, 30.0, 'LB', 2),
        (2, 'D', 40.0, 25.0, 'LCB', 3),
        (2, 'D', 60.0, 25.0, 'RCB', 4),
        (2, 'D', 85.0, 30.0, 'RB', 5),
        (2, 'M', 50.0, 45.0, 'DM', 6), # Sentinelle
        (2, 'M', 35.0, 60.0, 'LCM', 7), # Relayeur
        (2, 'M', 65.0, 60.0, 'RCM', 8), # Relayeur
        (2, 'F', 20.0, 85.0, 'LW', 9),
        (2, 'F', 80.0, 85.0, 'RW', 10),
        (2, 'F', 50.0, 90.0, 'ST', 11),

        # 3. Le 4-2-3-1
        (3, 'G', 50.0, 5.0, 'GK', 1),  
        (3, 'D', 15.0, 25.0, 'LB', 2), 
        (3, 'D', 40.0, 25.0, 'LCB', 3),
        (3, 'D', 60.0, 25.0, 'RCB', 4),
        (3, 'D', 85.0, 25.0, 'RB', 5), 
        (3, 'M', 35.0, 45.0, 'LDM', 6), 
        (3, 'M', 65.0, 45.0, 'RDM', 7),
        (3, 'M', 50.0, 70.0, 'CAM', 8),
        (3, 'M', 15.0, 70.0, 'LM', 9), # Excentrés
        (3, 'M', 85.0, 70.0, 'RM', 10),
        (3, 'F', 50.0, 90.0, 'ST', 11),

        # 4. Le 3-5-2
        (4, 'G', 50.0, 5.0, 'GK', 1),
        (4, 'D', 30.0, 25.0, 'LCB', 2),
        (4, 'D', 50.0, 25.0, 'CB', 3),
        (4, 'D', 70.0, 25.0, 'RCB', 4),
        (4, 'M', 10.0, 55.0, 'LWB', 5),
        (4, 'M', 90.0, 55.0, 'RWB', 6),
        (4, 'M', 50.0, 45.0, 'DM', 7),
        (4, 'M', 35.0, 60.0, 'LCM', 8),
        (4, 'M', 65.0, 60.0, 'RCM', 9),
        (4, 'F', 40.0, 85.0, 'LS', 10),
        (4, 'F', 60.0, 85.0, 'RS', 11),

        # 5. Le 4-4-2 Losange
        (5, 'G', 50.0, 5.0, 'GK', 1), 
        (5, 'D', 15.0, 25.0, 'LB', 2), 
        (5, 'D', 40.0, 25.0, 'LCB', 3),
        (5, 'D', 60.0, 25.0, 'RCB', 4),
        (5, 'D', 85.0, 25.0, 'RB', 5), 
        (5, 'M', 50.0, 42.0, 'DM', 6),
        (5, 'M', 30.0, 58.0, 'LCM', 7),
        (5, 'M', 70.0, 58.0, 'RCM', 8),
        (5, 'M', 50.0, 75.0, 'CAM', 9),
        (5, 'F', 40.0, 90.0, 'LS', 10),
        (5, 'F', 60.0, 90.0, 'RS', 11),
    ]

    async with AsyncSession(engine) as session:
        # Create schema 'core' if it doesn't exist (it should exist, but safe to keep)
        await session.exec(text("CREATE SCHEMA IF NOT EXISTS core"))
        await session.commit()
        
        # Sync tables
        # Since I cannot easily run alembic from here without configured env, 
        # I rely on SQLModel to create tables if they don't exist.
        # But `engine` is async. we need `run_sync`.
        pass
        # Actually usually `manage_db.sh` or similar runs migrations. 
        # But here I want to ensure tables exist.
        # Let's try raw SQL for table creation to be safe and robust
        
        await session.exec(text("DROP TABLE IF EXISTS core.formation_position CASCADE"))
        await session.exec(text("DROP TABLE IF EXISTS core.formation CASCADE"))

        await session.exec(text("""
            CREATE TABLE IF NOT EXISTS core.formation (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                category VARCHAR(50),
                description TEXT
            );
        """))
        
        await session.exec(text("""
            CREATE TABLE IF NOT EXISTS core.formation_position (
                id SERIAL PRIMARY KEY,
                formation_id INT REFERENCES core.formation(id),
                role CHAR(1), 
                coord_x DECIMAL(5, 2),
                coord_y DECIMAL(5, 2),
                position_label VARCHAR(10),
                priority INT DEFAULT 0,
                UNIQUE(formation_id, coord_x, coord_y)
            );
        """))
        
        await session.exec(text("""
            CREATE TABLE IF NOT EXISTS core.match_lineup (
                id UUID PRIMARY KEY,
                tenant_id UUID REFERENCES saas.tenant(id),
                event_id UUID REFERENCES core.event(id),
                formation_id INT REFERENCES core.formation(id),
                position_id INT REFERENCES core.formation_position(id),
                member_id UUID REFERENCES core.member(id)
            );
        """))
        await session.commit()

        # Seed Formations
        for f_data in formations_data:
            existing = await session.get(Formation, f_data["id"])
            if not existing:
                formation = Formation(**f_data)
                session.add(formation)
        
        await session.commit()
        
        # Seed Positions
        # First clear existing positions to avoid duplicates on re-run or just check existence
        # Simpler: Delete all positions for these known formation IDs and re-insert
        known_ids = [f["id"] for f in formations_data]
        await session.exec(text(f"DELETE FROM core.formation_position WHERE formation_id IN ({','.join(map(str, known_ids))})"))
        
        for p_data in positions_data:
            # (fmt_id, role, x, y, label, priority)
            pos = FormationPosition(
                formation_id=p_data[0],
                role=p_data[1],
                coord_x=p_data[2],
                coord_y=p_data[3],
                position_label=p_data[4],
                priority=p_data[5]
            )
            session.add(pos)
            
        await session.commit()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(seed_formations())
