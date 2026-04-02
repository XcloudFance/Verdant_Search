from rank_bm25 import BM25Okapi
from typing import List, Dict, Any
import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from models import Document, DocumentEmbedding, ImageEmbedding
from embedding_service import get_embedding_service
from tokenizer_service import get_tokenizer_service
from config import settings
from reranker_service import get_reranker_service
import redis
import json
import time


class SearchService:
    """Hybrid search service combining BM25 and vector search"""
    
    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.tokenizer_service = get_tokenizer_service()
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD,
            decode_responses=True
        )

    def _log_search_trace(self, trace_data: Dict[str, Any]):
        """Log search trace to Redis for analytics dashboard"""
        try:
            # Save latest trace
            self.redis_client.set("search:latest_trace", json.dumps(trace_data), ex=3600)

            # Update search history (keep last 100)
            history_item = {
                "query": trace_data["query"],
                "timestamp": trace_data["timestamp"],
                "total_results": len(trace_data["final_results"]),
                "top_score": trace_data["final_results"][0]["score"] if trace_data["final_results"] else 0,
                "stage_timings_ms": trace_data.get("stage_timings_ms", {}),
                "reranker_enabled": trace_data.get("reranker_enabled", False),
            }
            self.redis_client.lpush("search:history", json.dumps(history_item))
            self.redis_client.ltrim("search:history", 0, 99)

            # Update keyword stats (legacy - for analytics)
            self.redis_client.zincrby("search:keywords", 1, trace_data["query"])

            # Add to RediSearch suggestion index
            from suggestion_service import get_suggestion_service
            suggestion_service = get_suggestion_service()
            suggestion_service.add_keyword(trace_data["query"])
        except Exception as e:
            print(f"Failed to log search trace: {e}")

    
    def preprocess_query(self, query: str) -> str:
        """
        Preprocess search query with tokenization

        Returns tokenized query
        """
        tokens = self.tokenizer_service.tokenize(query, mode="search")
        return " ".join(tokens)

    async def search(
        self,
        query: str,
        session: AsyncSession,
        top_k: int = None,
        reranker_enabled: bool = False,
        reranker_top_k: int = 20,
        filters: dict = None,
    ) -> List[Dict[str, Any]]:
        """
        Two-stage hybrid search.

        Stage 1: BM25 keyword retrieval + HNSW dense vector retrieval, fused
                 via Reciprocal Rank Fusion (RRF).
        Stage 2 (optional): Multimodal listwise LTR reranker over the top-K
                 candidates from Stage 1.

        Args:
            query:             Search query text (will be tokenized for BM25).
            session:           Active async database session.
            top_k:             Number of results to return (default from settings).
            reranker_enabled:  Whether to run the Stage 2 LTR reranker.
            reranker_top_k:    How many Stage 1 results to pass to the reranker.
            filters:           Optional metadata filters (date_from, date_to,
                               content_type, source_type).

        Returns:
            List of result dicts with ``document_id``, ``score``, and
            (when reranker is active) ``pre_rank``, ``post_rank``,
            ``rank_delta``.
        """
        if top_k is None:
            top_k = settings.TOP_K_RESULTS

        # Tokenize query for BM25
        tokenized_query = self.preprocess_query(query)

        # Get query embedding (use original query for semantic search)
        query_embedding = self.embedding_service.encode_text(query)[0]

        # Apply metadata filters — pre-fetch allowed doc IDs
        allowed_doc_ids = None
        if filters:
            allowed_doc_ids = await self._apply_filters(filters, session)

        # Stage 1a — Vector search using HNSW index
        t0 = time.time()
        vector_results = await self._vector_search(query_embedding, session, top_k * 2)
        vector_ms = (time.time() - t0) * 1000

        # Stage 1b — BM25 full-text search (with tokenized query)
        t0 = time.time()
        bm25_results = await self._bm25_search(tokenized_query, session, top_k * 2)
        bm25_ms = (time.time() - t0) * 1000

        # Filter results to only allowed documents
        if allowed_doc_ids is not None:
            vector_results = {k: v for k, v in vector_results.items() if k in allowed_doc_ids}
            bm25_results = {k: v for k, v in bm25_results.items() if k in allowed_doc_ids}

        # Stage 1c — RRF fusion
        t0 = time.time()
        combined_results = self._rrf_fusion(vector_results, bm25_results, top_k)
        rrf_ms = (time.time() - t0) * 1000

        # Stage 2 — Optional LTR reranker
        reranker_ms = 0.0
        if reranker_enabled and combined_results:
            t0 = time.time()
            reranker = get_reranker_service()
            reranker_input = combined_results[:reranker_top_k]
            reranked = await reranker.rerank(query, reranker_input, session)
            reranker_ms = (time.time() - t0) * 1000
            combined_results = reranked + combined_results[reranker_top_k:]

        # Log trace data
        self._log_search_trace({
            "query": query,
            "timestamp": time.time(),
            "tokens": tokenized_query.split(" "),
            "vector_results_count": len(vector_results),
            "bm25_results_count": len(bm25_results),
            "vector_top_5": dict(list(vector_results.items())[:5]),
            "bm25_top_5": dict(list(bm25_results.items())[:5]),
            "final_results": combined_results,
            "reranker_enabled": reranker_enabled,
            "stage_timings_ms": {
                "vector_ms": round(vector_ms, 2),
                "bm25_ms": round(bm25_ms, 2),
                "rrf_ms": round(rrf_ms, 2),
                "reranker_ms": round(reranker_ms, 2),
            },
        })

        return combined_results
    
    async def search_by_image(
        self,
        image_base64: str,
        session: AsyncSession,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for documents using an image (Image-to-Text/Document search via CLIP)
        """
        try:
            # 1. Generate image embedding
            image_embedding = self.embedding_service.encode_image_base64(image_base64)
            
            # 2. Vector search in document_embeddings 
            # (Find documents whose textual content matches the image content)
            embedding_list = image_embedding.tolist()
            embedding_str = str(embedding_list)
            
            # Use pgvector cosine similarity
            query = text(f"""
                SELECT 
                    de.document_id,
                    1 - (de.embedding <=> '{embedding_str}'::vector) as similarity
                FROM document_embeddings de
                ORDER BY de.embedding <=> '{embedding_str}'::vector
                LIMIT :limit
            """)
            
            result = await session.execute(query, {"limit": top_k})
            
            # 3. Return results
            return [
                {"document_id": row.document_id, "score": row.similarity}
                for row in result
            ]
        except Exception as e:
            print(f"❌ Image search error: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    async def _vector_search(
        self,
        query_embedding: np.ndarray,
        session: AsyncSession,
        limit: int
    ) -> Dict[int, float]:
        """
        Perform vector similarity search using HNSW index
        
        Returns:
            Dict mapping document_id to similarity score
        """
        try:
            # Convert numpy array to list for SQL
            embedding_list = query_embedding.tolist()
            
            # Use pgvector's cosine similarity operator
            # 使用原始SQL string interpolation避免参数绑定问题
            from sqlalchemy import select
            from models import DocumentEmbedding
            
            # 直接构造向量字符串
            embedding_str = str(embedding_list)
            
            query = text(f"""
                SELECT 
                    de.document_id,
                    1 - (de.embedding <=> '{embedding_str}'::vector) as similarity
                FROM document_embeddings de
                ORDER BY de.embedding <=> '{embedding_str}'::vector
                LIMIT :limit
            """)
            
            result = await session.execute(query, {"limit": limit})
            
            # Return as dict: document_id -> score
            return {row.document_id: row.similarity for row in result}
            
        except Exception as e:
            print(f"❌ Vector search error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {}
    
    async def _apply_filters(
        self,
        filters: Dict[str, Any],
        session: AsyncSession,
    ) -> set:
        """
        Return set of document IDs matching the given metadata filters.
        Returns None on error or when no active filters, so the caller can
        skip filtering entirely rather than returning zero results.
        """
        try:
            date_from = filters.get("date_from")
            date_to = filters.get("date_to")
            content_type = filters.get("content_type")
            source_type = filters.get("source_type")

            # Nothing active — skip entirely
            active = any([date_from, date_to,
                          content_type and content_type not in ("all", "All", ""),
                          source_type and source_type not in ("all", "All", "")])
            if not active:
                return None

            conditions = ["1=1"]
            params: Dict[str, Any] = {}

            if date_from:
                # date string "YYYY-MM-DD" — cast to date for clean comparison
                conditions.append("created_at >= :date_from::date")
                params["date_from"] = date_from
            if date_to:
                # +1 day so "2026-04-01" includes the full day
                conditions.append("created_at < :date_to::date + interval '1 day'")
                params["date_to"] = date_to

            # images column is JSON (not JSONB) — use json_array_length
            if content_type and content_type not in ("all", "All", ""):
                if content_type == "image":
                    conditions.append(
                        "images IS NOT NULL AND json_array_length(images) > 0"
                    )
                elif content_type == "text":
                    conditions.append(
                        "(images IS NULL OR json_array_length(images) = 0)"
                    )

            if source_type and source_type not in ("all", "All", ""):
                conditions.append("source_type = :source_type")
                params["source_type"] = source_type

            sql = "SELECT id FROM documents WHERE " + " AND ".join(conditions)
            result = await session.execute(text(sql), params)
            return {row.id for row in result}

        except Exception as e:
            print(f"⚠️  _apply_filters error (filters ignored): {e}")
            return None  # fail-open: don't wipe results on filter error

    async def _bm25_search(
        self,
        query: str,
        session: AsyncSession,
        limit: int
    ) -> Dict[int, float]:
        """
        使用自定义BM25算法进行全文检索
        
        Returns:
            Dict mapping document_id -> BM25 score
        """
        try:
            from bm25_calculator import get_bm25_calculator
            
            # 使用自定义BM25计算器
            bm25 = get_bm25_calculator()
            results = await bm25.search(query, session, top_k=limit)
            
            # 转换为 {doc_id: score} 格式
            return {r["document_id"]: r["score"] for r in results}
            
        except Exception as e:
            print(f"❌ BM25 search error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {}
    
    def _rrf_fusion(
        self,
        vector_results: Dict[int, float],
        bm25_results: Dict[int, float],
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """
        Reciprocal Rank Fusion of vector and BM25 result lists.

        RRF score for document d = sum over each list L of  1 / (k + rank_L(d))
        where rank is 0-indexed and k=60 (standard RRF constant).

        Returns the top_k documents sorted by descending RRF score.
        """
        k = 60  # RRF constant

        # Sort each result list by score descending to derive rank order
        vector_ranked = sorted(vector_results.items(), key=lambda x: x[1], reverse=True)
        bm25_ranked = sorted(bm25_results.items(), key=lambda x: x[1], reverse=True)

        # Build rank maps: document_id -> 0-indexed rank position
        vector_rank: Dict[int, int] = {
            doc_id: rank for rank, (doc_id, _) in enumerate(vector_ranked)
        }
        bm25_rank: Dict[int, int] = {
            doc_id: rank for rank, (doc_id, _) in enumerate(bm25_ranked)
        }

        # Compute RRF score for every document appearing in either list
        all_doc_ids = set(vector_rank.keys()) | set(bm25_rank.keys())
        rrf_scores: Dict[int, float] = {}
        for doc_id in all_doc_ids:
            score = 0.0
            if doc_id in vector_rank:
                score += 1.0 / (k + vector_rank[doc_id])
            if doc_id in bm25_rank:
                score += 1.0 / (k + bm25_rank[doc_id])
            rrf_scores[doc_id] = score

        sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [{"document_id": doc_id, "score": score} for doc_id, score in sorted_results]

    def _hybrid_rerank(
        self,
        vector_results: Dict[int, float],
        bm25_results: Dict[int, float],
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """
        Legacy weighted-sum fusion of vector and BM25 scores.

        Kept for backward compatibility.  The primary search pipeline now uses
        ``_rrf_fusion`` instead.
        """
        # Normalize scores to 0-1 range
        def normalize_scores(scores: Dict[int, float]) -> Dict[int, float]:
            if not scores:
                return {}
            max_score = max(scores.values())
            min_score = min(scores.values())
            if max_score == min_score:
                return {k: 1.0 for k in scores}
            return {
                k: (v - min_score) / (max_score - min_score)
                for k, v in scores.items()
            }

        norm_vector = normalize_scores(vector_results)
        norm_bm25 = normalize_scores(bm25_results)

        # Combine scores with configured weights
        all_doc_ids = set(norm_vector.keys()) | set(norm_bm25.keys())
        combined_scores: Dict[int, float] = {}

        for doc_id in all_doc_ids:
            vector_score = norm_vector.get(doc_id, 0.0)
            bm25_score = norm_bm25.get(doc_id, 0.0)
            combined_scores[doc_id] = (
                settings.VECTOR_WEIGHT * vector_score
                + settings.BM25_WEIGHT * bm25_score
            )

        sorted_results = sorted(
            combined_scores.items(), key=lambda x: x[1], reverse=True
        )[:top_k]

        return [
            {"document_id": doc_id, "score": score}
            for doc_id, score in sorted_results
        ]

    async def search_debug(
        self,
        query: str,
        session: AsyncSession,
        top_k: int = 20,
    ) -> Dict[str, Any]:
        """
        Run the full retrieval pipeline in debug mode.

        Returns all intermediate results: tokenization, BM25, vector,
        RRF fusion, and reranker — with per-stage timings.
        """
        import time as _time
        from index_service import get_index_service

        # ── Tokenization ──────────────────────────────────────────────────
        tokens = self.tokenizer_service.tokenize(query, mode="search")
        keywords = self.tokenizer_service.extract_keywords(query, top_k=10)
        tokenized_query = " ".join(tokens)

        # ── Stage 1a: BM25 ────────────────────────────────────────────────
        t0 = _time.time()
        bm25_results = await self._bm25_search(tokenized_query, session, top_k)
        bm25_ms = (_time.time() - t0) * 1000

        # ── Stage 1b: Vector ──────────────────────────────────────────────
        query_embedding = self.embedding_service.encode_text(query)[0]
        t0 = _time.time()
        vector_results = await self._vector_search(query_embedding, session, top_k)
        vector_ms = (_time.time() - t0) * 1000

        # ── Stage 1c: RRF fusion ──────────────────────────────────────────
        t0 = _time.time()
        rrf_results = self._rrf_fusion(vector_results, bm25_results, top_k)
        rrf_ms = (_time.time() - t0) * 1000

        # ── Stage 2: Reranker ─────────────────────────────────────────────
        reranker_results = None
        reranker_ms = 0.0
        try:
            reranker = get_reranker_service()
            t0 = _time.time()
            reranked = await reranker.rerank(query, rrf_results[:10], session)
            reranker_ms = (_time.time() - t0) * 1000
            reranker_results = reranked
        except Exception as _e:
            print(f"Reranker debug error: {_e}")

        # ── Enrich results with document metadata ─────────────────────────
        index_service = get_index_service()

        async def _enrich(doc_id: int, score: float, rank: int) -> Dict[str, Any]:
            doc = await index_service.get_document(doc_id, session)
            return {
                "rank": rank + 1,
                "document_id": doc_id,
                "title": doc.title if doc else f"Doc #{doc_id}",
                "url": doc.url if doc else "",
                "snippet": (doc.content[:150] + "...") if doc and len(doc.content) > 150 else (doc.content if doc else ""),
                "score": round(score, 6),
                "source_type": doc.source_type if doc else "unknown",
            }

        bm25_ranked = sorted(bm25_results.items(), key=lambda x: x[1], reverse=True)[:top_k]
        bm25_display = [await _enrich(did, sc, i) for i, (did, sc) in enumerate(bm25_ranked)]

        vec_ranked = sorted(vector_results.items(), key=lambda x: x[1], reverse=True)[:top_k]
        vec_display = [await _enrich(did, sc, i) for i, (did, sc) in enumerate(vec_ranked)]

        bm25_doc_ids = {did for did, _ in bm25_ranked}
        vec_doc_ids = {did for did, _ in vec_ranked}
        rrf_display = []
        for i, r in enumerate(rrf_results):
            did = r["document_id"]
            doc = await index_service.get_document(did, session)
            sources = []
            if did in bm25_doc_ids:
                sources.append("bm25")
            if did in vec_doc_ids:
                sources.append("vector")
            rrf_display.append({
                "rank": i + 1,
                "document_id": did,
                "title": doc.title if doc else f"Doc #{did}",
                "snippet": (doc.content[:150] + "...") if doc and len(doc.content) > 150 else (doc.content if doc else ""),
                "score": round(r["score"], 6),
                "sources": sources,
            })

        reranker_display = None
        if reranker_results:
            reranker_display = []
            for r in reranker_results:
                did = r["document_id"]
                doc = await index_service.get_document(did, session)
                reranker_display.append({
                    "document_id": did,
                    "title": doc.title if doc else f"Doc #{did}",
                    "snippet": (doc.content[:150] + "...") if doc and len(doc.content) > 150 else (doc.content if doc else ""),
                    "pre_rank": (r.get("pre_rank") or 0) + 1,
                    "post_rank": (r.get("post_rank") or 0) + 1,
                    "rank_delta": r.get("rank_delta", 0),
                    "score": round(r.get("score", 0), 6),
                })

        return {
            "query": query,
            "tokenization": {
                "original": query,
                "tokens": tokens,
                "keywords": keywords,
                "token_count": len(tokens),
            },
            "bm25": {
                "results": bm25_display,
                "time_ms": round(bm25_ms, 2),
                "count": len(bm25_results),
            },
            "vector": {
                "results": vec_display,
                "time_ms": round(vector_ms, 2),
                "count": len(vector_results),
            },
            "rrf": {
                "results": rrf_display,
                "time_ms": round(rrf_ms, 2),
                "count": len(rrf_results),
            },
            "reranker": {
                "results": reranker_display,
                "time_ms": round(reranker_ms, 2),
                "enabled": reranker_results is not None,
            },
            "stage_timings": {
                "bm25_ms": round(bm25_ms, 2),
                "vector_ms": round(vector_ms, 2),
                "rrf_ms": round(rrf_ms, 2),
                "reranker_ms": round(reranker_ms, 2),
            },
        }

    def get_suggestions(self, prefix: str, limit: int = 5, fuzzy: bool = True) -> List[str]:
        """
        Get keyword suggestions using RediSearch with fuzzy matching
        
        Args:
            prefix: The search prefix
            limit: Max suggestions to return
            fuzzy: Enable fuzzy matching (Levenshtein distance <= 1)
            
        Returns:
            List of suggested keywords
        """
        try:
            if not prefix:
                return []
            
            # Use RediSearch-based suggestion service
            from suggestion_service import get_suggestion_service
            suggestion_service = get_suggestion_service()
            
            # Get suggestions with fuzzy matching
            results = suggestion_service.get_suggestions(prefix, limit=limit, fuzzy=fuzzy)
            
            # Extract just the keywords
            return [r["keyword"] for r in results]
            
        except Exception as e:
            print(f"Failed to get suggestions: {e}")
            # Fallback to simple prefix matching if RediSearch fails
            try:
                keywords = self.redis_client.zrevrange("search:keywords", 0, 999)
                prefix_lower = prefix.lower()
                suggestions = [
                    k for k in keywords 
                    if k.lower().startswith(prefix_lower)
                ]
                return suggestions[:limit]
            except:
                return []

# Global search service instance
search_service = None

def get_search_service() -> SearchService:
    """Get or create search service singleton"""
    global search_service
    if search_service is None:
        search_service = SearchService()
    return search_service
