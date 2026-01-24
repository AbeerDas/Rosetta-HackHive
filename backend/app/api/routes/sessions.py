"""Session management API routes."""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.api.deps import (
    NoteServiceDep,
    SessionServiceDep,
    get_session_service,
)
from app.schemas.session import (
    SessionCreate,
    SessionDetail,
    SessionEndRequest,
    SessionEndResponse,
    SessionResponse,
    SessionUpdate,
)

router = APIRouter()


@router.post(
    "/{folder_id}/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    folder_id: UUID,
    data: SessionCreate,
    service: SessionServiceDep,
) -> SessionResponse:
    """Create a new session in a folder."""
    return await service.create_session(folder_id, data)


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(
    session_id: UUID,
    service: SessionServiceDep,
) -> SessionDetail:
    """Get session details with documents."""
    return await service.get_session(session_id)


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: UUID,
    data: SessionUpdate,
    service: SessionServiceDep,
) -> SessionResponse:
    """Update a session."""
    return await service.update_session(session_id, data)


@router.post("/{session_id}/end", response_model=SessionEndResponse)
async def end_session(
    session_id: UUID,
    data: SessionEndRequest,
    background_tasks: BackgroundTasks,
    service: SessionServiceDep,
    note_service: NoteServiceDep,
) -> SessionEndResponse:
    """End an active session."""
    response = await service.end_session(session_id, data)

    # Trigger note generation in background if requested
    if data.generate_notes:
        background_tasks.add_task(
            note_service.generate_notes,
            session_id,
            False,
        )
        response.notes_generated = True

    return response


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    service: SessionServiceDep,
) -> None:
    """Delete (archive) a session."""
    await service.delete_session(session_id)
