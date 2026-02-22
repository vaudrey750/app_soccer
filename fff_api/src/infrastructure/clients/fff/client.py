import httpx
from typing import Optional
from src.infrastructure.database.repositories.club_repository import ClubRepository
from src.infrastructure.storage.minio import MinioStorageService
from src.infrastructure.clients.fff.base import BaseAPIClient
from src.infrastructure.cache.redis_service import RedisCacheService
from src.infrastructure.clients.fff.cached_client import CachedDataProvider

from src.application.use_cases.scraping.scrape_club_info import ScrapeClubInfoUseCase
from src.application.use_cases.scraping.scrape_club_last_results import ScrapeClubLastResultsUseCase
from src.application.use_cases.scraping.scrape_club_matches import ScrapeClubMatchesUseCase
from src.application.use_cases.scraping.scrape_club_calendar import ScrapeClubCalendarUseCase
from src.application.use_cases.scraping.scrape_club_teams import ScrapeClubTeamsUseCase

from src.application.use_cases.scraping.scrape_competition_info import ScrapeCompetitionInfoUseCase
from src.application.use_cases.scraping.scrape_competition_results import ScrapeCompetitionResultsUseCase
from src.application.use_cases.scraping.scrape_competition_ranking import ScrapeCompetitionRankingUseCase
from src.application.use_cases.scraping.scrape_match_details import ScrapeMatchDetailsUseCase


class FFFClient:
    """
    Facade Pattern: Single entry point that simplifies the use of sub-services.
    Respects the Open/Closed principle: new services can be added without modifying existing internal logic.
    """
    def __init__(self, client: Optional[httpx.AsyncClient] = None, use_cache: bool = True):
        self._base_client = BaseAPIClient(client)
        
        # Setup Cache Layer (Decorator)
        if use_cache:
            try:
                self._redis = RedisCacheService()
                self._data_provider = CachedDataProvider(self._base_client, self._redis, ttl=3600)
            except Exception:
                # Fallback if Redis fails at init
                self._data_provider = self._base_client
        else:
            self._data_provider = self._base_client

        self.storage = MinioStorageService()
        self.club_repo = ClubRepository()
        
        # Use Cases for Clubs
        self.scrape_club_info = ScrapeClubInfoUseCase(self._data_provider, self.storage)
        self.scrape_club_results = ScrapeClubLastResultsUseCase(self._data_provider, self.storage)
        self.scrape_club_matches = ScrapeClubMatchesUseCase(self._data_provider, self.storage, self.club_repo)
        self.scrape_club_calendar = ScrapeClubCalendarUseCase(self._data_provider, self.storage)
        self.scrape_club_teams = ScrapeClubTeamsUseCase(self._data_provider, self.storage)
        
        # Use Cases for Competitions and Matches
        self.scrape_comp_info = ScrapeCompetitionInfoUseCase(self._data_provider, self.storage)
        self.scrape_comp_results = ScrapeCompetitionResultsUseCase(self._data_provider, self.storage)
        self.scrape_comp_ranking = ScrapeCompetitionRankingUseCase(self._data_provider, self.storage)
        self.scrape_match_details = ScrapeMatchDetailsUseCase(self._data_provider, self.storage)

    async def close(self):
        """Closes the underlying HTTP session."""
        await self._base_client.close()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    # --- Méthodes de commodité (Proxy vers les services) ---
    # Cela permet de garder la compatibilité avec l'ancien code client tout en déléguant.
    
    async def get_club_info(self, cl_no: int):
        """
        Retrieves detailed information about a club.

        Args:
            cl_no (int): The club number.
        """
        return await self.scrape_club_info.execute(cl_no)

    async def get_club_last_results(self, cl_no: int):
        """
        Retrieves the last results of a club.

        Args:
            cl_no (int): The club number.
        """
        return await self.scrape_club_results.execute(cl_no)

    async def get_club_matches(self, cl_no: int, page: int = 1):
        """
        Retrieves the list of matches of a club with pagination.

        Args:
            cl_no (int): The club number.
            page (int, optional): The page number to retrieve. Defaults to 1.
        """
        return await self.scrape_club_matches.execute(cl_no, page)

    async def get_match_details(self, ma_no: int):
        """
        Retrieves the complete details of a specific match.

        Args:
            ma_no (int): The match number.
        """
        return await self.scrape_match_details.execute(ma_no)

    async def get_club_calendar(self, cl_no: int):
        """
        Retrieves the calendar of upcoming matches for a club.

        Args:
            cl_no (int): The club number.
        """
        return await self.scrape_club_calendar.execute(cl_no)

    async def get_club_teams(self, cl_no: int, filter_val: Optional[int] = None):
        """
        Retrieves the list of teams of a club.

        Args:
            cl_no (int): The club number.
            filter_val (int, optional): An optional filter for the API.
        """
        return await self.scrape_club_teams.execute(cl_no, filter_val)

    async def get_competition_info(self, cp_no: int):
        """
        Retrieves detailed information about a competition.

        Args:
            cp_no (int): The competition number.
        """
        return await self.scrape_comp_info.execute(cp_no)

    async def get_competition_results(self, cp_no: int, ph_no: int, po_no: int, **kwargs):
        """
        Retrieves the results of a specific competition (phase and poule).

        Args:
            cp_no (int): Competition number.
            ph_no (int): Phase number.
            po_no (int): Poule number.
            **kwargs: Additional arguments passed to the API.
        """
        return await self.scrape_comp_results.execute(cp_no, ph_no, po_no, **kwargs)

    async def get_competition_ranking(self, cp_no: int, ph_no: int, po_no: int):
        """
        Retrieves the ranking of a competition (phase and poule).

        Args:
            cp_no (int): Competition number.
            ph_no (int): Phase number.
            po_no (int): Poule number.
        """
        return await self.scrape_comp_ranking.execute(cp_no, ph_no, po_no)
