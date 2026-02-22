from typing import Optional
from src.domain.ports.data_provider import DataProvider
from src.domain.ports.storage import RawStorage

class ScrapeCompetitionInfoUseCase:
    def __init__(self, api_client: DataProvider, storage: Optional[RawStorage] = None):
        self.api = api_client
        self.storage = storage

    async def execute(self, cp_no: int):
        data = await self.api.get(f"/compets/{cp_no}")
        if self.storage:
            self.storage.save_raw("competitions", f"{cp_no}/info", data)
        return data
