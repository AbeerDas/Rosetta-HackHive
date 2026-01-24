"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ===========================================
    # Application Settings
    # ===========================================
    debug: bool = Field(default=True)
    log_level: str = Field(default="INFO")
    secret_key: str = Field(default="change-me-in-production")

    # ===========================================
    # API Settings
    # ===========================================
    api_v1_prefix: str = Field(default="/api/v1")

    # CORS
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:3000")

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # ===========================================
    # External API Keys
    # ===========================================
    elevenlabs_api_key: str = Field(default="")
    openrouter_api_key: str = Field(default="")

    # ===========================================
    # Database Configuration
    # ===========================================
    postgres_user: str = Field(default="lecturelens")
    postgres_password: str = Field(default="lecturelens_dev")
    postgres_db: str = Field(default="lecturelens")
    postgres_host: str = Field(default="localhost")
    postgres_port: int = Field(default=5432)
    database_url: str = Field(
        default="postgresql+asyncpg://lecturelens:lecturelens_dev@localhost:5432/lecturelens"
    )

    @property
    def sync_database_url(self) -> str:
        """Return synchronous database URL for Alembic."""
        return self.database_url.replace("+asyncpg", "")

    # ===========================================
    # Chroma Configuration
    # ===========================================
    chroma_host: str = Field(default="localhost")
    chroma_port: int = Field(default=8000)

    @property
    def chroma_url(self) -> str:
        """Return Chroma server URL."""
        return f"http://{self.chroma_host}:{self.chroma_port}"

    # ===========================================
    # Model Configuration
    # ===========================================
    # Local embedding model for both indexing and RAG queries (must match!)
    local_embedding_model: str = Field(default="BAAI/bge-base-en-v1.5")
    
    # Cross-encoder for re-ranking (TinyBERT for speed)
    reranker_model: str = Field(default="cross-encoder/ms-marco-TinyBERT-L-2-v2")
    
    # KeyBERT backbone for keyword extraction
    keybert_model: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")
    
    # RAG pipeline settings
    rag_top_k_candidates: int = Field(default=5)  # Candidates for re-ranking
    rag_top_k_results: int = Field(default=3)  # Final results to return
    rag_relevance_threshold: float = Field(default=0.4)  # Minimum re-ranker score
    rag_distance_threshold: float = Field(default=1.5)  # Max L2 distance for early exit
    
    # LLM models (still used for other features like translation, notes)
    llm_model: str = Field(default="anthropic/claude-3-haiku-20240307")
    llm_model_fallback: str = Field(default="openai/gpt-4o-mini")
    
    # Legacy embedding models (kept for reference, no longer used for RAG)
    embedding_model_realtime: str = Field(default="openai/text-embedding-3-large")
    embedding_model_indexing: str = Field(default="openai/text-embedding-3-large")

    # ===========================================
    # ElevenLabs Configuration
    # ===========================================
    elevenlabs_voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM")
    elevenlabs_model_id: str = Field(default="eleven_turbo_v2_5")

    # ===========================================
    # File Storage
    # ===========================================
    upload_dir: str = Field(default="./uploads")
    max_upload_size_mb: int = Field(default=50)

    @property
    def max_upload_size_bytes(self) -> int:
        """Return max upload size in bytes."""
        return self.max_upload_size_mb * 1024 * 1024

    # ===========================================
    # Supported Languages
    # ===========================================
    @property
    def supported_languages(self) -> dict[str, str]:
        """Return supported language codes and names."""
        return {
            "en": "English",
            "hi": "Hindi",
            "zh": "Chinese (Mandarin)",
            "fr": "French",
            "es": "Spanish",
            "bn": "Bengali",
        }


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
