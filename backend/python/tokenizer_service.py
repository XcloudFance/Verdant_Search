import jieba
import jieba.analyse
from typing import List, Optional

class TokenizerService:
    """Service for Chinese and English text tokenization"""
    
    def __init__(self):
        # Load jieba dictionary (will be loaded on first use)
        jieba.initialize()
        print("Jieba tokenizer initialized")
    
    def tokenize(self, text: str, mode: str = "search") -> List[str]:
        """
        Tokenize text into words
        
        Args:
            text: Input text (Chinese or English)
            mode: 'search' for search engine mode, 'accurate' for accurate mode
        
        Returns:
            List of tokens
        """
        if not text:
            return []
        
        if mode == "search":
            # Search engine mode - good for search queries and indexing
            tokens = jieba.cut_for_search(text)
        else:
            # Accurate mode - default mode
            tokens = jieba.cut(text, cut_all=False)
        
        # Filter out whitespace and very short tokens
        tokens = [token.strip() for token in tokens if token.strip() and len(token.strip()) > 1]
        
        return tokens
    
    def extract_keywords(self, text: str, top_k: int = 10) -> List[str]:
        """
        Extract keywords from text using TF-IDF
        
        Args:
            text: Input text
            top_k: Number of keywords to extract
        
        Returns:
            List of keywords
        """
        keywords = jieba.analyse.extract_tags(text, topK=top_k, withWeight=False)
        return keywords
    
    def tokenize_with_pos(self, text: str) -> List[tuple]:
        """
        Tokenize with part-of-speech tagging
        
        Returns:
            List of (word, pos_tag) tuples
        """
        import jieba.posseg as pseg
        words = pseg.cut(text)
        return [(word, flag) for word, flag in words]

# Global tokenizer service instance
tokenizer_service = None

def get_tokenizer_service() -> TokenizerService:
    """Get or create tokenizer service singleton"""
    global tokenizer_service
    if tokenizer_service is None:
        tokenizer_service = TokenizerService()
    return tokenizer_service
