from src.domain.ports.data_provider import DataProvider
from src.domain.ports.storage import RawStorage

class ScrapeClubInfoUseCase:
    def __init__(self, data_provider: DataProvider, storage: RawStorage):
        self.data_provider = data_provider
        self.storage = storage

    async def execute(self, cl_no: int):
        data = await self.data_provider.get(f"/clubs/{cl_no}")
        self.storage.save_raw("clubs", f"{cl_no}/club_info", data)
        return data
