import asyncio
import logging
from datetime import datetime, timedelta
from sqlmodel import select
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from src.infrastructure.database.session import engine
from src.domain.models.saas import Tenant
from src.domain.models.core import Events, EventType, Member, GameStatus
from src.domain.models.reference import Game, Team

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_test_match():
    async with engine.begin() as conn:
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with async_session() as session:
            # 1. Get Tenant (FC Test Complet)
            tenant_q = await session.exec(select(Tenant).where(Tenant.slug == "fc-test-full"))
            tenant = tenant_q.first()
            if not tenant:
                logger.error("Tenant 'fc-test-full' not found. Run seed_test_squad.py first.")
                return

            print(f"Tenant found: {tenant.name}")

            # 2. Get Team (Equipe Première)
            team_q = await session.exec(select(Team).where(Team.tenant_id == tenant.id))
            home_team = team_q.first()
            if not home_team:
                logger.error("No team found.")
                return

            # 3. Create External Team (Adversaire)
            # Check if exists first
            opp_q = await session.exec(select(Team).where(Team.name == "AS Rivals"))
            away_team = opp_q.first()
            if not away_team:
                away_team = Team(
                    name="AS Rivals",
                    tenant_id=tenant.id, # Internal rival or purely reference? Let's assign same tenant for simplicity/visibility
                    category="SENIOR",
                    gender="M"
                )
                session.add(away_team)
                await session.commit()
                await session.refresh(away_team)

            # 4. Create Game
            # Match start: Now - 15 minutes (Live match)
            start_time = datetime.now() - timedelta(minutes=15)
            
            game = Game(
                tenant_id=tenant.id,
                home_team_id=home_team.id,
                home_team_name=home_team.name,
                away_team_id=away_team.id,
                away_team_name=away_team.name,
                score_home=0,
                score_away=0,
                status=1, # Scheduled / Started logic handled by time? Or status ID 5=LIVE?
                location="Stade Municipal",
                date=start_time.date()
                # Status 1=SCHEDULED. Let's assume dashboard checks date.
            )
            session.add(game)
            await session.commit()
            await session.refresh(game)

            # 5. Create Event
            event = Events(
                tenant_id=tenant.id,
                type=1, # MATCH
                title="Match de Championnat",
                start_date=start_time,
                end_date=start_time + timedelta(hours=2),
                location="Stade Municipal",
                game_id=game.id,
                description="Match important pour la montée."
            )
            session.add(event)
            await session.commit()
            
            print(f"Match created successfully! ID: {event.id}")
            print(f"Starts at: {start_time}")

if __name__ == "__main__":
    asyncio.run(create_test_match())
