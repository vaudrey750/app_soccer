import asyncio
from datetime import datetime, timedelta
from sqlmodel import select
from src.infrastructure.database.session import engine
from src.domain.models.core import Events, EventType
from src.domain.models.reference import Game, Team
from src.domain.models.saas import Tenant
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

async def create_future_matches():
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        # 1. Get Tenant
        tenants = await session.exec(select(Tenant).where(Tenant.name.ilike('%Supremes%')))
        tenant = tenants.first()
        if not tenant:
            print('Tenant Supremes not found')
            return

        # 2. Get Team Senior 5
        teams = await session.exec(select(Team).where(Team.tenant_id == tenant.id).where(Team.name == 'Senior 5'))
        home_team = teams.first()
        if not home_team:
            print('Team Senior 5 not found')
            return

        print(f'Creating matches for {home_team.name} ({tenant.name})')

        # 3. Create Matches
        matches_to_create = [
            {
                'opponent': 'US Villejuif',
                'days_offset': 2,
                'time': '15:00',
                'location': 'Stade Karl Marx'
            },
            {
                'opponent': 'Paris FC 3',
                'days_offset': 9,
                'time': '15:00',
                'location': 'Extérieur'
            },
             {
                'opponent': 'Red Star Espoirs',
                'days_offset': 16,
                'time': '15:00',
                'location': 'Stade Karl Marx'
            }
        ]

        for m in matches_to_create:
            start_dt = datetime.now() + timedelta(days=m['days_offset'])
            start_dt = start_dt.replace(hour=15, minute=0, second=0, microsecond=0)
            end_dt = start_dt + timedelta(hours=2)

            # Create Game
            game = Game(
                tenant_id=tenant.id,
                home_team_id=home_team.id,
                home_team_name=home_team.name,
                away_team_name=m['opponent'],
                location=m['location'],
                status=1 # Scheduled
            )
            session.add(game)
            await session.commit()
            await session.refresh(game)

            # Create Event
            event = Events(
                tenant_id=tenant.id,
                type=1, # Match
                title=f"Match vs {m['opponent']}",
                start_date=start_dt,
                end_date=end_dt,
                location=m['location'],
                game_id=game.id,
                description='Championnat R3 - Journée X'
            )
            
            session.add(event)
            await session.commit()
            print(f"Created match vs {m['opponent']} on {start_dt}")

if __name__ == "__main__":
    asyncio.run(create_future_matches())
