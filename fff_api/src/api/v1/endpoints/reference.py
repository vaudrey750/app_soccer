from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, cast, String
from pydantic import BaseModel, EmailStr

from src.infrastructure.database.session import get_session
from src.domain.models.fff_club import FFFAllClubs
from src.domain.models.reference import Club

router = APIRouter()

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
