import asyncio
import logging
from src.infrastructure.database.session import engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from src.domain.models.saas import Tenant, User
from src.domain.models.core import Member, MemberRole
from src.core.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def add_president():
    async with engine.begin() as conn:
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with async_session() as session:
            # 1. Get Tenant
            # We try to get the one used in seed_test_squad, or the first one
            tenant_q = await session.exec(select(Tenant))
            tenant = tenant_q.first()
            
            if not tenant:
                logger.error("No tenant found. Please run seed_test_squad.py first.")
                return

            logger.info(f"Using Tenant: {tenant.name} ({tenant.id})")

            # 2. Get or Create PRESIDENT Role
            role_q = await session.exec(select(MemberRole).where(MemberRole.name == "PRESIDENT"))
            role = role_q.first()
            if not role:
                logger.info("Creating PRESIDENT role...")
                role = MemberRole(name="PRESIDENT")
                session.add(role)
                await session.commit()
                await session.refresh(role)
            
            logger.info(f"Role PRESIDENT ID: {role.id}")

            # 3. Create User
            email = "president@club.com"
            user_q = await session.exec(select(User).where(User.email == email))
            user = user_q.first()
            
            if not user:
                logger.info("Creating President User...")
                user = User(
                    email=email,
                    password_hash=get_password_hash("password"),
                    full_name="Jean Michel Aulas",
                    # is_active=True, # NOT present in model definition I just saw
                    # is_superuser=False, # NOT present in model definition
                    # tenant_id=tenant.id # NOT present? Let me check again
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
            else:
                logger.info("President User already exists.")

            # 4. Create Member
            member_q = await session.exec(select(Member).where(Member.user_id == user.id))
            member = member_q.first()
            
            if not member:
                logger.info("Creating President Member...")
                member = Member(
                    user_id=user.id,
                    tenant_id=tenant.id,
                    role_in_app=role.id,
                    first_name="Jean Michel",
                    last_name="Aulas",
                    email=email,
                    photo_url="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Jean-Michel_Aulas_2018.jpg/640px-Jean-Michel_Aulas_2018.jpg"
                )
                session.add(member)
                await session.commit()
                logger.info("President Member created successfully!")
            else:
                # Update role if needed
                if member.role_in_app != role.id:
                    member.role_in_app = role.id
                    session.add(member)
                    await session.commit()
                    logger.info("Updated President Member role.")
                else:
                    logger.info("President Member already exists and has correct role.")

if __name__ == "__main__":
    asyncio.run(add_president())
