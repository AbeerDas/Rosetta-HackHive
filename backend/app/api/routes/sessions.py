"""Session management API routes.

NOTE: Session CRUD operations are handled by Convex.
This file only handles ML-related operations like note generation.
"""

from fastapi import APIRouter, BackgroundTasks

from app.api.deps import NoteServiceDep
from app.schemas.session import (
    SessionEndRequest,
    SessionEndResponse,
)

router = APIRouter()


@router.get("")
async def sessions_info():
    """Info endpoint - session management is handled by Convex."""
    return {
        "message": "Session management is handled by Convex.",
        "hint": "Use Convex queries for session CRUD operations.",
    }


@router.post("/{session_id}/end", response_model=SessionEndResponse)
async def end_session(
    session_id: str,  # Convex session ID
    data: SessionEndRequest,
    background_tasks: BackgroundTasks,
    note_service: NoteServiceDep,
) -> SessionEndResponse:
    """End an active session and optionally trigger note generation.
    
    Note: Session state management is handled by Convex.
    This endpoint only triggers ML-related tasks like note generation.
    """
    response = SessionEndResponse(
        status="completed",
        notes_generated=False,
    )

    # Trigger note generation in background if requested
    if data.generate_notes:
        background_tasks.add_task(
            note_service.generate_notes,
            session_id,
            False,
        )
        response.notes_generated = True

    return response
