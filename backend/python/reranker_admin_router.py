from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
import time

router = APIRouter(prefix="/api/v1/admin/reranker", tags=["reranker-admin"])

class RerankDebugRequest(BaseModel):
    query: str
    document_ids: List[int]
    compare_text_only: bool = False

@router.post("/debug")
async def debug_reranker(
    request: RerankDebugRequest,
    db: AsyncSession = Depends(get_db)
):
    """Run the reranker on specified documents and show full debug output"""
    try:
        from reranker_service import get_reranker_service
        from index_service import get_index_service

        index_svc = get_index_service()

        # Fetch documents
        candidates = []
        for i, doc_id in enumerate(request.document_ids):
            doc = await index_svc.get_document(doc_id, db)
            if doc:
                candidates.append({
                    "document_id": doc_id,
                    "score": 1.0 / (i + 1),  # Fake RRF score for debug
                    "pre_rank": i
                })

        if not candidates:
            raise HTTPException(status_code=404, detail="No documents found")

        # Run reranker
        reranker = get_reranker_service()
        start = time.time()
        reranked = await reranker.rerank(request.query, candidates, db)
        elapsed = (time.time() - start) * 1000

        return {
            "query": request.query,
            "reranked": reranked,
            "latency_ms": elapsed,
            "input_count": len(candidates),
            "output_count": len(reranked)
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="Reranker service not available")

@router.get("/status")
async def get_reranker_status():
    """Get reranker service status"""
    try:
        from reranker_service import get_reranker_service
        reranker = get_reranker_service()
        return {
            "available": True,
            "model": reranker.model,
            "window_size": reranker.window_size,
            "stride": reranker.stride
        }
    except Exception as e:
        return {"available": False, "error": str(e)}
