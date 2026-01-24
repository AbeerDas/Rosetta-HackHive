"""Health check schemas."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class HealthStatus(str, Enum):
    """Health status enumeration."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"


class HealthCheckResponse(BaseModel):
    """Basic health check response."""

    status: HealthStatus
    message: str
    version: str


class ServiceHealth(BaseModel):
    """Individual service health status."""

    service: str
    status: HealthStatus
    message: str
    details: Optional[dict] = None
