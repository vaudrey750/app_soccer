import asyncio
from sqlalchemy import text
from src.infrastructure.database.session import engine

async def inspect():
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'event';"))
        for row in result:
            print(f"{row[0]}: {row[1]}")

if __name__ == "__main__":
    asyncio.run(inspect())
