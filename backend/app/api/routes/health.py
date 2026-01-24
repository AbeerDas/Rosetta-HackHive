"""Health check endpoints."""

import httpx
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text

from app.api.deps import AsyncSessionDep, ChromaClientDep
from app.core.config import settings
from app.schemas.health import (
    HealthCheckResponse,
    HealthStatus,
    ServiceHealth,
)

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check() -> HealthCheckResponse:
    """Basic health check endpoint."""
    return HealthCheckResponse(
        status=HealthStatus.HEALTHY,
        message="LectureLens API is running",
        version="1.0.0",
    )


@router.get("/health/db", response_model=ServiceHealth)
async def health_check_database(db: AsyncSessionDep) -> ServiceHealth:
    """Check database connectivity."""
    try:
        await db.execute(text("SELECT 1"))
        return ServiceHealth(
            service="PostgreSQL",
            status=HealthStatus.HEALTHY,
            message="Database connection successful",
        )
    except Exception as e:
        return ServiceHealth(
            service="PostgreSQL",
            status=HealthStatus.UNHEALTHY,
            message=f"Database connection failed: {str(e)}",
        )


@router.get("/health/chroma", response_model=ServiceHealth)
async def health_check_chroma(chroma: ChromaClientDep) -> ServiceHealth:
    """Check Chroma vector database connectivity."""
    try:
        heartbeat = await chroma.heartbeat()
        if heartbeat:
            return ServiceHealth(
                service="Chroma",
                status=HealthStatus.HEALTHY,
                message="Chroma connection successful",
            )
        return ServiceHealth(
            service="Chroma",
            status=HealthStatus.UNHEALTHY,
            message="Chroma heartbeat failed",
        )
    except Exception as e:
        return ServiceHealth(
            service="Chroma",
            status=HealthStatus.UNHEALTHY,
            message=f"Chroma connection failed: {str(e)}",
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
