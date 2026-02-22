import asyncio
from src.infrastructure.database.session import engine
from sqlalchemy import text

async def check_statuses():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, name FROM core.game_status ORDER BY id"))
        rows = result.fetchall()
        for row in rows:
            print(f"{row[0]}: {row[1]}")

if __name__ == "__main__":
    asyncio.run(check_statuses())
