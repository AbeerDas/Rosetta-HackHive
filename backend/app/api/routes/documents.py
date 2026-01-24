"""Document management API routes."""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, status

from app.api.deps import (
    ChromaClientDep,
    DocumentProcessingServiceDep,
    DocumentServiceDep,
)
from app.schemas.document import (
    DocumentResponse,
    DocumentsListResponse,
    DocumentStatusResponse,
)

router = APIRouter()


@router.get("/sessions/{session_id}/documents", response_model=DocumentsListResponse)
async def list_documents(
    session_id: UUID,
    service: DocumentServiceDep,
) -> DocumentsListResponse:
    """List all documents for a session."""
    return await service.list_documents(session_id)


@router.post(
    "/sessions/{session_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    session_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    service: DocumentServiceDep,
    processing_service: DocumentProcessingServiceDep,
) -> DocumentResponse:
    """Upload a document to a session."""
    document = await service.upload_document(session_id, file)

    # Process document in background
    background_tasks.add_task(
        processing_service.process_document,
        document.id,
    )

    return document


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    service: DocumentServiceDep,
) -> DocumentResponse:
    """Get document details."""
    return await service.get_document(document_id)


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    document_id: UUID,
    service: DocumentServiceDep,
) -> DocumentStatusResponse:
    """Get document processing status."""
    return await service.get_status(document_id)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: UUID,
    service: DocumentServiceDep,
    chroma_client: ChromaClientDep,
) -> None:
    """Delete a document."""
    await service.delete_document(document_id, chroma_client)


@router.post("/{document_id}/retry", response_model=DocumentResponse)
async def retry_document_processing(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    service: DocumentServiceDep,
    processing_service: DocumentProcessingServiceDep,
) -> DocumentResponse:
    """Retry processing a failed document."""
    document = await service.retry_processing(document_id)

    # Process document in background
    background_tasks.add_task(
        processing_service.process_document,
        document.id,
    )

    return document
