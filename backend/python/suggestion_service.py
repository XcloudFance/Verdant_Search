"""
RediSearch-based Keyword Suggestion Service
Uses Trie structure + Levenshtein Distance (fuzzy matching) for intelligent autocomplete
"""
from typing import List, Dict, Any
import redis
from redis.commands.search.field import TextField, NumericField
from redis.commands.search.index_definition import IndexDefinition, IndexType
from redis.commands.search.query import Query
from config import settings
import logging

logger = logging.getLogger(__name__)


class SuggestionService:
    """
    Intelligent keyword suggestion service using RediSearch
    Features:
    - Trie-based prefix matching
    - Fuzzy search with Levenshtein distance <= 5
    - Popularity-based ranking
    """
    
    INDEX_NAME = "idx:search_keywords"
    KEY_PREFIX = "keyword:"
    
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD,
            decode_responses=True
        )
        self._ensure_index()
    
    def _ensure_index(self):
        """Create RediSearch index if it doesn't exist"""
        try:
            # Check if index exists
            self.redis_client.ft(self.INDEX_NAME).info()
            logger.info(f"RediSearch index '{self.INDEX_NAME}' already exists")
        except:
            # Create index
            try:
                schema = (
                    TextField("keyword", sortable=True),
                    NumericField("count", sortable=True),
                )
                
                definition = IndexDefinition(
                    prefix=[self.KEY_PREFIX],
                    index_type=IndexType.HASH
                )
                
                self.redis_client.ft(self.INDEX_NAME).create_index(
                    schema,
                    definition=definition
                )
                logger.info(f"Created RediSearch index '{self.INDEX_NAME}'")
            except Exception as e:
                logger.error(f"Failed to create RediSearch index: {e}")
    
    def add_keyword(self, keyword: str, increment: int = 1):
        """
        Add or update a keyword in the search history
        
        Args:
            keyword: The search keyword
            increment: How much to increment the count (default: 1)
        """
        try:
            keyword = keyword.strip().lower()
            if not keyword:
                return
            
            key = f"{self.KEY_PREFIX}{keyword}"
            
            # Get current count
            current_count = self.redis_client.hget(key, "count")
            new_count = int(current_count or 0) + increment
            
            # Update keyword data
            self.redis_client.hset(key, mapping={
                "keyword": keyword,
                "count": new_count
            })
            
            logger.debug(f"Updated keyword '{keyword}' with count {new_count}")
        except Exception as e:
            logger.error(f"Failed to add keyword '{keyword}': {e}")
    
    def get_suggestions(
        self, 
        prefix: str, 
        limit: int = 5,
        fuzzy: bool = True,
        max_distance: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get keyword suggestions based on prefix with fuzzy matching
        
        Args:
            prefix: The search prefix
            limit: Maximum number of suggestions to return
            fuzzy: Enable fuzzy matching (Levenshtein distance <= max_distance)
            max_distance: Maximum Levenshtein distance for fuzzy matching (1-5)
        
        Returns:
            List of suggestions with keyword and count
        """
        try:
            if not prefix or not prefix.strip():
                return []
            
            prefix = prefix.strip().lower()
            
            # Try multiple strategies to get best results
            all_results = {}
            
            if fuzzy:
                # Strategy 1: Fuzzy matching with increasing distances
                # RediSearch fuzzy syntax: %term% (distance 1), %%term%% (distance 2), etc.
                for distance in range(1, min(max_distance + 1, 6)):  # Max 5 in RediSearch
                    try:
                        # Build fuzzy query: more % = larger distance
                        percent_signs = "%" * distance
                        query_str = f"{percent_signs}{prefix}{percent_signs}"
                        
                        query = (
                            Query(query_str)
                            .sort_by("count", asc=False)
                            .paging(0, limit * 2)  # Get more to filter
                        )
                        
                        results = self.redis_client.ft(self.INDEX_NAME).search(query)
                        
                        for doc in results.docs:
                            keyword = doc.keyword
                            if keyword not in all_results:
                                all_results[keyword] = {
                                    "keyword": keyword,
                                    "count": int(doc.count),
                                    "distance": distance
                                }
                        
                        # If we have enough results, stop trying larger distances
                        if len(all_results) >= limit:
                            break
                    except Exception as e:
                        logger.debug(f"Fuzzy search distance {distance} failed: {e}")
                        continue
            
            # Strategy 2: Prefix matching (always try this)
            try:
                query_str = f"{prefix}*"
                query = (
                    Query(query_str)
                    .sort_by("count", asc=False)
                    .paging(0, limit)
                )
                
                results = self.redis_client.ft(self.INDEX_NAME).search(query)
                
                for doc in results.docs:
                    keyword = doc.keyword
                    if keyword not in all_results:
                        all_results[keyword] = {
                            "keyword": keyword,
                            "count": int(doc.count),
                            "distance": 0  # Exact prefix match
                        }
            except Exception as e:
                logger.debug(f"Prefix search failed: {e}")
            
            # Sort by: 1) distance (prefer exact/close matches), 2) count (popularity)
            sorted_results = sorted(
                all_results.values(),
                key=lambda x: (x["distance"], -x["count"])
            )[:limit]
            
            # Remove distance field from output
            suggestions = [
                {"keyword": r["keyword"], "count": r["count"]}
                for r in sorted_results
            ]
            
            logger.debug(f"Found {len(suggestions)} suggestions for '{prefix}'")
            return suggestions
            
        except Exception as e:
            logger.error(f"Failed to get suggestions for '{prefix}': {e}")
            return []
    
    def get_top_keywords(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get top keywords by popularity
        
        Args:
            limit: Maximum number of keywords to return
        
        Returns:
            List of top keywords with counts
        """
        try:
            query = (
                Query("*")
                .sort_by("count", asc=False)
                .paging(0, limit)
            )
            
            results = self.redis_client.ft(self.INDEX_NAME).search(query)
            
            keywords = []
            for doc in results.docs:
                keywords.append({
                    "keyword": doc.keyword,
                    "count": int(doc.count)
                })
            
            return keywords
        except Exception as e:
            logger.error(f"Failed to get top keywords: {e}")
            return []
    
    def clear_all(self):
        """Clear all keywords (for testing/admin purposes)"""
        try:
            # Delete all keys with our prefix
            keys = self.redis_client.keys(f"{self.KEY_PREFIX}*")
            if keys:
                self.redis_client.delete(*keys)
            logger.info(f"Cleared {len(keys)} keywords")
        except Exception as e:
            logger.error(f"Failed to clear keywords: {e}")


# Global instance
_suggestion_service = None

def get_suggestion_service() -> SuggestionService:
    """Get or create suggestion service singleton"""
    global _suggestion_service
    if _suggestion_service is None:
        _suggestion_service = SuggestionService()
    return _suggestion_service
