import hashlib
import json
import time
from typing import Optional, Any
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)


class LRUCache:
    """Thread-safe in-memory LRU cache with TTL support."""

    def __init__(self, max_size: int = 100, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: OrderedDict = OrderedDict()
        self._timestamps: dict = {}

    def _make_key(self, query: str, depth: str) -> str:
        raw = f"{query.lower().strip()}:{depth}"
        return hashlib.md5(raw.encode()).hexdigest()

    def get(self, query: str, depth: str) -> Optional[Any]:
        key = self._make_key(query, depth)
        if key not in self._cache:
            return None
        # Check TTL
        if time.time() - self._timestamps[key] > self.ttl_seconds:
            del self._cache[key]
            del self._timestamps[key]
            logger.debug(f"Cache expired for key: {key}")
            return None
        # Move to end (most recently used)
        self._cache.move_to_end(key)
        logger.debug(f"Cache hit for query: {query}")
        return self._cache[key]

    def set(self, query: str, depth: str, value: Any) -> None:
        key = self._make_key(query, depth)
        if key in self._cache:
            self._cache.move_to_end(key)
        else:
            if len(self._cache) >= self.max_size:
                # Evict least recently used
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
                del self._timestamps[oldest_key]
                logger.debug(f"Cache evicted oldest entry")
            self._cache[key] = value
        self._timestamps[key] = time.time()
        logger.debug(f"Cache set for query: {query}")

    def clear(self) -> None:
        self._cache.clear()
        self._timestamps.clear()

    @property
    def size(self) -> int:
        return len(self._cache)


# Global cache instance
_cache_instance: Optional[LRUCache] = None


def get_cache(ttl_seconds: int = 3600) -> LRUCache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = LRUCache(max_size=100, ttl_seconds=ttl_seconds)
    return _cache_instance
