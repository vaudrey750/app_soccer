import asyncio
from src.infrastructure.database.session import engine
from sqlalchemy import text

async def update_schema():
    async with engine.begin() as conn:
        print("Schema update starting...")
        try:
            await conn.execute(text("ALTER TABLE reference.game ADD COLUMN IF NOT EXISTS current_period INTEGER DEFAULT 1;"))
            await conn.execute(text("ALTER TABLE reference.game ADD COLUMN IF NOT EXISTS timer_start_at TIMESTAMP;")) # timestamp without timezone usually in pg for naive or with. Let's assume standard behavior.
            await conn.execute(text("ALTER TABLE reference.game ADD COLUMN IF NOT EXISTS elapsed_time_at_start INTEGER DEFAULT 0;"))
            print("Schema updated successfully.")
        except Exception as e:
            print(f"Error updating schema: {e}")

if __name__ == "__main__":
    asyncio.run(update_schema())
