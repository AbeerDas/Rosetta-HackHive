"""Note management API routes."""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, status
from fastapi.responses import Response

from app.api.deps import NoteServiceDep
from app.schemas.note import (
    NoteGenerateRequest,
    NoteResponse,
    NoteStatusResponse,
    NoteUpdateRequest,
)

router = APIRouter()


@router.get("/sessions/{session_id}/notes", response_model=NoteResponse)
async def get_notes(
    session_id: UUID,
    service: NoteServiceDep,
) -> NoteResponse:
    """Get notes for a session."""
    notes = await service.get_notes(session_id)
    if not notes:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOTES_NOT_FOUND", "message": "Notes not found for session"},
        )
    return notes


@router.post("/sessions/{session_id}/notes/generate", response_model=NoteResponse)
async def generate_notes(
    session_id: UUID,
    data: NoteGenerateRequest,
    service: NoteServiceDep,
) -> NoteResponse:
    """Generate structured notes from transcript."""
    return await service.generate_notes(
        session_id=session_id,
        force_regenerate=data.force_regenerate,
    )


@router.put("/sessions/{session_id}/notes", response_model=NoteResponse)
async def update_notes(
    session_id: UUID,
    data: NoteUpdateRequest,
    service: NoteServiceDep,
) -> NoteResponse:
    """Update notes content."""
    return await service.update_notes(
        session_id=session_id,
        content=data.content_markdown,
    )


@router.get("/sessions/{session_id}/notes/status", response_model=NoteStatusResponse)
async def get_note_status(
    session_id: UUID,
    service: NoteServiceDep,
) -> NoteStatusResponse:
    """Get note generation status."""
    return await service.get_status(session_id)


@router.get("/sessions/{session_id}/notes/export")
async def export_notes_pdf(
    session_id: UUID,
    service: NoteServiceDep,
) -> Response:
    """Export notes as PDF."""
    pdf_bytes = await service.export_to_pdf(session_id)

    # Get session name for filename
    from app.api.deps import get_session_repository
    from app.core.database import get_async_session

    filename = f"lecture_notes_{session_id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
