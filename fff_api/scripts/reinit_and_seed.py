import asyncio
import logging
import random
import uuid
import httpx
import os
from datetime import date, timedelta, datetime
from faker import Faker
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select

# Imports des modèles
from src.infrastructure.database.session import engine
from src.domain.models.saas import Tenant, User
from src.domain.models.reference import Team, Game, Club, Season
from src.domain.models.core import (
    Member, Events, EventParticipation, GameTimeline, 
    MemberRole, PlayerPosition, EventType, GameStatus, ParticipationStatus,
    GameActionType, Task, TeamMember
)
from src.core.security import get_password_hash

# Configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
fake = Faker('fr_FR')

API_URL = os.getenv("API_URL", "http://api:8000")
CLUB_ID_TO_IMPORT = 112966 # Suprêmes Béliers

async def clean_database(session: AsyncSession):
    logger.info("🧹 Cleaning database...")
    # Ordre de suppression pour respecter les contraintes de clés étrangères
    tables = [
        "core.carpool_passenger", "core.carpool", "core.task", 
        "core.game_timeline", "core.event_participation", "core.event", 
        "reference.game", "core.team_member", "core.member", 
        "saas.users", "reference.team", "reference.club", "saas.tenant"
    ]
    for table in tables:
        try:
            await session.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
        except Exception as e:
            logger.warning(f"Could not truncate {table}: {e}")
            # Fallback delete if truncate fails (permissions)
            try:
                await session.execute(text(f"DELETE FROM {table};"))
            except Exception as e2:
                logger.error(f"Could not delete {table}: {e2}")
    
    await session.commit()
    logger.info("✅ Database cleaned.")

async def trigger_import():
    logger.info(f"🚀 Triggering import for club {CLUB_ID_TO_IMPORT} via API...")
    async with httpx.AsyncClient() as client:
        try:
            # Using correct endpoint /import-clubs valid for List[ImportConfig]
            response = await client.post(
                f"{API_URL}/import-clubs", 
                json=[{"club_id": CLUB_ID_TO_IMPORT, "label": "Supremes Beliers"}],
                timeout=30.0
            )
            if response.status_code in [200, 201, 202]:
                logger.info("✅ Import job started successfully.")
                return True
            else:
                logger.error(f"❌ Failed to trigger import: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"❌ Error connecting to API: {e}")
            logger.info("ℹ️ Fallback: Please ensure the API container is running.")
            return False

async def wait_for_tenant(session: AsyncSession, expected_slug="supremes-beliers"):
    logger.info("⏳ Waiting for Tenant creation (Worker)...")
    defaults_slugs = [expected_slug, "les-supremes-beliers-villejuif", "supremes-beliers"]
    
    for _ in range(30): # Wait up to 60s
        logger.info("... checking DB ...")
        # Refresh session transaction to see new data
        await session.commit() 
        
        stmt = select(Tenant).where(Tenant.slug.in_(defaults_slugs)) # type: ignore
        result = await session.execute(stmt)
        tenant = result.scalars().first()
        
        if tenant:
            logger.info(f"✅ Tenant found: {tenant.name} ({tenant.id})")
            return tenant
        
        await asyncio.sleep(2)
    
    logger.error("❌ Timeout waiting for Tenant. Did the worker run?")
    return None

async def seed_test_data(session: AsyncSession, tenant: Tenant):
    logger.info("🌱 Seeding Test Data...")
    
    # 1. Get Members (imported) - Wait for worker to populate
    logger.info("⏳ Waiting for members to be imported...")
    members = []
    for _ in range(20): # Wait up to 40s
        col_stmt = select(Member).where(Member.tenant_id == tenant.id)
        members_res = await session.execute(col_stmt)
        members = list(members_res.scalars().all())
        if len(members) > 5: # Assume at least some members
             logger.info(f"✅ Found {len(members)} members.")
             break
        await asyncio.sleep(2)
    
    if not members:
        logger.warning("⚠️ No members found from import after wait. Will generate all 50.")
    else:
        logger.info(f"ℹ️ Found {len(members)} members imported.")

    # Get Team (imported)
    t_stmt = select(Team).where(Team.tenant_id == tenant.id)
    team = (await session.execute(t_stmt)).scalars().first()
    
    if not team:
        # Create a default team if missing
        team = Team(name="Equipe Première", tenant_id=tenant.id, category="SENIOR", gender="M", code=1)
        session.add(team)
        await session.commit()
        await session.refresh(team)

    # Ensure Season
    s_stmt = select(Season).where(Season.name == "2024-2025")
    curr_season = (await session.execute(s_stmt)).scalars().first()
    if not curr_season:
         curr_season = Season(name="2024-2025", start_date=date(2024, 7, 1), end_date=date(2025, 6, 30))
         session.add(curr_season)
         await session.commit()

    # 1b. Generate 50 Players (Complementary)
    logger.info("Generating 50 complementary fake players...")
    generated_players = []
    
    # Pre-fetch roles and positions
    role_member = (await session.execute(select(MemberRole).where(MemberRole.name == "MEMBER"))).scalars().first()
    positions = (await session.execute(select(PlayerPosition))).scalars().all()
    
    for i in range(50):
        fname = fake.first_name_male()
        lname = fake.last_name()
        
        m = Member(
            tenant_id=tenant.id,
            first_name=fname,
            last_name=lname,
            email=f"{fname.lower()}.{lname.lower()}_{i}@test.com",
            role_in_app=role_member.id if role_member else None,
            address=fake.address().replace('\n', ', '),
            city=fake.city(),
            photo_url=f"https://ui-avatars.com/api/?name={fname}+{lname}&background=random"
        )
        session.add(m)
        generated_players.append(m)
    
    await session.commit()
    
    # Assign to Team
    for m in generated_players:
        pos = random.choice(positions) if positions else None
        tm = TeamMember(
            team_id=team.id,
            member_id=m.id,
            role="PLAYER",
            jersey_number=random.randint(1, 99),
            position_id=pos.id if pos else None,
            season="2024-2025"
        )
        session.add(tm)
    
    await session.commit()
    members.extend(generated_players)
    logger.info(f"✅ Total members available for testing: {len(members)}")

    # 2. Create Test User Account linked to a real member
    # We take the first member (or look for a specific name if we knew it)
    target_member = members[0] 
    
    # Check if user already exists
    u_stmt = select(User).where(User.email == "joueur1@test.com")
    existing_user = (await session.execute(u_stmt)).scalars().first()
    
    if not existing_user:
        new_user = User(
            email="joueur1@test.com",
            password_hash=get_password_hash("joueur123"), # pwd: joueur123
            full_name=f"{target_member.first_name} {target_member.last_name}",
            is_active=True,
            is_superuser=False
        )
        session.add(new_user)
        await session.commit()
        await session.refresh(new_user)
        
        # Link Member
        target_member.user_id = new_user.id
        target_member.email = "joueur1@test.com" # Sync email
        
        # Ensure role
        # Assuming roles 1=ADMIN, 2=COACH, 3=MEMBER based on seed
        # Let's verify IDs or names
        # For simplicity, we assume roles exist (seeded by reference seed) or we fetch them
        r_stmt = select(MemberRole).where(MemberRole.name == "MEMBER")
        role_member = (await session.execute(r_stmt)).scalars().first()
        if role_member:
            target_member.role_in_app = role_member.id
            
        session.add(target_member)
        await session.commit()
        logger.info(f"✅ Created User 'joueur1@test.com' linked to Member {target_member.first_name} {target_member.last_name}")
    else:
        target_member = next(m for m in members if m.user_id == existing_user.id)
        logger.info(f"ℹ️ User 'joueur1@test.com' already exists linked to {target_member.first_name}")

    # 3. Create Matches (Events + Games)
    today = datetime.now()
    
    # 3. Populate History for Existing Matches (Imported)
    logger.info("🎮 Fetching existing played games to populate stats...")
    
    # Get Status/Type constants
    ST_PLAYED = 2 
    EVT_MATCH = 2
    PART_PRESENT = 2
    PART_ABSENT = 3
    PART_PENDING = 1
    ACTION_GOAL = 1
    ACTION_YELLOW = 2

    # Query imported games that are 'played' (have scores)
    stmt_games = select(Game).where(Game.tenant_id == tenant.id)
    all_games = (await session.execute(stmt_games)).scalars().all()
    
    played_games = [g for g in all_games if g.score_home is not None and g.score_away is not None]
    
    logger.info(f"ℹ️ Found {len(played_games)} played games to enrich.")

    for game in played_games:
        # Determine side (Home/Away)
        # Fetch all tenant teams to be sure
        all_tenant_teams_stmt = select(Team).where(Team.tenant_id == tenant.id)
        all_tenant_teams = (await session.execute(all_tenant_teams_stmt)).scalars().all()
        tenant_team_ids = [t.id for t in all_tenant_teams]
        
        is_home = False
        if game.home_team_id in tenant_team_ids:
            is_home = True
        elif game.away_team_id in tenant_team_ids:
            is_home = False
        else:
             # Fallback Name check
             if tenant.name.lower() in (game.home_team_name or "").lower() or "supremes" in (game.home_team_name or "").lower():
                 is_home = True
        
        score_us = game.score_home if is_home else game.score_away
        score_them = game.score_away if is_home else game.score_home
        
        # Retrieve or Create Event
        evt_stmt = select(Events).where(Events.game_id == game.id)
        evt = (await session.execute(evt_stmt)).scalars().first()
        
        if not evt:
            # Construct date
            match_dt = datetime.combine(game.date_match, datetime.min.time())
            if game.date_time:
                try:
                    hh, mm = map(int, game.date_time.split(':'))
                    match_dt = match_dt.replace(hour=hh, minute=mm)
                except:
                    pass
            
            evt = Events(
                tenant_id=tenant.id,
                type=EVT_MATCH,
                title=f"Match vs {game.away_team_name if is_home else game.home_team_name}",
                start_date=match_dt,
                end_date=match_dt + timedelta(hours=2),
                location=game.stadium or "Stade",
                game_id=game.id
            )
            session.add(evt)
            await session.commit()
            await session.refresh(evt)
            
        # Create Participations
        # Delete existing participations for this event to avoid duplicates during re-runs or re-seed
        await session.execute(text(f"DELETE FROM core.event_participation WHERE event_id = '{evt.id}'"))
        await session.execute(text(f"DELETE FROM core.game_timeline WHERE game_id = '{game.id}'"))
        await session.commit()

        user_status = PART_PRESENT if random.random() > 0.1 else PART_ABSENT
        
        p_self = EventParticipation(
            event_id=evt.id, member_id=target_member.id, tenant_id=tenant.id,
            status=user_status
        )
        session.add(p_self)

        # Teammates
        others = [mm for mm in members if mm.id != target_member.id]
        random.shuffle(others)
        present_teammates = []

        for teammate in others[:13]: # 14 players total
            session.add(EventParticipation(
                event_id=evt.id, member_id=teammate.id, tenant_id=tenant.id, status=PART_PRESENT
            ))
            present_teammates.append(teammate)
        
        await session.commit()

        # Generate Timeline (Goals/Cards)
        # 1. OUR GOALS
        all_present = list(present_teammates)
        if user_status == PART_PRESENT: 
            all_present.append(target_member)
            
        if all_present: 
            current_goals = int(score_us) if score_us else 0
            
            for _ in range(current_goals):
                scorer = random.choice(all_present)
                assister = None
                if random.random() > 0.5 and len(all_present) > 1:
                    cand = [p for p in all_present if p.id != scorer.id]
                    if cand: assister = random.choice(cand)
                
                session.add(GameTimeline(
                    game_id=game.id, tenant_id=tenant.id,
                    main_home_player_id=scorer.id if is_home else None,
                    main_away_player_id=scorer.id if not is_home else None,
                    assisting_home_player_id=assister.id if is_home and assister else None,
                    assisting_away_player_id=assister.id if not is_home and assister else None,
                    minute=random.randint(5, 89),
                    action_type_id=ACTION_GOAL
                ))

            # 2. OPPONENT GOALS (Dummy)
            # Create a shared dummy opponent member if not exists
            opp_goals = int(score_them) if score_them else 0
            if opp_goals > 0:
                 opp_stmt = select(Member).where(Member.last_name == "ADVERSE").limit(1)
                 opponent_member = (await session.execute(opp_stmt)).scalars().first()
                 if not opponent_member:
                      opponent_member = Member(
                          tenant_id=tenant.id, 
                          first_name="Joueur", 
                          last_name="ADVERSE", 
                          email="opponent@test.com"
                      )
                      session.add(opponent_member)
                      await session.commit()
                      await session.refresh(opponent_member)
                 
                 for _ in range(opp_goals):
                     session.add(GameTimeline(
                        game_id=game.id, tenant_id=tenant.id,
                        main_home_player_id=opponent_member.id if not is_home else None,
                        main_away_player_id=opponent_member.id if is_home else None,
                        minute=random.randint(5, 89),
                        action_type_id=ACTION_GOAL,
                        extra_data={"is_opponent": True}
                    ))

            # 3. Cards
            num_cards = random.choices([0, 1, 2], weights=[50, 40, 10])[0]
            for _ in range(num_cards):
                 offender = random.choice(all_present)
                 session.add(GameTimeline(
                     game_id=game.id, tenant_id=tenant.id,
                     main_home_player_id=offender.id if is_home else None,
                     main_away_player_id=offender.id if not is_home else None,
                     minute=random.randint(10, 89),
                     action_type_id=ACTION_YELLOW
                 ))
        
        await session.commit()

    # 4. Generate Other Events (Training, Meetings, etc.)
    logger.info("📅 Generating other events (Training, etc.)...")
    
    # Fetch available types excluding Matches/Tournaments
    excluded_names = ["MATCH", "GAME", "TOURNAMENT", "OTHER", "Match", "Tournoi", "Autre"]
    et_stmt = select(EventType).where(EventType.name.not_in(excluded_names))
    event_types = (await session.execute(et_stmt)).scalars().all()
    
    # Filter by ID if necessary (Match=2)
    types_to_use = [et for et in event_types if et.id != EVT_MATCH]
    
    # Fallback to Training if list empty
    if not types_to_use:
         tr_stmt = select(EventType).where(EventType.id == 1) # Assume 1 is Training
         tr = (await session.execute(tr_stmt)).scalars().first()
         if tr: types_to_use = [tr]
    
    last_future_evt_id = None
    
    if types_to_use:
        for et in types_to_use:
            logger.info(f"Creating events for type {et.name}...")
            # Create 5 past, 2 future
            offsets = [-20, -13, -7, -3, -1, 3, 10]
            
            for days in offsets:
                evt_date = datetime.now() + timedelta(days=days)
                evt_date = evt_date.replace(hour=19, minute=0, second=0, microsecond=0)
                
                # Check for duplicate
                existing_check = await session.execute(
                    select(Events).where(Events.start_date == evt_date).where(Events.type == et.id)
                )
                if existing_check.scalars().first(): continue

                new_evt = Events(
                    tenant_id=tenant.id,
                    type=et.id,
                    title=f"{et.name.capitalize()} - {evt_date.strftime('%d/%m')}",
                    start_date=evt_date,
                    end_date=evt_date + timedelta(hours=1.5),
                    location="Complexe Sportif",
                    description=f"Session de {et.name.lower()}"
                )
                session.add(new_evt)
                await session.commit()
                await session.refresh(new_evt)
                
                if days > 0: last_future_evt_id = new_evt.id
                
                # Add Participations
                status_self = PART_PRESENT
                if days < 0:
                     status_self = random.choice([PART_PRESENT, PART_ABSENT])
                else:
                     status_self = random.choice([PART_PENDING, PART_PRESENT])
                
                session.add(EventParticipation(
                    event_id=new_evt.id, member_id=target_member.id, tenant_id=tenant.id,
                    status=status_self
                ))
                
                # Others (random 15 teammates)
                others = [mm for mm in members if mm.id != target_member.id]
                random.shuffle(others)
                for teammate in others[:15]:
                    st = PART_PRESENT
                    if days > 0: st = PART_PENDING
                    elif random.random() > 0.8: st = PART_ABSENT
                    
                    session.add(EventParticipation(
                        event_id=new_evt.id, member_id=teammate.id, tenant_id=tenant.id,
                        status=st
                    ))
                
                await session.commit()

    # 5. Create Tasks
    if not last_future_evt_id:
        # Try fall back to a game id if no training generated
        try:
             if evt: last_future_evt_id = evt.id
        except:
             pass

    if last_future_evt_id:
        session.add(Task(
            tenant_id=tenant.id,
            event_id=last_future_evt_id,
            description="Laver les maillots",
            assigned_member_id=target_member.id,
            is_completed=False,
            type_id=1
        ))
    
    logger.info("✅ Seed Completed.")


async def main():
    logger.info("🔥 Starting Reinit & Seed Pipeline")
    
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # 1. Clean
        await clean_database(session)

        # 1b. Bootstrap Tenant (Required for Import linking)
        logger.info("🏢 Bootstrapping Tenant for Import linking...")
        tenant = Tenant(
            name="Supremes Beliers",
            slug="supremes-beliers",
            real_club_id=str(CLUB_ID_TO_IMPORT),
            primary_color="#0000FF"
        )
        session.add(tenant)
        await session.commit()
        await session.refresh(tenant)
        
        # 2. Trigger Import
        success = await trigger_import()
        if not success:
            logger.warning("Import trigger failed or API not reachable. Checking if data exists anyway...")
        
        # 3. Wait for Members (and verify Tenant linkage by worker)
        # We pass the locally created tenant.
        
        # 4. Seed Data
        if tenant:
            await seed_test_data(session, tenant)
        else:
            logger.error("❌ Cannot seed data without tenant.")

if __name__ == "__main__":
    asyncio.run(main())
