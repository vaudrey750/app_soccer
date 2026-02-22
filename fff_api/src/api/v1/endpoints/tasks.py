from typing import List, Any
import uuid
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete

from src.infrastructure.database.session import get_session
from src.api.deps import get_current_active_user
from src.domain.models.saas import User
from src.domain.models.core import Task, TaskType
from src.api.v1.schemas.task import TaskRead, TaskCreate, TaskUpdate, TaskTypeRead

router = APIRouter()

# --- Task Types ---
@router.get("/types", response_model=List[TaskTypeRead])
async def read_task_types(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    stmt = select(TaskType)
    result = await session.execute(stmt)
    return result.scalars().all()

# --- Event Tasks ---

@router.get("/events/{event_id}/tasks", response_model=List[TaskRead])
async def read_event_tasks(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    stmt = select(Task).where(Task.event_id == event_id)
    result = await session.execute(stmt)
    return result.scalars().all()

@router.post("/events/{event_id}/tasks", response_model=List[TaskRead])
async def create_event_tasks(
    event_id: uuid.UUID,
    task_in: TaskCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    # Retrieve user's tenant (Assuming simple logic or context middleware handles tenant)
    # For now, we trust the endpoints are secured and we might need tenant_id
    # But Task model requires tenant_id. We should get it from current_user's member or passed query.
    # We will fetch the tenant_id from the member associated with the user
    
    # Quick fix: Get tenant from event or user member
    # Let's assume user is linked to a Member
    # For brevity, let's query the event to get the tenant_id
    from src.domain.models.core import Events
    event = await session.get(Events, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    created_tasks = []
    
    for member_id in task_in.assigned_member_ids:
        new_task = Task(
            tenant_id=event.tenant_id,
            event_id=event_id,
            type_id=task_in.type_id,
            description=task_in.description,
            assigned_member_id=member_id,
            is_completed=False
        )
        session.add(new_task)
        created_tasks.append(new_task)
    
    await session.commit()
    for t in created_tasks:
        await session.refresh(t)
        
    return created_tasks

# --- Single Task ---

@router.put("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID,
    task_in: TaskUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task_data = task_in.dict(exclude_unset=True)
    for key, value in task_data.items():
        setattr(task, key, value)
        
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task

@router.delete("/{task_id}")
async def delete_task(
    task_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_active_user)
):
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    await session.delete(task)
    await session.commit()
    return {"ok": True}
