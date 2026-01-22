import torch
from sentence_transformers import SentenceTransformer
from typing import List, Union
import numpy as np
from config import settings

class EmbeddingService:
    """Service for generating embeddings using CLIP model"""
    
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading embedding model on {self.device}...")
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL, device=self.device)
        print(f"Model loaded: {settings.EMBEDDING_MODEL}")
    
    def encode_text(self, texts: Union[str, List[str]]) -> np.ndarray:
        """Encode text into embeddings"""
        if isinstance(texts, str):
            texts = [texts]
        
        embeddings = self.model.encode(
            texts,
            convert_to_tensor=False,
            show_progress_bar=False,
            normalize_embeddings=True
        )
        return embeddings
    
    def encode_image(self, image_path: str) -> np.ndarray:
        """Encode image from file path"""
        from PIL import Image
        image = Image.open(image_path)
        return self._encode_image_object(image)

    def encode_image_base64(self, base64_string: str) -> np.ndarray:
        """Encode image from base64 string"""
        import base64
        from io import BytesIO
        from PIL import Image
        
        # Remove header if present (e.g. "data:image/jpeg;base64,")
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
            
        image_data = base64.b64decode(base64_string)
        image = Image.open(BytesIO(image_data))
        return self._encode_image_object(image)

    def _encode_image_object(self, image) -> np.ndarray:
        """Internal helper to encode PIL Image object"""
        embedding = self.model.encode(
            image,
            convert_to_tensor=False,
            show_progress_bar=False,
            normalize_embeddings=True
        )
        return embedding

# Global embedding service instance
embedding_service = None

def get_embedding_service() -> EmbeddingService:
    """Get or create embedding service singleton"""
    global embedding_service
    if embedding_service is None:
        embedding_service = EmbeddingService()
    return embedding_service
