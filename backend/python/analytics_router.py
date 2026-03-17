from fastapi import APIRouter, Depends
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Document, ImageEmbedding
from config import settings
import redis
import json
from typing import Dict, Any, List

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Redis connection
redis_client = redis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    password=settings.REDIS_PASSWORD,
    decode_responses=True
)

@router.get("/dashboard-stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    """Get overall dashboard statistics"""
    # Search analytics from Redis history
    history_raw = redis_client.lrange("search:history", 0, 999)
    history = [json.loads(h) for h in history_raw]
    total_searches = len(history)
    unique_queries = len(set(h.get("query", "") for h in history))
    zero_result_count = sum(1 for h in history if h.get("total_results", 1) == 0)
    avg_results = (
        sum(h.get("total_results", 0) for h in history) / total_searches
        if total_searches else 0
    )

    return {
        "total_searches": total_searches,
        "unique_queries": unique_queries,
        "zero_result_queries": zero_result_count,
        "avg_results_per_query": round(avg_results, 2),
    }

@router.get("/latest-trace")
async def get_latest_search_trace():
    """Get the trace of the most recent search"""
    trace_data = redis_client.get("search:latest_trace")
    if not trace_data:
        return None
    return json.loads(trace_data)

@router.get("/top-keywords")
async def get_top_keywords(limit: int = 20):
    """Get top searched keywords"""
    # ZREVRANGE search:keywords 0 19 WITHSCORES
    keywords = redis_client.zrevrange("search:keywords", 0, limit-1, withscores=True)
    return [{"keyword": k, "count": int(s)} for k, s in keywords]

@router.get("/recent-searches")
async def get_recent_searches(limit: int = 50):
    """Get recent search history"""
    history = redis_client.lrange("search:history", 0, limit-1)
    return [json.loads(h) for h in history]

@router.get("/system-health")
async def get_system_health():
    """Get simple system health status"""
    return {
        "status": "healthy",
        "redis": True, # Assumed if we are here
        "database": True # We could check connectivity
    }

@router.get("/query-volume")
async def query_volume(period: str = "daily"):
    """Query volume over time (hourly/daily)"""
    r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT,
                    db=settings.REDIS_DB, decode_responses=True)

    # Get all search history
    history_raw = r.lrange("search:history", 0, 999)
    history = [json.loads(h) for h in history_raw]

    # Group by time period
    from collections import defaultdict
    from datetime import datetime

    buckets = defaultdict(int)
    for item in history:
        ts = item.get("timestamp", 0)
        dt = datetime.fromtimestamp(ts)
        if period == "hourly":
            key = dt.strftime("%Y-%m-%d %H:00")
        else:
            key = dt.strftime("%Y-%m-%d")
        buckets[key] += 1

    return {
        "period": period,
        "data": [{"time": k, "count": v} for k, v in sorted(buckets.items())]
    }

@router.get("/zero-results")
async def zero_result_queries():
    """Queries that returned no results"""
    r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT,
                    db=settings.REDIS_DB, decode_responses=True)
    history_raw = r.lrange("search:history", 0, 999)
    history = [json.loads(h) for h in history_raw]

    zero_results = [
        {"query": h["query"], "timestamp": h.get("timestamp", 0)}
        for h in history if h.get("total_results", 1) == 0
    ]
    return {"zero_result_queries": zero_results, "count": len(zero_results)}

@router.get("/system-health-full")
async def full_system_health():
    """Comprehensive system health metrics"""
    import psutil
    import os

    health = {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory": {
            "total_gb": psutil.virtual_memory().total / 1e9,
            "used_gb": psutil.virtual_memory().used / 1e9,
            "percent": psutil.virtual_memory().percent
        },
        "disk": {
            "total_gb": psutil.disk_usage("/").total / 1e9,
            "used_gb": psutil.disk_usage("/").used / 1e9,
            "percent": psutil.disk_usage("/").percent
        }
    }

    # Redis health
    try:
        r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT,
                        db=settings.REDIS_DB, decode_responses=True)
        r.ping()
        info = r.info()
        health["redis"] = {
            "status": "healthy",
            "used_memory_mb": info.get("used_memory", 0) / 1e6,
            "connected_clients": info.get("connected_clients", 0),
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0)
        }
    except Exception as e:
        health["redis"] = {"status": "error", "error": str(e)}

    return health
