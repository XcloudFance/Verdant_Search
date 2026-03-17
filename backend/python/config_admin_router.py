from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from config import settings
import redis
import json
import time

router = APIRouter(prefix="/api/v1/admin/config", tags=["config-admin"])

CONFIG_KEY = "verdant:system_config"
CONFIG_HISTORY_KEY = "verdant:config_history"

def get_redis():
    return redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT,
                       db=settings.REDIS_DB, decode_responses=True)

def get_current_config(r) -> Dict:
    """Get current system config from Redis, fallback to defaults"""
    stored = r.get(CONFIG_KEY)
    if stored:
        return json.loads(stored)

    return {
        "search": {
            "bm25_k1": 1.5,
            "bm25_b": 0.75,
            "hnsw_ef_search": 64,
            "rrf_k": 60,
            "stage1_top_k": 100,
            "stage2_top_k": 20,
            "bm25_weight": getattr(settings, "BM25_WEIGHT", 0.4),
            "vector_weight": getattr(settings, "VECTOR_WEIGHT", 0.6)
        },
        "llm": {
            "model": "claude-sonnet-4-6",
            "max_tokens": 2048,
            "temperature": 0.7,
            "context_window": 8192
        },
        "reranker": {
            "enabled": False,
            "window_size": 10,
            "stride": 5,
            "top_k": 20
        },
        "followup_chips": {
            "enabled": True,
            "count": 3
        },
        "index": {
            "chunk_size": 512,
            "chunk_overlap": 64,
            "embedding_model": "clip-ViT-B-32",
            "hnsw_m": 16,
            "hnsw_ef_construction": 64
        },
        "crawler": {
            "global_rate_limit": 1.0,
            "default_max_depth": 3,
            "default_max_pages": 1000,
            "heartbeat_interval": 10,
            "dead_worker_grace_period": 300,
            "job_queue_max_size": 10000
        }
    }

@router.get("")
async def get_config():
    """Get current system configuration"""
    r = get_redis()
    config = get_current_config(r)
    return {"config": config}

@router.patch("")
async def update_config(updates: Dict[str, Any]):
    """Update system configuration (partial update, versioned)"""
    r = get_redis()
    current = get_current_config(r)

    # Deep merge
    for key, value in updates.items():
        if key in current and isinstance(current[key], dict) and isinstance(value, dict):
            current[key].update(value)
        else:
            current[key] = value

    # Save new config
    r.set(CONFIG_KEY, json.dumps(current))

    # Save version to history
    history_entry = {
        "timestamp": time.time(),
        "changes": updates,
        "config_snapshot": current
    }
    r.lpush(CONFIG_HISTORY_KEY, json.dumps(history_entry))
    r.ltrim(CONFIG_HISTORY_KEY, 0, 49)  # Keep last 50 versions

    return {"message": "Configuration updated", "config": current}

@router.get("/history")
async def get_config_history():
    """Get configuration change history"""
    r = get_redis()
    history_raw = r.lrange(CONFIG_HISTORY_KEY, 0, 19)
    history = [json.loads(h) for h in history_raw]
    return {"history": history}

@router.post("/reset")
async def reset_config():
    """Reset config to defaults"""
    r = get_redis()
    r.delete(CONFIG_KEY)
    return {"message": "Configuration reset to defaults"}
