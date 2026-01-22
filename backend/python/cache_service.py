"""
Cache Service using Redis
Caches LLM-generated content to improve response time and reduce API costs
"""
import redis
import json
import hashlib
from typing import Optional, Any, List, Dict
from config import settings

class CacheService:
    """Service for caching LLM responses"""
    
    def __init__(self):
        self.enabled = settings.ENABLE_CACHE
        self.redis_client = None
        
        if self.enabled:
            # Try to connect with retries (Redis might be starting)
            import time
            max_retries = 3
            retry_delay = 1
            
            for attempt in range(max_retries):
                try:
                    self.redis_client = redis.Redis(
                        host=settings.REDIS_HOST,
                        port=settings.REDIS_PORT,
                        db=settings.REDIS_DB,
                        password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
                        decode_responses=True,
                        socket_connect_timeout=3
                    )
                    # Test connection
                    self.redis_client.ping()
                    print(f"✓ Redis cache connected: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"⚠ Redis connection attempt {attempt + 1} failed, retrying in {retry_delay}s...")
                        time.sleep(retry_delay)
                    else:
                        print(f"⚠ Redis connection failed after {max_retries} attempts: {e}. Caching disabled.")
                        self.enabled = False
                        self.redis_client = None
            print("Cache disabled by configuration")
    
    def _generate_cache_key(self, prefix: str, query: str, result_ids: Optional[List[int]] = None) -> str:
        """
        Generate a unique cache key based on query and result IDs
        
        Args:
            prefix: Key prefix (e.g., 'summary', 'questions')
            query: Search query
            result_ids: List of result IDs to ensure cache matches exact results
        
        Returns:
            Cache key string
        """
        # Normalize query
        normalized_query = query.lower().strip()
        
        # Create hash of query and result IDs
        if result_ids:
            content = f"{normalized_query}:{','.join(map(str, sorted(result_ids)))}"
        else:
            content = normalized_query
        
        hash_value = hashlib.md5(content.encode()).hexdigest()
        return f"verdant:{prefix}:{hash_value}"
    
    def get_summary(self, query: str, result_ids: Optional[List[int]] = None) -> Optional[str]:
        """Get cached summary"""
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            key = self._generate_cache_key("summary", query, result_ids)
            cached = self.redis_client.get(key)
            if cached:
                print(f"✓ Cache HIT: summary for '{query[:30]}...'")
                return cached
            print(f"✗ Cache MISS: summary for '{query[:30]}...'")
            return None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None
    
    def set_summary(self, query: str, summary: str, result_ids: Optional[List[int]] = None, ttl: Optional[int] = None):
        """Cache summary"""
        if not self.enabled or not self.redis_client:
            return
        
        try:
            key = self._generate_cache_key("summary", query, result_ids)
            ttl = ttl or settings.CACHE_TTL
            self.redis_client.setex(key, ttl, summary)
            print(f"✓ Cached summary for '{query[:30]}...' (TTL: {ttl}s)")
        except Exception as e:
            print(f"Cache set error: {e}")
    
    def get_questions(self, query: str, result_ids: Optional[List[int]] = None) -> Optional[List[str]]:
        """Get cached questions"""
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            key = self._generate_cache_key("questions", query, result_ids)
            cached = self.redis_client.get(key)
            if cached:
                print(f"✓ Cache HIT: questions for '{query[:30]}...'")
                return json.loads(cached)
            print(f"✗ Cache MISS: questions for '{query[:30]}...'")
            return None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None
    
    def set_questions(self, query: str, questions: List[str], result_ids: Optional[List[int]] = None, ttl: Optional[int] = None):
        """Cache questions"""
        if not self.enabled or not self.redis_client:
            return
        
        try:
            key = self._generate_cache_key("questions", query, result_ids)
            ttl = ttl or settings.CACHE_TTL
            self.redis_client.setex(key, ttl, json.dumps(questions))
            print(f"✓ Cached questions for '{query[:30]}...' (TTL: {ttl}s)")
        except Exception as e:
            print(f"Cache set error: {e}")
    
    def invalidate_query(self, query: str):
        """Invalidate all cache entries for a query"""
        if not self.enabled or not self.redis_client:
            return
        
        try:
            # Get all keys matching the query
            pattern = f"verdant:*:{hashlib.md5(query.lower().strip().encode()).hexdigest()}"
            keys = self.redis_client.keys(pattern)
            if keys:
                self.redis_client.delete(*keys)
                print(f"✓ Invalidated {len(keys)} cache entries for '{query[:30]}...'")
        except Exception as e:
            print(f"Cache invalidation error: {e}")
    
    def clear_all(self):
        """Clear all cache (use with caution)"""
        if not self.enabled or not self.redis_client:
            return
        
        try:
            keys = self.redis_client.keys("verdant:*")
            if keys:
                self.redis_client.delete(*keys)
                print(f"✓ Cleared {len(keys)} cache entries")
        except Exception as e:
            print(f"Cache clear error: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.enabled or not self.redis_client:
            return {"enabled": False}
        
        try:
            info = self.redis_client.info()
            keys = self.redis_client.keys("verdant:*")
            
            return {
                "enabled": True,
                "total_keys": len(keys),
                "memory_used": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0),
                "uptime_seconds": info.get("uptime_in_seconds", 0)
            }
        except Exception as e:
            return {"enabled": True, "error": str(e)}


# Global cache service instance
cache_service = None

def get_cache_service() -> CacheService:
    """Get or create cache service singleton"""
    global cache_service
    if cache_service is None:
        cache_service = CacheService()
    return cache_service

