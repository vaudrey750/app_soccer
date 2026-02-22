from typing import Optional
from src.domain.ports.data_provider import DataProvider
from src.domain.ports.storage import RawStorage

class ScrapeClubTeamsUseCase:
    def __init__(self, data_provider: DataProvider, storage: RawStorage):
        self.data_provider = data_provider
        self.storage = storage

    async def execute(self, cl_no: int, filter_val: Optional[int] = None):
        params = {}
        if filter_val:
            params["filter"] = filter_val
    
        data = await self.data_provider.get(f"/clubs/{cl_no}/equipes", params=params)
        self.storage.save_raw("clubs", f"{cl_no}/teams", data)
        return data
