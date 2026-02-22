from typing import Optional
from src.domain.ports.data_provider import DataProvider
from src.domain.ports.storage import RawStorage

class ScrapeMatchDetailsUseCase:
    def __init__(self, api_client: DataProvider, storage: Optional[RawStorage] = None):
        self.api = api_client
        self.storage = storage

    async def execute(self, ma_no: int):
        data = await self.api.get(f"/match_entities/{ma_no}")
        
        if self.storage:
            self.storage.save_raw("matches", f"{ma_no}/details", data)
            
        return data
