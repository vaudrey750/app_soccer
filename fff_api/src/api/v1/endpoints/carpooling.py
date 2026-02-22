from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from uuid import UUID
from typing import List

from src.infrastructure.database.session import get_session
from src.api.deps import get_current_user
from src.domain.models.saas import User
from src.domain.models.core import Member, Carpool, CarpoolPassenger
from src.domain.schemas.carpooling import CarpoolCreate, CarpoolRead, CarpoolUpdate, CarpoolPassengerRead

router = APIRouter()

async def get_current_member(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> Member:
    query = select(Member).where(Member.user_id == user.id)
    result = await session.execute(query)
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="Member profile not found for this user")
    return member

async def get_carpool_details(carpool, session, driver):
    # Helper to return full read object
    pass_res = await session.execute(
        select(Member)
        .join(CarpoolPassenger, CarpoolPassenger.member_id == Member.id)
        .where(CarpoolPassenger.carpool_id == carpool.id)
    )
    passengers = pass_res.scalars().all()
    pass_dtos = [CarpoolPassengerRead(
        member_id=p.id,
        first_name=p.first_name,
        last_name=p.last_name,
        photo_url=p.photo_url
    ) for p in passengers]
    
    return CarpoolRead(
        id=carpool.id,
        event_id=carpool.event_id,
        driver_id=carpool.driver_id,
        driver_first_name=driver.first_name,
        driver_last_name=driver.last_name,
        available_seats=carpool.available_seats,
        departure_location=carpool.departure_location,
        departure_time=carpool.departure_time,
        note=carpool.note,
        passengers=pass_dtos
    )

@router.post("/events/{event_id}/carpools", response_model=CarpoolRead)
async def create_carpool(
    event_id: UUID,
    carpool_in: CarpoolCreate,
    member: Member = Depends(get_current_member),
    session: AsyncSession = Depends(get_session)
):
    # Check if member already has a carpool for this event
    query = select(Carpool).where(Carpool.event_id == event_id, Carpool.driver_id == member.id)
    result = await session.execute(query)
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have a carpool for this event")

    carpool = Carpool(
        event_id=event_id,
        driver_id=member.id,
        available_seats=carpool_in.available_seats,
        departure_location=carpool_in.departure_location,
        departure_time=carpool_in.departure_time,
        note=carpool_in.note
    )
    session.add(carpool)
    await session.commit()
    await session.refresh(carpool)
    
    return await get_carpool_details(carpool, session, member)

@router.get("/events/{event_id}/carpools", response_model=List[CarpoolRead])
async def get_event_carpools(
    event_id: UUID,
    session: AsyncSession = Depends(get_session)
):
    # Get carpools with driver and passengers
    query = select(Carpool).where(Carpool.event_id == event_id)
    result = await session.execute(query)
    carpools = result.scalars().all()
    
    response = []
    for c in carpools:
        # Get driver
        driver_res = await session.execute(select(Member).where(Member.id == c.driver_id))
        driver = driver_res.scalars().first()
        
        if driver:
             response.append(await get_carpool_details(c, session, driver))
             
    return response

@router.put("/carpools/{carpool_id}", response_model=CarpoolRead)
async def update_carpool(
    carpool_id: UUID,
    carpool_in: CarpoolUpdate,
    member: Member = Depends(get_current_member),
    session: AsyncSession = Depends(get_session)
):
    query = select(Carpool).where(Carpool.id == carpool_id)
    result = await session.execute(query)
    carpool = result.scalars().first()
    
    if not carpool:
        raise HTTPException(status_code=404, detail="Carpool not found")
        
    if carpool.driver_id != member.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this carpool")
        
    if carpool_in.available_seats is not None: carpool.available_seats = carpool_in.available_seats
    if carpool_in.departure_location is not None: carpool.departure_location = carpool_in.departure_location
    if carpool_in.departure_time is not None: carpool.departure_time = carpool_in.departure_time
    if carpool_in.note is not None: carpool.note = carpool_in.note
    
    session.add(carpool)
    await session.commit()
    await session.refresh(carpool)
    
    return await get_carpool_details(carpool, session, member)

@router.delete("/carpools/{carpool_id}")
async def delete_carpool(
    carpool_id: UUID,
    member: Member = Depends(get_current_member),
    session: AsyncSession = Depends(get_session)
):
    query = select(Carpool).where(Carpool.id == carpool_id)
    result = await session.execute(query)
    carpool = result.scalars().first()
    
    if not carpool:
        raise HTTPException(status_code=404, detail="Carpool not found")
        
    if carpool.driver_id != member.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this carpool")
        
    # Delete passengers first
    del_pass = delete(CarpoolPassenger).where(CarpoolPassenger.carpool_id == carpool_id)
    await session.execute(del_pass)
    
    await session.delete(carpool)
    await session.commit()
    return {"status": "success"}

@router.post("/carpools/{carpool_id}/join")
async def join_carpool(
    carpool_id: UUID,
    member: Member = Depends(get_current_member),
    session: AsyncSession = Depends(get_session)
):
    query = select(Carpool).where(Carpool.id == carpool_id)
    result = await session.execute(query)
    carpool = result.scalars().first()
    if not carpool:
        raise HTTPException(status_code=404, detail="Carpool not found")

    if carpool.driver_id == member.id:
        raise HTTPException(status_code=400, detail="Driver cannot join their own carpool")

    # Check capacity
    count_res = await session.execute(select(CarpoolPassenger).where(CarpoolPassenger.carpool_id == carpool_id))
    current_passengers = count_res.scalars().all()
    if len(current_passengers) >= carpool.available_seats:
         raise HTTPException(status_code=400, detail="Carpool is full")

    # Check if already joined
    existing = await session.execute(select(CarpoolPassenger).where(CarpoolPassenger.carpool_id == carpool_id, CarpoolPassenger.member_id == member.id))
    if existing.scalars().first():
         raise HTTPException(status_code=400, detail="Already in this carpool")

    passenger = CarpoolPassenger(carpool_id=carpool_id, member_id=member.id)
    session.add(passenger)
    await session.commit()
    return {"status": "joined"}

@router.post("/carpools/{carpool_id}/leave")
async def leave_carpool(
    carpool_id: UUID,
    member: Member = Depends(get_current_member),
    session: AsyncSession = Depends(get_session)
):
    query = delete(CarpoolPassenger).where(CarpoolPassenger.carpool_id == carpool_id, CarpoolPassenger.member_id == member.id)
    result = await session.execute(query)
    if result.rowcount == 0:
         raise HTTPException(status_code=404, detail="Not in this carpool")
    
    await session.commit()
    return {"status": "left"}
