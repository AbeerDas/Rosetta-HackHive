"""Folder model for course/subject organization."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.session import Session


class Folder(Base):
    """Folder model representing a course or subject."""

    __tablename__ = "folders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Relationships
    sessions: Mapped[List["Session"]] = relationship(
        "Session",
        back_populates="folder",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def is_archived(self) -> bool:
        """Check if the folder is archived."""
        return self.archived_at is not None

    @property
    def session_count(self) -> int:
        """Get count of non-archived sessions."""
        return len([s for s in self.sessions if not s.is_archived])

    def __repr__(self) -> str:
        return f"<Folder(id={self.id}, name='{self.name}')>"
