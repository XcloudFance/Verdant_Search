from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db
from config import settings
import redis
import json
import time
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/admin/crawler", tags=["crawler-admin"])

# DB 0 — main app Redis
def get_redis():
    return redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT,
                       db=settings.REDIS_DB, decode_responses=True)

# DB 1 — crawler workers Redis
CRAWLER_REDIS_DB = 1
TASK_QUEUE_KEY = "crawler:task_queue"

def get_crawler_redis():
    return redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT,
                       db=CRAWLER_REDIS_DB, decode_responses=True)


# ──────────────────────────────────────────────
# Workers
# ──────────────────────────────────────────────

@router.get("/workers")
async def get_workers(db: AsyncSession = Depends(get_db)):
    """Get all registered workers with live heartbeat status from Redis DB 1"""
    result = await db.execute(text("""
        SELECT id, name, ip_address, hostname, version, capabilities,
               group_name, status, jobs_completed, jobs_failed, pages_per_min,
               last_heartbeat_at, registered_at, deregistered
        FROM crawler_workers
        WHERE deregistered = false
        ORDER BY registered_at DESC
    """))
    rows = result.fetchall()

    r = get_crawler_redis()  # DB 1 — where crawler actually writes
    workers = []
    for row in rows:
        worker = dict(row._mapping)
        wid = row.id

        # Live heartbeat TTL check
        ttl = r.ttl(f"crawler:heartbeat:{wid}")
        if ttl <= 0:
            worker["live_status"] = "DEAD"
        elif ttl < 10:
            worker["live_status"] = "DEGRADED"
        else:
            worker["live_status"] = "ACTIVE"
        worker["heartbeat_ttl"] = ttl

        # Current URL being processed
        status_raw = r.get(f"crawler:worker:{wid}:status")
        if status_raw:
            try:
                st = json.loads(status_raw)
                worker["current_url"] = st.get("url")
                worker["live_pages_per_min"] = st.get("pages_per_min")
                worker["live_jobs_completed"] = st.get("jobs_completed")
            except Exception:
                worker["current_url"] = None
        else:
            worker["current_url"] = None

        workers.append(worker)

    # Also include "orphan" workers visible in Redis but not yet in DB
    all_status_keys = r.keys("crawler:worker:*:status")
    registered_ids = {row.id for row in rows}
    for key in all_status_keys:
        try:
            wid = key.split(":")[2]
            if wid in registered_ids:
                continue
            st = json.loads(r.get(key) or "{}")
            ttl = r.ttl(f"crawler:heartbeat:{wid}")
            workers.append({
                "id": wid,
                "name": st.get("hostname", wid[:8]),
                "hostname": st.get("hostname", "unknown"),
                "ip_address": st.get("ip_address", ""),
                "status": "ACTIVE" if ttl > 0 else "DEAD",
                "live_status": "ACTIVE" if ttl > 10 else ("DEGRADED" if ttl > 0 else "DEAD"),
                "heartbeat_ttl": ttl,
                "jobs_completed": st.get("jobs_completed", 0),
                "jobs_failed": st.get("jobs_failed", 0),
                "pages_per_min": st.get("pages_per_min", 0),
                "live_pages_per_min": st.get("pages_per_min"),
                "current_url": st.get("url"),
                "capabilities": st.get("capabilities", []),
                "last_heartbeat_at": None,
                "registered_at": None,
                "deregistered": False,
                "_unregistered": True,
            })
        except Exception:
            pass

    return {"workers": workers, "count": len(workers)}


class RegisterWorkerBody(BaseModel):
    worker_id: str
    hostname: str = "unknown"
    ip_address: str = ""
    version: str = "1.0.0"
    capabilities: List[str] = []


@router.post("/workers/register")
async def register_worker(body: RegisterWorkerBody, db: AsyncSession = Depends(get_db)):
    """Called by crawler workers on startup"""
    caps_pg = "{" + ",".join(body.capabilities) + "}"

    await db.execute(text("""
        INSERT INTO crawler_workers
            (id, hostname, ip_address, version, capabilities, status,
             last_heartbeat_at, registered_at, deregistered)
        VALUES
            (:id, :hostname, :ip, :version, :caps::text[], 'ACTIVE',
             NOW(), NOW(), false)
        ON CONFLICT (id) DO UPDATE SET
            hostname          = EXCLUDED.hostname,
            ip_address        = EXCLUDED.ip_address,
            status            = 'ACTIVE',
            deregistered      = false,
            last_heartbeat_at = NOW()
    """), {
        "id":       body.worker_id,
        "hostname": body.hostname,
        "ip":       body.ip_address,
        "version":  body.version,
        "caps":     caps_pg,
    })
    await db.commit()
    return {
        "registered": True,
        "worker_id": body.worker_id,
        "heartbeat_interval_sec": 10,
        "job_stream_key": TASK_QUEUE_KEY,
    }


class HeartbeatBody(BaseModel):
    jobs_completed: int = 0
    jobs_failed: int = 0
    pages_per_min: float = 0.0
    current_url: str = None


@router.post("/workers/{worker_id}/heartbeat")
async def worker_heartbeat(worker_id: str, body: HeartbeatBody,
                           db: AsyncSession = Depends(get_db)):
    """Called every 10 s by each crawler worker thread"""
    r = get_crawler_redis()
    r.setex(f"crawler:heartbeat:{worker_id}", 30, str(time.time()))

    await db.execute(text("""
        UPDATE crawler_workers
        SET last_heartbeat_at = NOW(),
            jobs_completed    = :jc,
            jobs_failed       = :jf,
            pages_per_min     = :ppm,
            status            = 'ACTIVE'
        WHERE id = :id
    """), {
        "id":  worker_id,
        "jc":  body.jobs_completed,
        "jf":  body.jobs_failed,
        "ppm": body.pages_per_min,
    })
    await db.commit()
    return {"status": "ok"}


@router.delete("/workers/{worker_id}")
async def deregister_worker(worker_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        UPDATE crawler_workers SET deregistered = true, status = 'DEAD' WHERE id = :id
    """), {"id": worker_id})
    await db.commit()
    return {"deregistered": True}


# ──────────────────────────────────────────────
# Queue management (Redis DB 1)
# ──────────────────────────────────────────────

@router.get("/queue/pending")
async def get_pending_queue(limit: int = 100):
    """List pending URLs from the crawler task queue"""
    r = get_crawler_redis()
    total = r.llen(TASK_QUEUE_KEY)
    raw_items = r.lrange(TASK_QUEUE_KEY, 0, limit - 1)

    tasks = []
    for item in raw_items:
        try:
            tasks.append(json.loads(item))
        except Exception:
            tasks.append({"url": str(item), "depth": 0})

    return {"tasks": tasks, "total": total, "showing": len(tasks)}


class AddUrlsBody(BaseModel):
    urls: List[str]


@router.post("/queue/add")
async def add_urls_to_queue(body: AddUrlsBody):
    """Push URLs into the crawler task queue"""
    r = get_crawler_redis()
    added = 0
    for url in body.urls:
        url = url.strip()
        if url and url.startswith(("http://", "https://")):
            r.rpush(TASK_QUEUE_KEY, json.dumps({"url": url, "depth": 0}))
            added += 1
    return {"added": added, "total": r.llen(TASK_QUEUE_KEY)}


@router.delete("/queue/clear")
async def clear_queue():
    """Flush the pending URL queue"""
    r = get_crawler_redis()
    r.delete(TASK_QUEUE_KEY)
    return {"cleared": True, "total": 0}


# ──────────────────────────────────────────────
# Jobs
# ──────────────────────────────────────────────

@router.get("/jobs")
async def get_crawl_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text(
        "SELECT * FROM crawl_jobs ORDER BY created_at DESC LIMIT 100"
    ))
    rows = result.fetchall()
    return {"jobs": [dict(r._mapping) for r in rows]}


@router.get("/logs/{worker_id}")
async def get_worker_logs(worker_id: str, limit: int = 50,
                          db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT * FROM crawl_logs
        WHERE worker_id = :worker_id
        ORDER BY crawled_at DESC
        LIMIT :limit
    """), {"worker_id": worker_id, "limit": limit})
    rows = result.fetchall()
    return {"logs": [dict(r._mapping) for r in rows]}


# ──────────────────────────────────────────────
# Stats (called by AdminOverview + CrawlerPanel KPI strip)
# ──────────────────────────────────────────────

@router.get("/stats")
async def get_crawler_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE deregistered = false) AS total_workers,
            COUNT(*) FILTER (WHERE status = 'ACTIVE' AND deregistered = false) AS active_workers,
            COALESCE(SUM(jobs_completed), 0) AS total_jobs_completed,
            COALESCE(SUM(jobs_failed), 0)    AS total_jobs_failed,
            COALESCE(AVG(pages_per_min) FILTER (WHERE status = 'ACTIVE'), 0) AS avg_pages_per_min
        FROM crawler_workers
    """))
    row = result.fetchone()

    result2 = await db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'pending')   AS pending_jobs,
            COUNT(*) FILTER (WHERE status = 'running')   AS running_jobs,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_jobs
        FROM crawl_jobs
    """))
    row2 = result2.fetchone()

    # Queue size from Redis DB 1
    r = get_crawler_redis()
    queue_pending = r.llen(TASK_QUEUE_KEY)

    return {
        **dict(row._mapping),
        **dict(row2._mapping),
        "queue_pending": queue_pending,
    }


@router.get("/queue/stats")
async def get_queue_stats():
    """Legacy queue stats endpoint"""
    r = get_crawler_redis()
    queue_size = r.llen(TASK_QUEUE_KEY)
    return {
        "stream_length": queue_size,
        "pending_jobs": queue_size,
        "in_flight": 0,
        "acknowledged": 0,
        "stream_key": TASK_QUEUE_KEY,
    }


@router.get("/domains")
async def get_crawled_domains(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT
            regexp_replace(url, '^https?://([^/]+).*', '\\1') AS domain,
            COUNT(*)                                           AS page_count,
            MAX(crawled_at)                                    AS last_crawl,
            AVG(latency_ms)                                    AS avg_latency,
            COUNT(*) FILTER (WHERE status_code != 200)         AS error_count
        FROM crawl_logs
        WHERE url IS NOT NULL AND url != ''
        GROUP BY domain
        ORDER BY page_count DESC
        LIMIT 100
    """))
    rows = result.fetchall()
    return {"domains": [dict(r._mapping) for r in rows]}
