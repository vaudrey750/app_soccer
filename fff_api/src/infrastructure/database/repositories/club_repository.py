from typing import Dict
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from src.domain.models.fff_club import FFFAllClubs
from src.infrastructure.database.session import get_session
from src.domain.ports.club_repository import ClubRepository as IClubRepository
import logging

logger = logging.getLogger(__name__)

class ClubRepository(IClubRepository):
    """
    Repository dedicated to Club data persistence in PostgreSQL.
    Follows Single Responsibility Principle by isolating database logic.
    """
    
    async def save_clubs_bulk(self, clubs_data: Dict[int, str]):
        """
        Saves or updates a bulk of clubs into fff_all_clubs table.
        
        Args:
            clubs_data: Dictionary mapping cl_no (int) to short_name (str).
        """
        if not clubs_data:
            return

        async for session in get_session():
            try:
                # Prepare dictionaries for bulk insert
                values_list = [
                    {"cl_no": int(cl_no), "short_name": name} 
                    for cl_no, name in clubs_data.items()
                    if cl_no is not None  # Ensure valid data
                ]
                
                if not values_list:
                    return

                # Perform UPSERT (Insert or Update on conflict)
                stmt = insert(FFFAllClubs).values(values_list)
                
                # If cl_no exists, update the short_name
                stmt = stmt.on_conflict_do_update(
                    index_elements=['cl_no'],
                    set_=dict(short_name=stmt.excluded.short_name)
                )
                
                await session.execute(stmt)
                await session.commit()
                logger.info(f"Successfully upserted {len(values_list)} clubs in DB.")
                
            except Exception as e:
                logger.error(f"Error saving clubs to database: {e}")
                await session.rollback()
                raise e
