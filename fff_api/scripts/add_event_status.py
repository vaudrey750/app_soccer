import asyncio
from sqlalchemy import text
from src.infrastructure.database.session import engine

async def add_status_column():
    async with engine.begin() as conn:
        try:
            # Check if column exists
            result = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'event' AND column_name = 'status_id';"))
            if result.first():
                print("Column status_id already exists.")
                return

            print("Adding status_id column...")
            await conn.execute(text("ALTER TABLE core.event ADD COLUMN status_id INTEGER DEFAULT 1;"))
            await conn.execute(text("ALTER TABLE core.event ADD CONSTRAINT fk_event_status FOREIGN KEY (status_id) REFERENCES core.game_status(id);"))
            print("Column added successfully.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(add_status_column())
