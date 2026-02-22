import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from src.domain.models.core import Events

class PublishMatchLineupUseCase:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def execute(self, event_id: uuid.UUID, publish: bool = True) -> bool:
        event = await self.session.get(Events, event_id)
        if not event:
            return False
            
        event.lineup_published = publish
        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)
        return True
