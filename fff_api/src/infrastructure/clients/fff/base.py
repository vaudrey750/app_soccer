import httpx
import os
from typing import Optional, Any, Dict
from src.core.rate_limiter import TokenBucketLimiter
from src.domain.ports.data_provider import DataProvider

class BaseAPIClient(DataProvider):
    """
    Single Responsibility: Manage raw HTTP communication with the API.
    (Single Responsibility Principle)
    """
    BASE_URL = os.getenv("FFF_API_BASE_URL")

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        self.client = client or httpx.AsyncClient()
        self._internal_client = client is None
        
        # Rate Limiter: Default to 60 requests per minute
        # We use a burst of 1 to ensure strict pacing and avoid triggering anti-scraping bursts.
        rate_limit_per_min = int(os.getenv("FFF_API_RATE_LIMIT", "60"))
        if rate_limit_per_min > 0:
            period = 60.0 / rate_limit_per_min
            self.limiter = TokenBucketLimiter(max_calls=1, period=period)
        else:
            # Fallback or disabled? For now, assume always enabled if > 0
            self.limiter = TokenBucketLimiter(max_calls=60, period=60.0)

    async def close(self):
        if self._internal_client:
            await self.client.aclose()

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        # Wait for token
        await self.limiter.acquire()
        
        url = f"{self.BASE_URL}{path}"
        response = await self.client.get(url, params=params)
        response.raise_for_status()
        return response.json()
