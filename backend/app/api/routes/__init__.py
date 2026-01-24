"""API route modules."""

from fastapi import APIRouter

from app.api.routes import (
    documents,
    folders,
    health,
    notes,
    rag,
    sessions,
    transcribe,
    translate,
)

# Main API router
api_router = APIRouter()

# Include all route modules
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(folders.router, prefix="/folders", tags=["Folders"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["Sessions"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(translate.router, prefix="/translate", tags=["Translation"])
api_router.include_router(transcribe.router, prefix="/transcribe", tags=["Transcription"])
api_router.include_router(rag.router, prefix="/rag", tags=["RAG"])
api_router.include_router(notes.router, tags=["Notes"])
