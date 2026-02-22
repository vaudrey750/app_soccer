import pytest
import uuid
from datetime import date
from sqlmodel import select, SQLModel
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from src.infrastructure.database.session import init_db, engine
from src.domain.models.reference import Team, Game, Club, Competition, Season
from src.domain.models.core import Member, MemberRole, TeamMember, Events, GameStatus
from src.domain.models.sport import MatchLineup, Formation, FormationPosition
from src.domain.models.saas import User, Tenant
from src.application.use_cases.teams.get_team_stats import GetTeamStatsUseCase
from src.application.use_cases.teams.get_teams import GetTeamsUseCase
from src.application.use_cases.matches.get_match_lineup import GetMatchLineupUseCase
from src.application.use_cases.matches.update_match_lineup import UpdateMatchLineupUseCase
from src.application.use_cases.teams.update_team_members import UpdateTeamMembersUseCase
from src.application.use_cases.competitions.get_competitions_with_games import GetCompetitionsWithGamesUseCase
from src.application.use_cases.formations.get_formations import GetFormationsUseCase
from src.application.use_cases.formations.get_formation_details import GetFormationDetailsUseCase
from src.application.use_cases.teams.get_team_details import GetTeamDetailsUseCase
from src.application.use_cases.competitions.get_competition_details import GetCompetitionDetailsUseCase

@pytest.fixture(scope="session")
async def db_engine():
    await init_db()
    yield engine
    async with engine.begin() as conn:
         await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine):
    async_session = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session

@pytest.mark.asyncio
class TestGetTeamStatsUseCase:
    
    async def test_execute_found(self, db_session):
        # Setup
        # Create Game Statuses if needed for Foreign Key constraints
        statuses = [
            GameStatus(id=1, name="SCHEDULED"),
            GameStatus(id=2, name="PLAYED")
        ]
        for s in statuses:
             exist = await db_session.get(GameStatus, s.id)
             if not exist:
                 db_session.add(s)
        await db_session.flush()

        tenant_id = uuid.uuid4()
        other_tenant_id = uuid.uuid4()
        
        tenant = Tenant(id=tenant_id, name=f"My Tenant {uuid.uuid4()}", slug=f"mytenant-{uuid.uuid4()}")
        other_tenant = Tenant(id=other_tenant_id, name=f"Other Tenant {uuid.uuid4()}", slug=f"othertenant-{uuid.uuid4()}")
        
        db_session.add(tenant)
        db_session.add(other_tenant)
        await db_session.flush()

        team_id = uuid.uuid4()
        other_team_id = uuid.uuid4()
        
        team = Team(id=team_id, name="My Team", tenant_id=tenant_id, category="Senior")
        other_team = Team(id=other_team_id, name="Other Team", tenant_id=other_tenant_id, category="Senior")
        
        db_session.add(team)
        db_session.add(other_team)
        await db_session.flush()
        
        # Add Games
        # Game 1: My Team (Home) vs Other (Away) - Win 2-1
        game1 = Game(
            id=uuid.uuid4(), date_match=date(2023, 1, 1),
            home_team_id=team_id, away_team_id=other_team_id,
            score_home=2, score_away=1, status=2,
            tenant_id=tenant_id 
        )
        # Game 2: Other (Home) vs My Team (Away) - Draw 1-1
        game2 = Game(
            id=uuid.uuid4(), date_match=date(2023, 1, 8),
            home_team_id=other_team_id, away_team_id=team_id,
            score_home=1, score_away=1, status=2,
            tenant_id=tenant_id 
        )
        
        db_session.add(game1)
        db_session.add(game2)
        await db_session.commit()
        
        # Execute
        use_case = GetTeamStatsUseCase(db_session)
        stats = await use_case.execute(team_id)
        
        # Verify
        assert stats is not None
        assert stats["played"] == 2
        assert stats["won"] == 1
        assert stats["drawn"] == 1
        assert stats["lost"] == 0
        assert stats["goals_for"] == 3 # 2 + 1
        assert stats["goals_against"] == 2 # 1 + 1

    async def test_execute_not_found(self, db_session):
        use_case = GetTeamStatsUseCase(db_session)
        stats = await use_case.execute(uuid.uuid4())
        assert stats is None


@pytest.mark.asyncio
class TestGetTeamsUseCase:
    
    async def _get_or_create_role(self, db_session, name):
        result = await db_session.execute(select(MemberRole).where(MemberRole.name == name))
        role = result.scalar_one_or_none()
        if not role:
            role = MemberRole(id=uuid.uuid4(), name=name)
            db_session.add(role)
            await db_session.flush()
        return role

    async def test_execute_admin(self, db_session):
        # Setup
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name=f"Admin Tenant {uuid.uuid4()}", slug=f"admintenant-{uuid.uuid4()}")
        
        user = User(id=uuid.uuid4(), email=f"admin-{uuid.uuid4()}@test.com", password_hash="pw")
        
        db_session.add(tenant)
        db_session.add(user)
        await db_session.flush()

        role = await self._get_or_create_role(db_session, "ADMIN")

        member = Member(
            id=uuid.uuid4(), user_id=user.id, tenant_id=tenant_id, role_in_app=role.id,
            first_name="Admin", last_name="User"
        )
        
        team1 = Team(id=uuid.uuid4(), name="Team A", tenant_id=tenant_id, category="A")
        team2 = Team(id=uuid.uuid4(), name="Team B", tenant_id=tenant_id, category="B")
        
        db_session.add(member)
        db_session.add(team1)
        db_session.add(team2)
        
        # Other tenant/team
        other_tenant_id = uuid.uuid4()
        other_tenant = Tenant(id=other_tenant_id, name=f"Other Tenant 2 {uuid.uuid4()}", slug=f"other2-{uuid.uuid4()}")
        db_session.add(other_tenant)
        await db_session.flush()

        team_other = Team(id=uuid.uuid4(), name="Other", tenant_id=other_tenant_id, category="A")
        db_session.add(team_other)
        
        await db_session.commit()
        
        # Execute
        use_case = GetTeamsUseCase(db_session)
        teams = await use_case.execute(user)
        
        # Verify
        assert len(teams) == 2
        names = {t["name"] for t in teams}
        assert "Team A" in names
        assert "Team B" in names

    async def test_execute_member_filtered(self, db_session):
        # Setup
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name=f"Member Tenant {uuid.uuid4()}", slug=f"membertenant-{uuid.uuid4()}")
        
        user = User(id=uuid.uuid4(), email=f"user-{uuid.uuid4()}@test.com", password_hash="pw")
        
        db_session.add(tenant)
        db_session.add(user)
        await db_session.flush()

        role = await self._get_or_create_role(db_session, "MEMBER")
        
        member = Member(
            id=uuid.uuid4(), user_id=user.id, tenant_id=tenant_id, role_in_app=role.id,
            first_name="Normal", last_name="User"
        )
        
        team1 = Team(id=uuid.uuid4(), name="Team A", tenant_id=tenant_id, category="A")
        team2 = Team(id=uuid.uuid4(), name="Team B", tenant_id=tenant_id, category="B")
        
        db_session.add(member)
        db_session.add(team1)
        db_session.add(team2)
        await db_session.flush()
        
        # Member only belongs to Team A
        tm = TeamMember(id=uuid.uuid4(), team_id=team1.id, member_id=member.id, role="PLAYER")
        db_session.add(tm)
        
        await db_session.commit()
        
        # Execute
        use_case = GetTeamsUseCase(db_session)
        teams = await use_case.execute(user)
        
        # Verify
        assert len(teams) == 1
        assert teams[0]["name"] == "Team A"

@pytest.mark.asyncio
class TestMatchLineupUseCases:
    
    async def _setup_formation(self, db_session):
        # Create formation 4-4-2 if not exists
        stmt = select(Formation).where(Formation.id == 1)
        res = await db_session.execute(stmt)
        fmt = res.scalar_one_or_none()
        
        if not fmt:
            fmt = Formation(id=1, name="4-4-2")
            db_session.add(fmt)
            await db_session.flush()
            
            # Add positions
            pos1 = FormationPosition(id=1, formation_id=1, role="G", coord_x=50, coord_y=90, position_label="GK", priority=1)
            pos2 = FormationPosition(id=2, formation_id=1, role="D", coord_x=20, coord_y=70, position_label="LB", priority=2)
            db_session.add(pos1)
            db_session.add(pos2)
            await db_session.flush()
            
        return fmt

    async def test_get_and_update_lineup(self, db_session):
        # Setup
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name=f"Lineup Tenant {uuid.uuid4()}", slug=f"l-tenant-{uuid.uuid4()}")
        db_session.add(tenant)
        await db_session.flush()

        user = User(id=uuid.uuid4(), email=f"coach-{uuid.uuid4()}@test.com", password_hash="pw")
        db_session.add(user)
        # Create Role
        result = await db_session.execute(select(MemberRole).where(MemberRole.name == "COACH"))
        role = result.scalar_one_or_none()
        if not role:
             role = MemberRole(id=uuid.uuid4(), name="COACH")
             db_session.add(role)
             await db_session.flush()

        member = Member(id=uuid.uuid4(), tenant_id=tenant_id, user_id=user.id, first_name="Coach", last_name="C", role_in_app=role.id)
        db_session.add(member)
        await db_session.flush()
        
        # Event
        # NOTE: EventType must exist usually, referencing core.event_type.id
        # We might need to ensure EventType(id=1) exists
        # Let's just create event and hope type FK is not strict or type 1 exists from previous tests or migrations? 
        # Actually in seed_types.py 1 is MATCH. 
        # But we need to ensure it is in DB if tests run on clean DB.
        
        # Check event type 1
        from src.domain.models.core import EventType
        res_type = await db_session.get(EventType, 1)
        if not res_type:
             db_session.add(EventType(id=1, name="MATCH"))
             await db_session.flush()

        event = Events(id=uuid.uuid4(), tenant_id=tenant_id, type=1, start_date=date.today())
        db_session.add(event)
        
        formation = await self._setup_formation(db_session)
        await db_session.commit()
        
        # Test 1: Get Empty Lineup
        get_uc = GetMatchLineupUseCase(db_session)
        res = await get_uc.execute(event.id)
        assert res is not None
        assert res["event_id"] == event.id
        assert len(res["items"]) == 0
        
        # Test 2: Update Lineup
        update_uc = UpdateMatchLineupUseCase(db_session)
        items_in = [{"position_id": 1, "member_id": member.id}]
        
        res_update = await update_uc.execute(event.id, formation.id, items_in)
        assert res_update is not None
        assert res_update["formation"].id == formation.id
        assert len(res_update["items"]) == 1
        assert res_update["items"][0]["member_id"] == member.id
        
        # Test 3: Get Filled Lineup
        res_get_filled = await get_uc.execute(event.id)
        assert res_get_filled is not None
        assert len(res_get_filled["items"]) == 1
        assert res_get_filled["items"][0]["member_name"] == "Coach C"

@pytest.mark.asyncio
class TestCompetitionUseCases:
    async def test_get_competitions_with_games(self, db_session):
        # Setup Tenant & User
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name=f"Comp Tenant {uuid.uuid4()}", slug=f"c-tenant-{uuid.uuid4()}")
        db_session.add(tenant)
        await db_session.flush()

        user = User(id=uuid.uuid4(), email=f"comp-user-{uuid.uuid4()}@test.com", password_hash="pw")
        db_session.add(user)
        # Create Role
        result = await db_session.execute(select(MemberRole).where(MemberRole.name == "COACH"))
        role = result.scalar_one_or_none()
        if not role:
             role = MemberRole(id=uuid.uuid4(), name="COACH")
             db_session.add(role)
             await db_session.flush()

        member = Member(id=uuid.uuid4(), tenant_id=tenant_id, user_id=user.id, first_name="Comp", last_name="User", role_in_app=role.id)
        db_session.add(member)
        await db_session.flush()
        
        # Setup Competition
        comp = Competition(id=uuid.uuid4(), name="D1 Senior")
        db_session.add(comp)
        await db_session.flush()
        
        # Setup Season
        season = await db_session.get(Season, "2024-2025")
        if not season:
            season = Season(name="2024-2025", start_date=date(2024, 7, 1), end_date=date(2025, 6, 30))
            db_session.add(season)
            await db_session.flush()

        # Setup Games
        # Needs GameStatus
        game_status = await db_session.get(GameStatus, 1)
        if not game_status:
             db_session.add(GameStatus(id=1, name="SCHEDULED"))
             await db_session.flush()
             
        # Game 1: Linked to Tenant (should be found)
        game1 = Game(
            id=uuid.uuid4(), 
            tenant_id=tenant_id, 
            competition_id=comp.id, 
            date_match=date.today(),
            season="2024-2025"
        )
        db_session.add(game1)
        
        # Game 2: Linked to ANOTHER Tenant (should NOT be found)
        other_tenant_id = uuid.uuid4()
        db_session.add(Tenant(id=other_tenant_id, name="Other", slug=f"other-{uuid.uuid4()}"))
        await db_session.flush()
        game2 = Game(
            id=uuid.uuid4(), 
            tenant_id=other_tenant_id, 
            competition_id=comp.id, 
            date_match=date.today(),
            season="2024-2025"
        )
        db_session.add(game2)
        
        await db_session.commit()
        
        # Execute Use Case
        use_case = GetCompetitionsWithGamesUseCase(db_session)
        res = await use_case.execute(user)
        
        assert res is not None
        assert len(res) == 1
        assert res[0]["competition"].id == comp.id
        assert len(res[0]["games"]) == 1
        assert res[0]["games"][0].id == game1.id

    async def test_get_competition_details(self, db_session):
        # Setup Competition
        comp_id = uuid.uuid4()
        comp = Competition(id=comp_id, name="Details Comp")
        db_session.add(comp)
        await db_session.flush()
        
        # Setup Season
        season_name = "2025-2026"
        season = await db_session.get(Season, season_name)
        if not season:
            season = Season(name=season_name, start_date=date(2025, 7, 1), end_date=date(2026, 6, 30))
            db_session.add(season)
            await db_session.flush()

        # Setup Game
        # We need a tenant for the game constraint (if strict)
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="Details Tenant", slug=f"d-tenant-{uuid.uuid4()}")
        db_session.add(tenant)
        await db_session.flush()

        game = Game(
            id=uuid.uuid4(), 
            tenant_id=tenant_id, 
            competition_id=comp_id, 
            date_match=date.today(),
            season=season_name
        )
        db_session.add(game)
        await db_session.commit()
        
        # Execute Use Case
        use_case = GetCompetitionDetailsUseCase(db_session)
        res = await use_case.execute(comp_id, season=season_name)
        
        assert res is not None
        assert res["competition"].id == comp_id
        assert len(res["games"]) == 1
        assert res["games"][0].id == game.id


@pytest.mark.asyncio
class TestTeamMemberUseCases:
    async def test_update_team_members(self, db_session):
        # Setup Tenant & User
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name=f"TM Update Tenant {uuid.uuid4()}", slug=f"tm-tenant-{uuid.uuid4()}")
        db_session.add(tenant)
        await db_session.flush()

        user = User(id=uuid.uuid4(), email=f"tm-user-{uuid.uuid4()}@test.com", password_hash="pw")
        db_session.add(user)
        
        # Create Role
        result = await db_session.execute(select(MemberRole).where(MemberRole.name == "COACH"))
        role = result.scalar_one_or_none()
        if not role:
             role = MemberRole(id=uuid.uuid4(), name="COACH")
             db_session.add(role)
             await db_session.flush()

        # Manager Member (Current User)
        manager_member = Member(id=uuid.uuid4(), tenant_id=tenant_id, user_id=user.id, first_name="Manager", last_name="M", role_in_app=role.id)
        db_session.add(manager_member)
        await db_session.flush()
        
        # Team
        team = Team(id=uuid.uuid4(), tenant_id=tenant_id, name="Update Team", category="Seniors")
        db_session.add(team)
        await db_session.flush()
        
        # Player to Add
        player_member = Member(id=uuid.uuid4(), tenant_id=tenant_id, first_name="Player", last_name="P")
        db_session.add(player_member)
        await db_session.flush()
        
        # Pre-existing member (to be removed)
        old_member = Member(id=uuid.uuid4(), tenant_id=tenant_id, first_name="Old", last_name="O")
        db_session.add(old_member)
        await db_session.flush()
        
        db_session.add(TeamMember(team_id=team.id, member_id=old_member.id, role="PLAYER"))
        await db_session.commit()
        
        # Execute Use Case
        use_case = UpdateTeamMembersUseCase(db_session)
        
        # Update: Remove 'old_member', Add 'player_member'
        updates = [{"member_id": player_member.id, "role": "PLAYER", "position_id": None}]
        
        res = await use_case.execute(user, team.id, updates)
        
        assert res["status"] == "success"
        
        # Verify in DB
        stmt = select(TeamMember).where(TeamMember.team_id == team.id)
        r = await db_session.execute(stmt)
        members = r.scalars().all()
        
        assert len(members) == 1
        assert members[0].member_id == player_member.id
        assert members[0].role == "PLAYER"

@pytest.mark.asyncio
class TestFormationUseCases:
    
    async def _setup_formation(self, db_session, f_id=1, name="4-4-2"):
        # Create formation
        stmt = select(Formation).where(Formation.id == f_id)
        res = await db_session.execute(stmt)
        fmt = res.scalar_one_or_none()
        
        if not fmt:
            fmt = Formation(id=f_id, name=name)
            db_session.add(fmt)
            await db_session.flush()
            
            # Add positions
            pos1 = FormationPosition(id=f_id*10+1, formation_id=f_id, role="G", coord_x=50, coord_y=90, position_label="GK", priority=1)
            pos2 = FormationPosition(id=f_id*10+2, formation_id=f_id, role="D", coord_x=20, coord_y=70, position_label="LB", priority=2)
            db_session.add(pos1)
            db_session.add(pos2)
            await db_session.flush()
            
        return fmt

    async def test_get_formations(self, db_session):
        await self._setup_formation(db_session, 10, "4-3-3")
        await db_session.commit()
        
        use_case = GetFormationsUseCase(db_session)
        res = await use_case.execute()
        
        assert len(res) >= 1
        # Find the one we created
        found = next((f for f in res if f.id == 10), None)
        assert found is not None
        assert found.name == "4-3-3"
        # Check preloading
        assert len(found.positions) == 2

    async def test_get_formation_details(self, db_session):
        await self._setup_formation(db_session, 20, "3-5-2")
        await db_session.commit()
        
        use_case = GetFormationDetailsUseCase(db_session)
        res = await use_case.execute(20)
        
        assert res is not None
        assert res["formation"].id == 20
        assert len(res["positions"]) == 2
        
        # Test Not Found
        res_none = await use_case.execute(999)
        assert res_none is None

@pytest.mark.asyncio
class TestTeamDetailsUseCase:
    async def test_get_team_details(self, db_session):
        # Setup Tenant
        tenant_id = uuid.uuid4()
        tenant = Tenant(id=tenant_id, name="TD Tenant", slug=f"td-{uuid.uuid4()}")
        db_session.add(tenant)
        await db_session.flush()

        # Setup User & Member
        user = User(id=uuid.uuid4(), email=f"td-user-{uuid.uuid4()}@test.com", password_hash="pw")
        db_session.add(user)
        
        # Role
        result = await db_session.execute(select(MemberRole).where(MemberRole.name == "COACH"))
        role = result.scalar_one_or_none()
        if not role:
             role = MemberRole(id=uuid.uuid4(), name="COACH")
             db_session.add(role)
             await db_session.flush()

        manager = Member(id=uuid.uuid4(), tenant_id=tenant_id, user_id=user.id, first_name="Manager", last_name="M", role_in_app=role.id)
        db_session.add(manager)
        await db_session.flush()

        # Team
        team = Team(id=uuid.uuid4(), tenant_id=tenant_id, name="Details Team", category="Seniors")
        db_session.add(team)
        await db_session.flush()

        # Add Players and Staff
        p1 = Member(id=uuid.uuid4(), tenant_id=tenant_id, first_name="P1", last_name="Player")
        s1 = Member(id=uuid.uuid4(), tenant_id=tenant_id, first_name="S1", last_name="Staff")
        db_session.add(p1)
        db_session.add(s1)
        await db_session.flush()
        
        db_session.add(TeamMember(team_id=team.id, member_id=p1.id, role="PLAYER"))
        db_session.add(TeamMember(team_id=team.id, member_id=s1.id, role="COACH"))
        
        await db_session.commit()
        
        # Execute
        use_case = GetTeamDetailsUseCase(db_session)
        res = await use_case.execute(user, team.id)
        
        assert res is not None
        assert res["name"] == "Details Team"
        assert len(res["players"]) == 1
        assert res["players"][0]["first_name"] == "P1"
        assert len(res["staff"]) == 1
        assert res["staff"][0]["first_name"] == "S1"
        
        # Test Unauthorized
        other_user = User(id=uuid.uuid4(), email=f"other-{uuid.uuid4()}@test.com", password_hash="pw")
        db_session.add(other_user)
        await db_session.commit()
        
        res_auth = await use_case.execute(other_user, team.id)
        assert res_auth is not None
        assert "error" in res_auth
