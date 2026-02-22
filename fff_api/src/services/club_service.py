from typing import List, Optional, TYPE_CHECKING
from src.domain.ports.data_provider import DataProvider
from src.domain.ports.storage import RawStorage
from src.domain.ports.club_repository import ClubRepository

from src.application.use_cases.scraping.scrape_club_info import ScrapeClubInfoUseCase
from src.application.use_cases.scraping.scrape_club_last_results import ScrapeClubLastResultsUseCase
from src.application.use_cases.scraping.scrape_club_matches import ScrapeClubMatchesUseCase
from src.application.use_cases.scraping.scrape_club_calendar import ScrapeClubCalendarUseCase
from src.application.use_cases.scraping.scrape_club_teams import ScrapeClubTeamsUseCase

if TYPE_CHECKING:
    from src.infrastructure.clients.fff.base import BaseAPIClient
    from src.infrastructure.storage.minio import MinioStorageService
    from src.infrastructure.database.repositories.club_repository import ClubRepository as AlgoClubRepo

class ClubService:
    """
    Facade for Club-related Use Cases.
    Maintains backward compatibility while delegating to Clean Architecture Use Cases.
    """
    def __init__(self, 
                 api_client: DataProvider, 
                 storage: Optional[RawStorage] = None,
                 club_repo: Optional[ClubRepository] = None):
        
        self.scrape_info = ScrapeClubInfoUseCase(api_client, storage)
        self.scrape_results = ScrapeClubLastResultsUseCase(api_client, storage)
        self.scrape_matches = ScrapeClubMatchesUseCase(api_client, storage, club_repo)
        self.scrape_calendar = ScrapeClubCalendarUseCase(api_client, storage)
        self.scrape_teams = ScrapeClubTeamsUseCase(api_client, storage)

    async def get_club(self, cl_no: int):
        """
        Retrieves detailed information about a club.
        """
        return await self.scrape_info.execute(cl_no)

    async def get_last_results(self, cl_no: int):
        """
        Retrieves the last results of a club.
        """
        return await self.scrape_results.execute(cl_no)

    async def get_matches(self, cl_no: int, page: int = 1):
        """
        Retrieves the list of matches of a club with pagination.
        """
        return await self.scrape_matches.execute(cl_no, page)
            
    async def get_calendar(self, cl_no: int):
        """
        Retrieves the calendar of upcoming matches for a club.
        """
        return await self.scrape_calendar.execute(cl_no)

    async def get_teams(self, cl_no: int, filter_val: Optional[int] = None):
        """
        Retrieves the list of teams of a club.
        """
        return await self.scrape_teams.execute(cl_no, filter_val)


