"""Folder repository for data access operations."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.folder import Folder
from app.models.session import Session


class FolderRepository:
    """Repository for folder data access operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self, include_archived: bool = False) -> list[Folder]:
        """List all folders, optionally including archived ones."""
        query = select(Folder)
        if not include_archived:
            query = query.where(Folder.archived_at.is_(None))
        query = query.order_by(Folder.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, folder_id: UUID) -> Optional[Folder]:
        """Get a folder by ID."""
        query = select(Folder).where(Folder.id == folder_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_sessions(self, folder_id: UUID) -> Optional[Folder]:
        """Get a folder with its sessions."""
        query = (
            select(Folder)
            .where(Folder.id == folder_id)
            .options(selectinload(Folder.sessions))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create(self, name: str) -> Folder:
        """Create a new folder."""
        folder = Folder(name=name.strip())
        self.db.add(folder)
        await self.db.flush()
        await self.db.refresh(folder)
        return folder

    async def update(self, folder_id: UUID, name: str) -> Optional[Folder]:
        """Update a folder's name."""
        folder = await self.get_by_id(folder_id)
        if folder:
            folder.name = name.strip()
            await self.db.flush()
            await self.db.refresh(folder)
        return folder

    async def archive(self, folder_id: UUID) -> bool:
        """Soft-delete a folder by setting archived_at."""
        folder = await self.get_with_sessions(folder_id)
        if folder:
            folder.archived_at = datetime.now(timezone.utc)
            # Also archive all sessions
            for session in folder.sessions:
                session.archived_at = datetime.now(timezone.utc)
            await self.db.flush()
            return True
        return False

    async def name_exists(
        self,
        name: str,
        exclude_id: Optional[UUID] = None,
    ) -> bool:
        """Check if a folder name already exists."""
        query = select(func.count()).select_from(Folder).where(
            func.lower(Folder.name) == func.lower(name.strip()),
            Folder.archived_at.is_(None),
        )
        if exclude_id:
            query = query.where(Folder.id != exclude_id)
        result = await self.db.execute(query)
        count = result.scalar_one()
        return count > 0

    async def get_session_count(self, folder_id: UUID) -> int:
        """Get count of non-archived sessions in a folder."""
        query = (
            select(func.count())
            .select_from(Session)
            .where(
                Session.folder_id == folder_id,
                Session.archived_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one()
