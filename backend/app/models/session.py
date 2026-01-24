"""Session model for lecture recording sessions."""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.citation import Citation
    from app.models.document import Document
    from app.models.folder import Folder
    from app.models.note import Note
    from app.models.transcript import Transcript


class SessionStatus(str, enum.Enum):
    """Session status enumeration."""

    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Session(Base):
    """Session model representing a lecture recording session."""

    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    folder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus),
        default=SessionStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    source_language: Mapped[str] = mapped_column(
        String(10),
        default="en",
        nullable=False,
    )
    target_language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    folder: Mapped["Folder"] = relationship(
        "Folder",
        back_populates="sessions",
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    transcripts: Mapped[List["Transcript"]] = relationship(
        "Transcript",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="Transcript.segment_index",
    )
    citations: Mapped[List["Citation"]] = relationship(
        "Citation",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    note: Mapped[Optional["Note"]] = relationship(
        "Note",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def is_archived(self) -> bool:
        """Check if the session is archived."""
        return self.archived_at is not None or self.status == SessionStatus.ARCHIVED

    @property
    def is_active(self) -> bool:
        """Check if the session is active."""
        return self.status == SessionStatus.ACTIVE

    @property
    def has_notes(self) -> bool:
        """Check if the session has generated notes."""
        return self.note is not None

    @property
    def document_count(self) -> int:
        """Get count of documents in session."""
        return len(self.documents)

    @property
    def duration_seconds(self) -> Optional[float]:
        """Get session duration in seconds."""
        if self.ended_at:
            return (self.ended_at - self.started_at).total_seconds()
        return None

    def __repr__(self) -> str:
        return f"<Session(id={self.id}, name='{self.name}', status={self.status})>"
