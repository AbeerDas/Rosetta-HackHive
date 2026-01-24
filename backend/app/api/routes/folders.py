"""Folder management API routes."""

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import FolderServiceDep
from app.schemas.folder import (
    FolderCreate,
    FolderDetail,
    FolderResponse,
    FoldersListResponse,
    FolderUpdate,
)

router = APIRouter()


@router.get("", response_model=FoldersListResponse)
async def list_folders(service: FolderServiceDep) -> FoldersListResponse:
    """List all folders."""
    folders = await service.list_folders()
    return FoldersListResponse(folders=folders)


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    data: FolderCreate,
    service: FolderServiceDep,
) -> FolderResponse:
    """Create a new folder."""
    return await service.create_folder(data)


@router.get("/{folder_id}", response_model=FolderDetail)
async def get_folder(
    folder_id: UUID,
    service: FolderServiceDep,
) -> FolderDetail:
    """Get folder details with sessions."""
    return await service.get_folder(folder_id)


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    data: FolderUpdate,
    service: FolderServiceDep,
) -> FolderResponse:
    """Update a folder."""
    return await service.update_folder(folder_id, data)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: UUID,
    service: FolderServiceDep,
) -> None:
    """Delete (archive) a folder."""
    await service.delete_folder(folder_id)
