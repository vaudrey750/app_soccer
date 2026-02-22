import json
import hashlib
from typing import Optional, Any, Dict
from redis.asyncio import Redis

class RedisCacheService:
    def __init__(self, redis_url: str = "redis://redis:6379/0"):
        self.redis = Redis.from_url(redis_url, decode_responses=True)

    def _generate_key(self, endpoint: str, params: Optional[Dict[str, Any]]) -> str:
        # Créer une clé unique basée sur l'URL et les params
        param_str = json.dumps(params or {}, sort_keys=True)
        raw_key = f"{endpoint}:{param_str}"
        return f"fff_cache:{hashlib.md5(raw_key.encode()).hexdigest()}"

    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Optional[Any]:
        key = self._generate_key(endpoint, params)
        data = await self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    async def set(self, endpoint: str, params: Optional[Dict[str, Any]], data: Any, ttl: int = 3600):
        key = self._generate_key(endpoint, params)
        await self.redis.setex(key, ttl, json.dumps(data))
