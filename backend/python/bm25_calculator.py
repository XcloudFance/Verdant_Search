from typing import List, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from tokenizer_service import get_tokenizer_service

class BM25Calculator:
    """
    SQL-based BM25 Calculator
    Directly queries the inverted index (terms, postings) to calculate scores.
    """
    def __init__(self, k1=1.5, b=0.75):
        self.k1 = k1
        self.b = b
        self.tokenizer = get_tokenizer_service()

    async def search(self, query: str, session: AsyncSession, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Perform BM25 search using database-resident inverted index
        """
        # 1. Tokenize query
        tokens = self.tokenizer.tokenize(query, mode="search")
        if not tokens:
            return []

        # Dedup tokens for SQL query (we handle query term frequency if needed, but standard BM25 usually treats query as set or boosts weights)
        # Simple implementation: set of terms
        token_list = list(set(tokens)) 

        # 2. Get global stats
        # Ensure we have stats; if not, return empty (index might be empty)
        stats_res = await session.execute(text("SELECT total_docs, avg_doc_length FROM doc_stats WHERE id=1"))
        stats = stats_res.first()
        
        if not stats:
            # Maybe stats haven't been calculated yet?
            return []
        
        total_docs, avg_doc_length = stats
        if total_docs == 0 or avg_doc_length == 0:
            return []

        try:
            # 3. Calculate BM25 in SQL
            # Formula: IDF * ((TF * (k1 + 1)) / (TF + k1 * (1 - b + b * DL / AVGDL)))
            # IDF = ln( (N - n + 0.5) / (n + 0.5) + 1 )
            
            sql = text("""
            WITH q_terms AS (
                SELECT id, doc_frequency 
                FROM terms 
                WHERE term = ANY(:tokens)
            ),
            doc_matches AS (
                SELECT 
                    p.document_id,
                    t.doc_frequency,
                    p.term_frequency,
                    d.doc_length
                FROM postings p
                JOIN q_terms t ON p.term_id = t.id
                JOIN documents d ON p.document_id = d.id
            )
            SELECT 
                document_id,
                SUM(
                    LN( (:total_docs - doc_frequency + 0.5) / (doc_frequency + 0.5) + 1 ) *
                    ( (term_frequency * (:k1 + 1)) / (term_frequency + :k1 * (1 - :b + :b * (doc_length / :avg_doc_length))) )
                ) as score
            FROM doc_matches
            GROUP BY document_id
            ORDER BY score DESC
            LIMIT :limit
            """)
            
            result = await session.execute(sql, {
                "tokens": token_list,
                "total_docs": total_docs,
                "avg_doc_length": float(avg_doc_length),
                "k1": self.k1,
                "b": self.b,
                "limit": top_k
            })
            
            return [
                {"document_id": row.document_id, "score": float(row.score)}
                for row in result
            ]
        except Exception as e:
            print(f"BM25 SQL Error: {e}")
            return []

_calculator = None

def get_bm25_calculator() -> BM25Calculator:
    global _calculator
    if _calculator is None:
        _calculator = BM25Calculator()
    return _calculator
