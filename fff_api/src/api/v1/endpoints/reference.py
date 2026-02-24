from typing import List, Optional
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, cast, String
from pydantic import BaseModel, EmailStr

from src.infrastructure.database.session import get_session
from src.domain.models.fff_club import FFFAllClubs
from src.domain.models.reference import Club, Season
from src.domain.models.saas import Tenant, User
from src.domain.models.core import Member, MemberRole
from src.api.deps import get_current_active_user

router = APIRouter()


def _compute_default_season_name(now: datetime) -> str:
    """Saison = année de début (ex: "2025"), démarre en septembre."""
    year = now.year
    if now.month < 9:
        year -= 1
    return str(year)


def _parse_season_start_year(season_name: str) -> Optional[int]:
    raw = (season_name or "").strip()
    if not raw:
        return None

    # Accept both "2025" and "2025-2026".
    if raw.isdigit() and len(raw) == 4:
        return int(raw)
    if "-" in raw:
        head = raw.split("-", 1)[0].strip()
        if head.isdigit() and len(head) == 4:
            return int(head)
    return None


def _default_season_dates(season_name: str) -> tuple[Optional[date], Optional[date]]:
    start_year = _parse_season_start_year(season_name)
    if not start_year:
        return None, None
    # Convention club foot: Sept -> Juin
    return date(start_year, 9, 1), date(start_year + 1, 6, 30)


async def _resolve_tenant_context(
    session: AsyncSession,
    current_user: User,
) -> tuple[Tenant, str]:
    stmt = (
        select(Member, MemberRole, Tenant)
        .join(MemberRole, Member.role_in_app == MemberRole.id, isouter=True)
        .join(Tenant, Tenant.id == Member.tenant_id)
        .where(Member.user_id == current_user.id)
    )
    row = (await session.execute(stmt)).first()
    if not row:
        raise ValueError("User is not a member of any tenant")
    member, role_rec, tenant = row
    role_name = role_rec.name if role_rec else "MEMBER"
    return tenant, role_name


async def _ensure_tenant_active_season(session: AsyncSession, tenant: Tenant) -> Season:
    now = datetime.now()
    season_name = tenant.active_season_name or _compute_default_season_name(now)

    stmt_season = select(Season).where(Season.name == season_name)
    season = (await session.execute(stmt_season)).scalars().first()
    if not season:
        start_date, end_date = _default_season_dates(season_name)
        season = Season(name=season_name, start_date=start_date, end_date=end_date, is_active=False)
        session.add(season)
        await session.commit()
        await session.refresh(season)

    # Assign default active season on the tenant if missing.
    if tenant.active_season_name != season.name:
        tenant.active_season_name = season.name
        session.add(tenant)
        await session.commit()
        await session.refresh(tenant)

    # Fill default dates if empty (best-effort).
    if not season.start_date or not season.end_date:
        start_date, end_date = _default_season_dates(season.name)
        changed = False
        if not season.start_date and start_date:
            season.start_date = start_date
            changed = True
        if not season.end_date and end_date:
            season.end_date = end_date
            changed = True
        if changed:
            session.add(season)
            await session.commit()
            await session.refresh(season)

    return season

class ClubSearchResponse(BaseModel):
    id: str
    label: str

class PresidentCheckRequest(BaseModel):
    real_club_id: str
    email: EmailStr

class PresidentCheckResponse(BaseModel):
    is_president: bool
    details: Optional[str] = None

@router.post("/clubs/check-president", response_model=PresidentCheckResponse)
async def check_president_eligibility(
    check_request: PresidentCheckRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Vérifie si l'email fourni correspond à l'email du président du club (via real_club_id).
    """
    stmt = select(Club).where(Club.real_club_id == check_request.real_club_id)
    result = await session.execute(stmt)
    club = result.scalars().first()

    if not club:
        # Si le club n'est pas encore enrichi dans notre base de référence, on ne peut pas vérifier.
        # Soit on bloque, soit on laisse passer (politique de sécurité).
        # Ici on bloque car on veut valider.
        return PresidentCheckResponse(
            is_president=False, 
            details="Club introuvable ou informations manquantes."
        )

    if not club.president_email:
        return PresidentCheckResponse(
            is_president=False,
            details="Aucun email de président connu pour ce club."
        )

    # Comparaison insensible à la casse
    if club.president_email.strip().lower() == check_request.email.strip().lower():
        return PresidentCheckResponse(is_president=True)
    
    return PresidentCheckResponse(
        is_president=False,
        details="L'email ne correspond pas à celui du président déclaré à la FFF."
    )

@router.get("/clubs/search", response_model=List[ClubSearchResponse])
async def search_clubs(
    q: str = Query(..., min_length=2, description="Recherche par nom ou numéro de club"),
    session: AsyncSession = Depends(get_session)
):
    """
    Autocomplete pour trouver un club FFF officiel (Table de référence fff_all_clubs).
    Retourne les 20 premiers résultats correspondants.
    """
    search_pattern = f"%{q}%"
    
    query = select(FFFAllClubs).where(
        or_(
            FFFAllClubs.short_name.ilike(search_pattern),
            cast(FFFAllClubs.cl_no, String).ilike(search_pattern)
        )
    ).limit(20)
    
    result = await session.execute(query)
    clubs = result.scalars().all()
    
    return [
        ClubSearchResponse(id=str(club.cl_no), label=club.short_name or f"Club {club.cl_no}")
        for club in clubs
    ]


class ClubRef(BaseModel):
    cl_no: int
    short_name: Optional[str]

@router.get("/clubs", response_model=List[ClubRef])
async def list_clubs(
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """
    Récupère la liste paginée de tous les clubs FFF (Référence).
    """
    query = select(FFFAllClubs).offset(skip).limit(limit)
    result = await session.execute(query)
    clubs = result.scalars().all()
    
    return [
        ClubRef(cl_no=club.cl_no, short_name=club.short_name)
        for club in clubs
    ]


class SeasonRead(BaseModel):
    name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ActiveSeasonUpdateRequest(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


@router.get("/seasons", response_model=List[SeasonRead])
async def list_seasons(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    # Auth required (seasons are used for club configuration)
    stmt = select(Season).order_by(Season.name.desc())
    seasons = (await session.execute(stmt)).scalars().all()
    return [SeasonRead(name=s.name, start_date=s.start_date, end_date=s.end_date) for s in seasons]


@router.get("/seasons/active", response_model=SeasonRead)
async def get_active_season(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    try:
        tenant, _role = await _resolve_tenant_context(session, current_user)
    except ValueError:
        # No tenant context → no season
        return SeasonRead(name="", start_date=None, end_date=None)

    season = await _ensure_tenant_active_season(session, tenant)
    return SeasonRead(name=season.name, start_date=season.start_date, end_date=season.end_date)


@router.put("/seasons/active", response_model=SeasonRead)
async def update_active_season(
    payload: ActiveSeasonUpdateRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user),
):
    tenant, role_name = await _resolve_tenant_context(session, current_user)

    can_manage = role_name in ["ADMIN", "PRESIDENT", "Président", "Administrateur"]
    if not can_manage:
        # 403 instead of silent ignore: this is a club-wide setting.
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Not authorized to manage seasons")

    target_name = (payload.name or tenant.active_season_name or _compute_default_season_name(datetime.now())).strip()
    if not target_name:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="Season name is required")

    season = (await session.execute(select(Season).where(Season.name == target_name))).scalars().first()
    if not season:
        start_date, end_date = _default_season_dates(target_name)
        season = Season(
            name=target_name,
            start_date=payload.start_date or start_date,
            end_date=payload.end_date or end_date,
            is_active=False,
        )
        session.add(season)
        await session.commit()
        await session.refresh(season)

    # Update dates if provided
    changed = False
    if payload.start_date is not None:
        season.start_date = payload.start_date
        changed = True
    if payload.end_date is not None:
        season.end_date = payload.end_date
        changed = True
    if changed:
        session.add(season)
        await session.commit()
        await session.refresh(season)

    # Assign active season on tenant
    if tenant.active_season_name != season.name:
        tenant.active_season_name = season.name
        session.add(tenant)
        await session.commit()
        await session.refresh(tenant)

    return SeasonRead(name=season.name, start_date=season.start_date, end_date=season.end_date)
