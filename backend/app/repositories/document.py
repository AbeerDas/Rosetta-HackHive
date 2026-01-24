"""Document and DocumentChunk repositories for data access operations."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document, DocumentChunk, DocumentStatus


class DocumentRepository:
    """Repository for document data access operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_session(self, session_id: UUID) -> list[Document]:
        """List all documents in a session."""
        query = (
            select(Document)
            .where(Document.session_id == session_id)
            .order_by(Document.uploaded_at.desc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, document_id: UUID) -> Optional[Document]:
        """Get a document by ID."""
        query = select(Document).where(Document.id == document_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_with_chunks(self, document_id: UUID) -> Optional[Document]:
        """Get a document with its chunks."""
        query = (
            select(Document)
            .where(Document.id == document_id)
            .options(selectinload(Document.chunks))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create(
        self,
        session_id: UUID,
        name: str,
        file_path: str,
        file_size: int,
    ) -> Document:
        """Create a new document record."""
        document = Document(
            session_id=session_id,
            name=name,
            file_path=file_path,
            file_size=file_size,
            status=DocumentStatus.PENDING,
        )
        self.db.add(document)
        await self.db.flush()
        await self.db.refresh(document)
        return document

    async def update_status(
        self,
        document_id: UUID,
        status: DocumentStatus,
        progress: int = 0,
        error_message: Optional[str] = None,
    ) -> Optional[Document]:
        """Update document processing status."""
        document = await self.get_by_id(document_id)
        if document:
            document.status = status
            document.processing_progress = progress
            document.error_message = error_message
            if status == DocumentStatus.READY:
                document.processed_at = datetime.now(timezone.utc)
            await self.db.flush()
            await self.db.refresh(document)
        return document

    async def update_processed(
        self,
        document_id: UUID,
        page_count: int,
        chunk_count: int,
    ) -> Optional[Document]:
        """Update document after processing completes."""
        document = await self.get_by_id(document_id)
        if document:
            document.page_count = page_count
            document.chunk_count = chunk_count
            document.status = DocumentStatus.READY
            document.processing_progress = 100
            document.processed_at = datetime.now(timezone.utc)
            await self.db.flush()
            await self.db.refresh(document)
        return document

    async def delete(self, document_id: UUID) -> bool:
        """Delete a document and its chunks."""
        document = await self.get_by_id(document_id)
        if document:
            await self.db.delete(document)
            await self.db.flush()
            return True
        return False

    async def get_ready_documents_for_session(self, session_id: UUID) -> list[Document]:
        """Get all ready documents for a session."""
        query = (
            select(Document)
            .where(
                Document.session_id == session_id,
                Document.status == DocumentStatus.READY,
            )
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())


class DocumentChunkRepository:
    """Repository for document chunk data access operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        document_id: UUID,
        chunk_index: int,
        page_number: int,
        content: str,
        token_count: int,
        section_heading: Optional[str] = None,
        embedding_id: Optional[str] = None,
    ) -> DocumentChunk:
        """Create a new document chunk."""
        chunk = DocumentChunk(
            document_id=document_id,
            chunk_index=chunk_index,
            page_number=page_number,
            section_heading=section_heading,
            content=content,
            token_count=token_count,
            embedding_id=embedding_id,
        )
        self.db.add(chunk)
        await self.db.flush()
        await self.db.refresh(chunk)
        return chunk

    async def create_batch(
        self,
        chunks: list[dict],
    ) -> list[DocumentChunk]:
        """Create multiple document chunks."""
        chunk_objects = []
        for chunk_data in chunks:
            chunk = DocumentChunk(**chunk_data)
            self.db.add(chunk)
            chunk_objects.append(chunk)
        await self.db.flush()
        for chunk in chunk_objects:
            await self.db.refresh(chunk)
        return chunk_objects

    async def list_by_document(self, document_id: UUID) -> list[DocumentChunk]:
        """List all chunks for a document."""
        query = (
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.chunk_index)
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, chunk_id: UUID) -> Optional[DocumentChunk]:
        """Get a chunk by ID."""
        query = select(DocumentChunk).where(DocumentChunk.id == chunk_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_embedding_id(self, embedding_id: str) -> Optional[DocumentChunk]:
        """Get a chunk by its embedding ID."""
        query = select(DocumentChunk).where(DocumentChunk.embedding_id == embedding_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def delete_by_document(self, document_id: UUID) -> int:
        """Delete all chunks for a document."""
        query = select(DocumentChunk).where(DocumentChunk.document_id == document_id)
        result = await self.db.execute(query)
        chunks = result.scalars().all()
        count = len(list(chunks))
        for chunk in chunks:
            await self.db.delete(chunk)
        await self.db.flush()
        return count

    async def update_embedding_id(
        self,
        chunk_id: UUID,
        embedding_id: str,
    ) -> Optional[DocumentChunk]:
        """Update a chunk's embedding ID."""
        chunk = await self.get_by_id(chunk_id)
        if chunk:
            chunk.embedding_id = embedding_id
            await self.db.flush()
            await self.db.refresh(chunk)
        return chunk
