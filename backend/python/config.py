import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://verdant:verdant123@localhost:5432/verdant_search"
    
    # Embedding model
    EMBEDDING_MODEL: str = "sentence-transformers/clip-ViT-B-32"
    EMBEDDING_DIM: int = 512
    
    # Search parameters
    BM25_WEIGHT: float = 0.4
    VECTOR_WEIGHT: float = 0.6
    TOP_K_RESULTS: int = 20
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    
    # LLM Configuration
    LLM_PROVIDER: str = "anthropic"  # "openai" or "anthropic"
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = "sk-KgnQHw9ulBYq84cpiJvoGNY5wcrZK5xY6UZLbb3yeaut0rB7"
    OPENAI_BASE_URL: str = "https://yunwu.ai/v1"
    OPENAI_MODEL: str = "claude-haiku-4-5-20251001"
    
    # Anthropic Configuration
    ANTHROPIC_API_KEY: str = "123"
    ANTHROPIC_BASE_URL: str = "http://localhost:5201"
    ANTHROPIC_MODEL: str = "claude-haiku-4-5"
    
    # Redis Cache Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    CACHE_TTL: int = 600  # Cache TTL in seconds (10 minutes)
    ENABLE_CACHE: bool = True
    
    class Config:
        env_file = ".env"

settings = Settings()
