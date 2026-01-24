"""Citation model for RAG-retrieved references."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.document import Document, DocumentChunk
    from app.models.session import Session
    from app.models.transcript import Transcript


class Citation(Base):
    """Citation model representing a RAG-retrieved document reference."""

    __tablename__ = "citations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transcript_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transcripts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="CASCADE"),
        nullable=False,
    )
    window_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    rank: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    page_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    section_heading: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    snippet: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    relevance_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    session: Mapped["Session"] = relationship(
        "Session",
        back_populates="citations",
    )
    transcript: Mapped[Optional["Transcript"]] = relationship(
        "Transcript",
        back_populates="citations",
    )
    document: Mapped["Document"] = relationship(
        "Document",
        back_populates="citations",
    )
    chunk: Mapped["DocumentChunk"] = relationship(
        "DocumentChunk",
        back_populates="citations",
    )

    def __repr__(self) -> str:
        return f"<Citation(id={self.id}, rank={self.rank}, document_id={self.document_id})>"
