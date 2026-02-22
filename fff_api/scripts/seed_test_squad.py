import asyncio
import logging
from datetime import date
from faker import Faker
# from passlib.context import CryptContext # REMOVED
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker

from src.infrastructure.database.session import engine
from src.domain.models.saas import Tenant, User
from src.domain.models.core import Member, MemberRole, TeamMember, PlayerPosition
from src.domain.models.reference import Team
from src.core.security import get_password_hash # IMPORTED

# Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
fake = Faker('fr_FR')
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") # REMOVED

# def get_password_hash(password): # REMOVED
#    return pwd_context.hash(password)

async def seed_test_squad():
    async with engine.begin() as conn:
         async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
         )
         
         async with async_session() as session:
            # 1. Create or Get Tenant
            club_name = "FC Test Complet"
            slug = "fc-test-full"
            tenant_q = await session.exec(select(Tenant).where(Tenant.slug == slug))
            tenant = tenant_q.first()
            
            if not tenant:
                tenant = Tenant(
                    name=club_name,
                    slug=slug,
                    primary_color="#1d4ed8", # Blue-600
                    created_at=date.today()
                )
                session.add(tenant)
                await session.commit()
                await session.refresh(tenant)
                logger.info(f"Created Tenant: {tenant.name} ({tenant.id})")
            else:
                logger.info(f"Using existing Tenant: {tenant.name} ({tenant.id})")

            # 2. Roles
            roles = {}
            for role_name in ["ADMIN", "COACH", "MEMBER"]:
                res = await session.exec(select(MemberRole).where(MemberRole.name == role_name))
                r = res.first()
                if not r:
                     r = MemberRole(name=role_name)
                     session.add(r)
                roles[role_name] = r
            await session.commit()
            
            # Re-fetch roles with IDs
            for role_name in ["ADMIN", "COACH", "MEMBER"]:
                 res = await session.exec(select(MemberRole).where(MemberRole.name == role_name))
                 roles[role_name] = res.first()

            # 2b. Positions and Team
            # Ensure stats for positions exist
            positions_map = {}
            for code in ["GK", "DEF", "MID", "FWD"]:
                res_p = await session.exec(select(PlayerPosition).where(PlayerPosition.code == code))
                p_obj = res_p.first()
                if not p_obj:
                    p_obj = PlayerPosition(name=code, code=code)
                    session.add(p_obj)
                    await session.commit()
                    await session.refresh(p_obj)
                positions_map[code] = p_obj.id

            # Create Main Team
            team_res = await session.exec(select(Team).where(Team.name == "Equipe Première", Team.tenant_id == tenant.id))
            team = team_res.first()
            if not team:
                team = Team(
                    name="Equipe Première", 
                    tenant_id=tenant.id, 
                    category="SENIOR", 
                    gender="M", 
                    code=1
                )
                session.add(team)
                await session.commit()
                await session.refresh(team)
            
            # 3. Create Users & Members
            
            users_to_create = [
                {
                    "email": "president@test.com", "pass": "admin123", "role": "ADMIN",
                    "first": "Jean", "last": "President", "address": "10 Rue du Stade",
                    "admin_data": True
                },
                {
                    "email": "coach@test.com", "pass": "coach123", "role": "COACH",
                    "first": "Michel", "last": "Coach", "address": "12 Avenue des Sports",
                    "admin_data": True,
                    "is_squad": True, # Is part of squad (staff)
                    "position": "COACH" # Logic to handle this
                },
                # Players will be generated below
            ]
             
            # Generate 15 players
            for i in range(1, 16):
                users_to_create.append({
                    "email": f"joueur{i}@test.com", "pass": "joueur123", "role": "MEMBER",
                    "first": fake.first_name_male(), "last": fake.last_name(), 
                    "address": fake.address().replace('\n', ', '),
                    "admin_data": True,
                    "is_player": True,
                    "is_squad": True,
                    "position": ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD"][i % 11]
                })

            created_accounts = []

            for u_data in users_to_create:
                # Check User existence
                u_res = await session.exec(select(User).where(User.email == u_data["email"]))
                user = u_res.first()
                if not user:
                    user = User(
                        email=u_data["email"],
                        password_hash=get_password_hash(u_data["pass"]),
                        full_name=f"{u_data['first']} {u_data['last']}"
                    )
                    session.add(user)
                    await session.commit()
                    await session.refresh(user)
                
                # Check Member existence
                m_res = await session.exec(select(Member).where(Member.user_id == user.id))
                member = m_res.first()
                if not member:
                    role_obj = roles.get(u_data["role"], roles["MEMBER"])
                    member = Member(
                        tenant_id=tenant.id,
                        user_id=user.id,
                        first_name=u_data["first"],
                        last_name=u_data["last"],
                        email=u_data["email"],
                        role_in_app=role_obj.id,
                        # Addresses
                        address=u_data.get("address"),
                        city="Paris", 
                        postal_code="75001",
                        country="France",
                        # Admin
                        medical_certificate_date=date(2025, 9, 1),
                        contribution_status="PAID" if i % 2 == 0 else "PARTIAL",
                        clothing_size="L",
                        photo_url=f"https://ui-avatars.com/api/?name={u_data['first']}+{u_data['last']}&background=random"
                    )
                    session.add(member)
                    await session.commit()
                    await session.refresh(member)
                    
                    # If Player/Squad, create Team Association (Mock Team)
                    if u_data.get("is_squad"):
                         # Check if already linked
                         tm_stmt = select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.member_id == member.id)
                         tm_res = await session.exec(tm_stmt)
                         if not tm_res.first():
                            pos_id = positions_map.get(u_data.get("position"), None)
                            tm = TeamMember(
                                team_id=team.id, 
                                member_id=member.id,
                                role="PLAYER" if u_data.get("is_player") else "COACH",
                                position_id=pos_id,
                                jersey_number=i if u_data.get("is_player") else None
                            )
                            session.add(tm)
                            await session.commit()
                
                created_accounts.append(f"| {u_data['first']} {u_data['last']} | {u_data['role']} | {u_data['email']} | {u_data['pass']} |")

            print("\n=== COMPTES CRÉÉS POUR TEST ===")
            print("| Nom | Rôle | Email | Mot de passe |")
            print("|---|---|---|---|")
            for line in created_accounts:
                print(line)
            print("===============================\n")

if __name__ == "__main__":
    asyncio.run(seed_test_squad())
