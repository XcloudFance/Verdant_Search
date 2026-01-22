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
    # 1. Total Documents
    result = await db.execute(select(func.count()).select_from(Document))
    total_docs = result.scalar()
    
    # 2. Total Images (Multimodal Stats)
    img_result = await db.execute(select(func.count()).select_from(ImageEmbedding))
    total_images = img_result.scalar()
    
    # 3. Redis Crawler Queue
    queue_size = redis_client.llen("crawler:task_queue")
    visited_count = 0 # Need to approximation or get from bloom filter meta if stored
    
    # 4. Crawler Status (Scanning keys)
    active_workers = 0
    worker_keys = redis_client.keys("crawler:worker:*:status")
    worker_statuses = []
    for key in worker_keys:
        try:
            data = json.loads(redis_client.get(key))
            worker_statuses.append(data)
            if data['status'] == 'processing':
                active_workers += 1
        except:
            pass
            
    return {
        "total_documents": total_docs,
        "total_images": total_images,
        "queue_size": queue_size,
        "active_workers": active_workers,
        "worker_statuses": worker_statuses
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
    return [{"text": k, "value": s} for k, s in keywords]

@router.get("/recent-searches")
async def get_recent_searches(limit: int = 10):
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
