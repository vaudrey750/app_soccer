from typing import Any, Dict, Optional
from src.domain.ports.data_provider import DataProvider
from src.infrastructure.cache.redis_service import RedisCacheService

class CachedDataProvider(DataProvider):
    def __init__(self, real_provider: DataProvider, cache: RedisCacheService, ttl: int = 3600):
        self.provider = real_provider
        self.cache = cache
        self.ttl = ttl

    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        params = params or {}
        
        # 1. Essayer de lire dans le cache
        # Note: on utilise try/except pour éviter de casser l'app si Redis est down
        try:
            cached_data = await self.cache.get(endpoint, params)
            if cached_data:
                return cached_data
        except Exception as e:
            # Log error normally, here we just pass
            pass

        # 2. Si pas de cache, appeler le vrai provider (API FFF)
        real_data = await self.provider.get(endpoint, params)

        # 3. Sauvegarder pour la prochaine fois
        if real_data:
            try:
                await self.cache.set(endpoint, params, real_data, ttl=self.ttl)
            except Exception:
                pass
        
        return real_data
