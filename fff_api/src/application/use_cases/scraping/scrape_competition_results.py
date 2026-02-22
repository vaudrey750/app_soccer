from typing import Optional
import hashlib
from src.domain.ports.data_provider import DataProvider
from src.domain.ports.storage import RawStorage

class ScrapeCompetitionResultsUseCase:
    def __init__(self, api_client: DataProvider, storage: Optional[RawStorage] = None):
        self.api = api_client
        self.storage = storage

    async def execute(self, cp_no: int, ph_no: int, po_no: int, **kwargs):
        data = await self.api.get(f"/compets/{cp_no}/phases/{ph_no}/poules/{po_no}/resultat", params=kwargs)
        
        if self.storage:
            name = f"{cp_no}/ph{ph_no}/po{po_no}/results"
            if kwargs:
                h = hashlib.md5(str(sorted(kwargs.items())).encode('utf-8')).hexdigest()[:6]
                name += f"_{h}"
            self.storage.save_raw("competitions", name, data)
            
        return data
