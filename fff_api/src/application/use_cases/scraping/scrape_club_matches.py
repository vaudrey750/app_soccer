from typing import Optional, Dict
from src.domain.ports.data_provider import DataProvider
from src.domain.ports.storage import RawStorage
from src.domain.ports.club_repository import ClubRepository

class ScrapeClubMatchesUseCase:
    def __init__(self, 
                 data_provider: DataProvider, 
                 storage: RawStorage,
                 club_repo: Optional[ClubRepository] = None):
        self.data_provider = data_provider
        self.storage = storage
        self.club_repo = club_repo

    async def execute(self, cl_no: int, page: int = 1):
        datas = []
        clubs = {}
        
        # Pagination Loop
        while True:
            params = {"page": page}
            data = await self.data_provider.get(f"/clubs/{cl_no}/matchs", params=params)
            datas.append(data)
            
            # Check pagination
            if data.get("hydra:view"):
                next_pagedata = data["hydra:view"].get("hydra:next")
                if not next_pagedata:
                    break
                else:
                    try:
                        page = int(next_pagedata.split("page=")[-1])
                    except ValueError:
                        break
            else:
                break
        
            # Extract basic club info from matches to populate simple directory
            if data.get("hydra:member"):
                self._extract_clubs(data["hydra:member"], clubs)
        
        # Save found clubs (side effect)
        if self.club_repo:
            await self.club_repo.save_clubs_bulk(clubs)

        # Persistence raw query results
        self.storage.save_raw("clubs", f"{cl_no}/matches", datas)

        # Extract competitions
        self._extract_competitions(datas, cl_no)
        
        return datas

    def _extract_clubs(self, members: list, clubs_dict: Dict[int, str]):
        for member in members:
            home_data = member.get("home") or {}
            home_cl_no = home_data.get("club", {}).get("cl_no")
            if home_cl_no:
                clubs_dict[home_cl_no] = home_data.get("short_name")

            away_data = member.get("away") or {}
            away_cl_no = away_data.get("club", {}).get("cl_no")
            if away_cl_no:
                clubs_dict[away_cl_no] = away_data.get("short_name")

    def _extract_competitions(self, datas: list, cl_no: int):
        try:
            competitions_map = {}
            for page_data in datas:
                members = page_data.get("hydra:member", []) if isinstance(page_data, dict) else []
                for match in members:
                    comp = match.get("competition")
                    if comp and comp.get("cp_no"):
                        cp_no = str(comp.get("cp_no"))
                        if cp_no not in competitions_map:
                            competitions_map[cp_no] = comp
            
            if competitions_map:
                comp_list = list(competitions_map.values())
                self.storage.save_raw("clubs", f"{cl_no}/competitions", comp_list)
        except Exception as e:
            # In a real app, use a logger adapted to domain
            print(f"Warning: Failed to extract competitions from matches: {e}")
