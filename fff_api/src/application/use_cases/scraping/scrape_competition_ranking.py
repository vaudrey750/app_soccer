from typing import Optional
from src.domain.ports.data_provider import DataProvider
from src.domain.ports.storage import RawStorage

class ScrapeCompetitionRankingUseCase:
    def __init__(self, api_client: DataProvider, storage: Optional[RawStorage] = None):
        self.api = api_client
        self.storage = storage

    async def execute(self, cp_no: int, ph_no: int, po_no: int):
        data = await self.api.get(f"/compets/{cp_no}/phases/{ph_no}/poules/{po_no}/classement_journees")
        
        if self.storage:
            self.storage.save_raw("rankings", f"{cp_no}_ph_{ph_no}_po{po_no}_ranking", data)
            
        return data
