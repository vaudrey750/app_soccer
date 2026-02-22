from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.domain.models.reference import Club, League
from src.domain.models.saas import Tenant, User
from src.services.processors.base import BaseProcessor
from src.core.security import get_password_hash
import logging
import uuid

logger = logging.getLogger(__name__)

class ClubProcessor(BaseProcessor):
    
    async def process_clubs(self, 
                          clubs_data: List[Club], 
                          raw_club_json: dict, 
                          federation_id: int) -> Optional[Club]:
        """
        Process a list of Club objects (usually just one main club).
        Returns the main persisted Club object (the one matching the file context).
        Also propagates tenant_id linkage if applicable.
        """
        club_db_obj = None
        
        # 1. Extract and Upsert League/District
        league_id = await self._upsert_league(raw_club_json.get("district"), federation_id)
        
        for club in clubs_data:
            existing_club = await self._find_club(club.real_club_id)
            
            # --- SaaS Linkage ---
            # Try to find a Tenant linked to this real_club_id
            tenant_id = await self._find_tenant_id_for_club(club.real_club_id)
            
            if not existing_club:
                logger.info(f"Inserting new club: {club.name} (ID: {club.real_club_id}) | Linked Tenant: {tenant_id}")
                club.league_id = league_id
                club.tenant_id = tenant_id # Link to SaaS if exists
                self.session.add(club)
                await self.session.flush()
                club_db_obj = club
                await self._ensure_president_user(club)
            else:
                existing_club.name = club.name
                existing_club.logo_url = club.logo_url
                existing_club.affiliation_number = club.affiliation_number
                existing_club.league_id = league_id
                
                # Update president info
                existing_club.president_email = club.president_email
                existing_club.president_first_name = club.president_first_name
                existing_club.president_last_name = club.president_last_name
                
                # If a tenant was found separately or manually linked, we ensure consistency,
                # but we usually don't overwrite if existing_club.tenant_id is already set, 
                # unless we want to enforce the mapping from the Tenant table.
                if tenant_id:
                     existing_club.tenant_id = tenant_id

                self.session.add(existing_club)
                await self.session.flush()
                club_db_obj = existing_club
                await self._ensure_president_user(existing_club)
                
        return club_db_obj

    async def _upsert_league(self, district_data: dict, federation_id: int) -> Optional[int]:
        if not district_data or not district_data.get("cg_no"):
            return None
            
        cg_no = str(district_data.get("cg_no"))
        stmt = select(League).where(League.real_league_id == cg_no)
        res = await self.session.execute(stmt)
        existing = res.scalars().first()
        
        if not existing:
            new_league = League(
                real_league_id=cg_no,
                name=district_data.get("name"),
                federation_id=federation_id
            )
            self.session.add(new_league)
            await self.session.flush()
            return new_league.id
        return existing.id

    async def _find_club(self, real_club_id: str) -> Optional[Club]:
        stmt = select(Club).where(Club.real_club_id == real_club_id)
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def _find_tenant_id_for_club(self, real_club_id: str) -> Optional[str]:
        """Finds if a Tenant claims this FFF Club ID"""
        stmt = select(Tenant.id).where(Tenant.real_club_id == real_club_id)
        res = await self.session.execute(stmt)
        return res.scalars().first()

    async def _ensure_president_user(self, club: Club):
        """
        Creates a User account for the president if it doesn't exist.
        This allows validating that the account creator is indeed the president.
        """
        if not club.president_email:
            return

        stmt = select(User).where(User.email == club.president_email)
        res = await self.session.execute(stmt)
        user = res.scalars().first()
        
        if not user:
            logger.info(f"Creating User account for President: {club.president_email}")
            # Create random password (user will need to reset or claim account)
            pwd = str(uuid.uuid4())
            pwd_hash = get_password_hash(pwd)
            
            full_name = f"{club.president_first_name or ''} {club.president_last_name or ''}".strip()
            
            new_user = User(
                email=club.president_email,
                password_hash=pwd_hash,
                full_name=full_name if full_name else None
            )
            self.session.add(new_user)
            await self.session.flush()
