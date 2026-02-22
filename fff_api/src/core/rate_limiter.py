import asyncio
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class TokenBucketLimiter:
    """
    A simple token bucket rate limiter for asyncio.
    Ensures that we don't exceed `max_calls` per `period` seconds.
    """
    def __init__(self, max_calls: int, period: float = 60.0):
        if max_calls <= 0:
            raise ValueError("max_calls must be positive")
        if period <= 0:
            raise ValueError("period must be positive")
            
        self.max_calls = max_calls
        self.period = period
        self.rate = max_calls / period  # tokens per second
        self.tokens = float(max_calls)
        self.updated_at = time.monotonic()
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            now = time.monotonic()
            time_passed = now - self.updated_at
            self.updated_at = now
            
            # Refill tokens based on time passed
            self.tokens += time_passed * self.rate
            if self.tokens > self.max_calls:
                self.tokens = float(self.max_calls)
            
            if self.tokens < 1.0:
                # Calculate wait time for 1 token
                # needed = 1.0 - self.tokens
                # wait_time = needed / self.rate
                wait_time = (1.0 - self.tokens) / self.rate
                
                if wait_time > 0.1: # Only log significant waits
                    logger.debug(f"Rate limit hit. Waiting {wait_time:.3f}s")

                # Sleep without holding the lock?  
                # Ideally no, because other coroutines shouldn't grab the token while we wait.
                # But holding the lock during sleep blocks everyone else from even checking.
                # In a single-consumer model per bucket, holding lock is fine (strict ordering).
                # But here multiple concurrent tasks share the bucket.
                # If we hold dictionary lock, we serialize everyone.
                # But that's the point of rate limiting?
                # Actually, if we hold the lock, no one else can acquire(), so the throughput is strictly limited.
                # However, if wait_time is long, we block others who might just want to be queued.
                # But with asyncio.sleep in lock, it effectively queues them on the lock acquisition.
                
                await asyncio.sleep(wait_time)
                
                # Update state after sleep
                now = time.monotonic()
                time_passed = now - self.updated_at
                self.updated_at = now
                self.tokens += time_passed * self.rate
            
            self.tokens -= 1.0
