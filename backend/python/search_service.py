from rank_bm25 import BM25Okapi
from typing import List, Dict, Any
import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from models import Document, DocumentEmbedding, ImageEmbedding
from embedding_service import get_embedding_service
from tokenizer_service import get_tokenizer_service
from config import settings
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
                "top_score": trace_data["final_results"][0]["score"] if trace_data["final_results"] else 0
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
        top_k: int = None
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search combining BM25 and vector similarity
        
        Args:
            query: Search query text (will be tokenized)
            session: Database session
            top_k: Number of results to return
        
        Returns:
            List of search results with scores
        """
        if top_k is None:
            top_k = settings.TOP_K_RESULTS
        
        # Tokenize query for BM25
        tokenized_query = self.preprocess_query(query)
        
        # Get query embedding (use original query for semantic search)
        query_embedding = self.embedding_service.encode_text(query)[0]
        
        # 1. Vector search using HNSW index
        vector_results = await self._vector_search(query_embedding, session, top_k * 2)
        
        # 2. BM25 full-text search (with tokenized query)
        bm25_results = await self._bm25_search(tokenized_query, session, top_k * 2)
        
        # 3. Combine and re-rank results
        combined_results = self._hybrid_rerank(vector_results, bm25_results, top_k)
        
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
            "weights": {
                "vector": settings.VECTOR_WEIGHT,
                "bm25": settings.BM25_WEIGHT
            }
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
    
    def _hybrid_rerank(
        self,
        vector_results: Dict[int, float],
        bm25_results: Dict[int, float],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """
        Combine and re-rank results from vector and BM25 search
        
        Uses weighted combination of scores
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
        
        # Combine scores with weights
        all_doc_ids = set(norm_vector.keys()) | set(norm_bm25.keys())
        combined_scores = {}
        
        for doc_id in all_doc_ids:
            vector_score = norm_vector.get(doc_id, 0.0)
            bm25_score = norm_bm25.get(doc_id, 0.0)
            
            # Weighted combination
            combined_score = (
                settings.VECTOR_WEIGHT * vector_score +
                settings.BM25_WEIGHT * bm25_score
            )
            combined_scores[doc_id] = combined_score
        
        # Sort by combined score
        sorted_results = sorted(
            combined_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )[:top_k]
        
        # Return document IDs and scores
        return [
            {"document_id": doc_id, "score": score}
            for doc_id, score in sorted_results
        ]

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
