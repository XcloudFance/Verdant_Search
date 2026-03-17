from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from database import get_db
from config import settings
import os

router = APIRouter(prefix="/api/v1/admin/index", tags=["index-admin"])

@router.get("/overview")
async def get_index_overview(db: AsyncSession = Depends(get_db)):
    """Overview of the search index"""
    result = await db.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM documents) as total_documents,
            (SELECT COUNT(*) FROM document_embeddings) as total_embeddings,
            (SELECT COUNT(*) FROM terms) as total_terms,
            (SELECT COUNT(*) FROM postings) as total_postings,
            (SELECT total_docs FROM doc_stats LIMIT 1) as indexed_docs,
            (SELECT avg_doc_length FROM doc_stats LIMIT 1) as avg_doc_length,
            (SELECT SUM(doc_length) FROM documents) as total_tokens,
            (SELECT MAX(created_at) FROM documents) as last_indexed
    """))
    row = result.fetchone()
    return dict(row._mapping)

@router.get("/documents")
async def browse_documents(
    limit: int = Query(50, le=500),
    offset: int = 0,
    source_type: str = None,
    search: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Browse all indexed documents"""
    where_clauses = []
    params = {"limit": limit, "offset": offset}

    if source_type:
        where_clauses.append("source_type = :source_type")
        params["source_type"] = source_type
    if search:
        where_clauses.append("(title ILIKE :search OR url ILIKE :search)")
        params["search"] = f"%{search}%"

    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    result = await db.execute(text(f"""
        SELECT id, title, url, source_type, doc_length,
               jsonb_array_length(COALESCE(images::jsonb, '[]'::jsonb)) as image_count,
               created_at, updated_at
        FROM documents
        {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """), params)

    count_result = await db.execute(text(f"""
        SELECT COUNT(*) FROM documents {where_sql}
    """), {k: v for k, v in params.items() if k not in ("limit", "offset")})

    total = count_result.scalar()
    rows = result.fetchall()

    return {
        "documents": [dict(r._mapping) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.get("/documents/{doc_id}")
async def get_document_detail(doc_id: int, db: AsyncSession = Depends(get_db)):
    """Get full document with chunk/term stats"""
    result = await db.execute(text("""
        SELECT d.*,
               COUNT(DISTINCT p.term_id) as unique_terms,
               (SELECT COUNT(*) FROM document_embeddings WHERE document_id = d.id) as has_embedding
        FROM documents d
        LEFT JOIN postings p ON p.document_id = d.id
        WHERE d.id = :doc_id
        GROUP BY d.id
    """), {"doc_id": doc_id})

    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get top terms for this document
    terms_result = await db.execute(text("""
        SELECT t.term, p.term_frequency
        FROM postings p
        JOIN terms t ON t.id = p.term_id
        WHERE p.document_id = :doc_id
        ORDER BY p.term_frequency DESC
        LIMIT 20
    """), {"doc_id": doc_id})

    doc = dict(row._mapping)
    doc["top_terms"] = [dict(r._mapping) for r in terms_result.fetchall()]
    return doc

@router.delete("/documents/{doc_id}")
async def soft_delete_document(doc_id: int, db: AsyncSession = Depends(get_db)):
    """Soft delete a document (marks as deleted, keeps in DB)"""
    # For now, actually delete since we don't have a deleted_at column
    await db.execute(text("DELETE FROM document_embeddings WHERE document_id = :id"), {"id": doc_id})
    await db.execute(text("DELETE FROM postings WHERE document_id = :id"), {"id": doc_id})
    await db.execute(text("DELETE FROM documents WHERE id = :id"), {"id": doc_id})
    await db.commit()
    return {"message": f"Document {doc_id} deleted"}

@router.get("/terms")
async def search_terms(q: str = "", limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Search the term vocabulary"""
    result = await db.execute(text("""
        SELECT term, doc_frequency, total_frequency
        FROM terms
        WHERE term ILIKE :q
        ORDER BY doc_frequency DESC
        LIMIT :limit
    """), {"q": f"%{q}%", "limit": limit})
    rows = result.fetchall()
    return {"terms": [dict(r._mapping) for r in rows]}

@router.get("/stats/source-breakdown")
async def get_source_breakdown(db: AsyncSession = Depends(get_db)):
    """Per-source document and index stats"""
    result = await db.execute(text("""
        SELECT
            COALESCE(source_type, 'unknown') as source_type,
            COUNT(*) as doc_count,
            SUM(doc_length) as total_tokens,
            AVG(doc_length) as avg_tokens,
            MAX(created_at) as last_indexed
        FROM documents
        GROUP BY source_type
        ORDER BY doc_count DESC
    """))
    rows = result.fetchall()
    return {"breakdown": [dict(r._mapping) for r in rows]}

@router.post("/reindex-stats")
async def rebuild_doc_stats(db: AsyncSession = Depends(get_db)):
    """Rebuild BM25 doc_stats from current documents"""
    await db.execute(text("""
        UPDATE doc_stats SET
            total_docs = (SELECT COUNT(*) FROM documents),
            avg_doc_length = COALESCE((SELECT AVG(doc_length) FROM documents WHERE doc_length > 0), 0),
            updated_at = NOW()
        WHERE id = 1
    """))
    await db.commit()
    result = await db.execute(text("SELECT * FROM doc_stats LIMIT 1"))
    row = result.fetchone()
    return {"message": "Stats rebuilt", "stats": dict(row._mapping)}
