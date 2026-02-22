from typing import Generic, TypeVar, Type, List, Optional, Any
from sqlmodel import select, SQLModel
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

ModelType = TypeVar("ModelType", bound=SQLModel)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalars().first()

    async def get_multi(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        statement = select(self.model).offset(skip).limit(limit)
        result = await db.execute(statement)
        return result.scalars().all()

    async def create(self, db: AsyncSession, *, obj_in: ModelType) -> ModelType:
        db.add(obj_in)
        await db.commit()
        await db.refresh(obj_in)
        return obj_in

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: dict | ModelType
    ) -> ModelType:
        obj_data = obj_in if isinstance(obj_in, dict) else obj_in.dict(exclude_unset=True)
        
        for key, value in obj_data.items():
            setattr(db_obj, key, value)
            
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def remove(self, db: AsyncSession, *, id: Any) -> Optional[ModelType]:
        obj = await self.get(db, id)
        if obj:
            await db.delete(obj)
            await db.commit()
        return obj
