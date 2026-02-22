import asyncio
import uuid
import sys
from sqlalchemy import text
from src.infrastructure.database.session import engine
from sqlmodel import select
from src.domain.models.core import Events
from src.domain.models.reference import Game

async def check_timer(event_id_str):
    try:
        event_id = uuid.UUID(event_id_str)
    except:
        print(f"Invalid UUID: {event_id_str}")
        return

    async with engine.begin() as conn:
        from sqlmodel.ext.asyncio.session import AsyncSession
        from sqlalchemy.orm import sessionmaker
        
        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with async_session() as session:
            stmt = select(Events).where(Events.id == event_id)
            res = await session.exec(stmt)
            event = res.first()
            
            if not event:
                print("Event not found")
                return
            
            print(f"Event Found: {event.title} (Type: {event.type})")
            if not event.game_id:
                print("No Game ID linked")
                return
                
            game_stmt = select(Game).where(Game.id == event.game_id)
            g_res = await session.exec(game_stmt)
            game = g_res.first()
            
            if not game:
                print("Game not found")
                return
                
            print(f"Game Status: {game.status}")
            print(f"Timer Start At: {game.timer_start_at}")
            print(f"Elapsed Time At Start: {game.elapsed_time_at_start}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_game_timer.py <event_id>")
    else:
        asyncio.run(check_timer(sys.argv[1]))
