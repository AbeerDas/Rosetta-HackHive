"""Health check endpoints."""

import logging
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.deps import PineconeClientDep
from app.core.config import settings
from app.schemas.health import (
    HealthCheckResponse,
    HealthStatus,
    ServiceHealth,
)

logger = logging.getLogger(__name__)


class WarmupResponse(BaseModel):
    """Response for warmup endpoint."""
    status: str
    message: str
    warmup_time_ms: int
    models_loaded: list[str]

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check() -> HealthCheckResponse:
    """Basic health check endpoint."""
    return HealthCheckResponse(
        status=HealthStatus.HEALTHY,
        message="Rosetta API is running",
        version="1.0.0",
    )


@router.get("/health/pinecone", response_model=ServiceHealth)
async def health_check_pinecone(pinecone: PineconeClientDep) -> ServiceHealth:
    """Check Pinecone vector database connectivity."""
    try:
        healthy = await pinecone.health_check()
        if healthy:
            return ServiceHealth(
                service="Pinecone",
                status=HealthStatus.HEALTHY,
                message="Pinecone connection successful",
            )
        return ServiceHealth(
            service="Pinecone",
            status=HealthStatus.UNHEALTHY,
            message="Pinecone health check failed",
        )
    except Exception as e:
        return ServiceHealth(
            service="Pinecone",
            status=HealthStatus.UNHEALTHY,
            message=f"Pinecone connection failed: {str(e)}",
        )


@router.get("/health/elevenlabs", response_model=ServiceHealth)
async def health_check_elevenlabs() -> ServiceHealth:
    """Check ElevenLabs API key validity."""
    if not settings.elevenlabs_api_key:
        return ServiceHealth(
            service="ElevenLabs",
            status=HealthStatus.UNHEALTHY,
            message="ElevenLabs API key not configured",
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.elevenlabs.io/v1/user",
                headers={"xi-api-key": settings.elevenlabs_api_key},
                timeout=10.0,
            )
            if response.status_code == 200:
                return ServiceHealth(
                    service="ElevenLabs",
                    status=HealthStatus.HEALTHY,
                    message="ElevenLabs API key is valid",
                )
            return ServiceHealth(
                service="ElevenLabs",
                status=HealthStatus.UNHEALTHY,
                message=f"ElevenLabs API returned status {response.status_code}",
            )
    except Exception as e:
        return ServiceHealth(
            service="ElevenLabs",
            status=HealthStatus.UNHEALTHY,
            message=f"ElevenLabs API check failed: {str(e)}",
        )


@router.get("/health/openrouter", response_model=ServiceHealth)
async def health_check_openrouter() -> ServiceHealth:
    """Check OpenRouter API key validity."""
    if not settings.openrouter_api_key:
        return ServiceHealth(
            service="OpenRouter",
            status=HealthStatus.UNHEALTHY,
            message="OpenRouter API key not configured",
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/auth/key",
                headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                timeout=10.0,
            )
            if response.status_code == 200:
                return ServiceHealth(
                    service="OpenRouter",
                    status=HealthStatus.HEALTHY,
                    message="OpenRouter API key is valid",
                )
            return ServiceHealth(
                service="OpenRouter",
                status=HealthStatus.UNHEALTHY,
                message=f"OpenRouter API returned status {response.status_code}",
            )
    except Exception as e:
        return ServiceHealth(
            service="OpenRouter",
            status=HealthStatus.UNHEALTHY,
            message=f"OpenRouter API check failed: {str(e)}",
        )


@router.get("/health/warmup", response_model=WarmupResponse)
async def warmup_backend() -> WarmupResponse:
    """
    Warmup endpoint to pre-load ML models after cold start.
    
    This endpoint is called by the frontend when it detects a cold start
    to pre-load models before the user needs them. This improves UX by
    loading models in the background while showing a "warming up" indicator.
    
    Models loaded:
    - bge-base-en-v1.5 (embeddings)
    - TinyBERT (reranking)
    - KeyBERT backbone (keyword extraction)
    """
    start_time = time.time()
    models_loaded = []
    
    try:
        # Pre-load embedding model
        logger.info("[Warmup] Loading embedding model...")
        from app.external.embeddings import get_local_embedding_service
        embedding_service = get_local_embedding_service()
        # Trigger model load by accessing the model property
        _ = embedding_service.model
        models_loaded.append("bge-base-en-v1.5 (embeddings)")
        logger.info("[Warmup] Embedding model loaded")
        
        # Pre-load reranker model
        logger.info("[Warmup] Loading reranker model...")
        from app.services.rag import RerankerService
        reranker = RerankerService()
        # Trigger model load
        _ = reranker.model
        models_loaded.append("TinyBERT (reranking)")
        logger.info("[Warmup] Reranker model loaded")
        
        # Pre-load KeyBERT model
        logger.info("[Warmup] Loading KeyBERT model...")
        from app.services.rag import KeywordExtractor
        keyword_extractor = KeywordExtractor()
        # Trigger model load
        _ = keyword_extractor.model
        models_loaded.append("all-MiniLM-L6-v2 (keywords)")
        logger.info("[Warmup] KeyBERT model loaded")
        
        warmup_time = int((time.time() - start_time) * 1000)
        logger.info(f"[Warmup] All models loaded in {warmup_time}ms")
        
        return WarmupResponse(
            status="ready",
            message="Backend is warm and ready",
            warmup_time_ms=warmup_time,
            models_loaded=models_loaded,
        )
        
    except Exception as e:
        warmup_time = int((time.time() - start_time) * 1000)
        logger.error(f"[Warmup] Error during warmup: {e}")
        return WarmupResponse(
            status="partial",
            message=f"Warmup completed with errors: {str(e)}",
            warmup_time_ms=warmup_time,
            models_loaded=models_loaded,
        )
