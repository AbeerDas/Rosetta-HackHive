"""Document service for business logic and processing."""

import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import UUID

import aiofiles
from fastapi import HTTPException, UploadFile, status
from PyPDF2 import PdfReader

from app.core.config import settings
from app.external.chroma import ChromaClient
from app.external.embeddings import LocalEmbeddingService
from app.models.document import DocumentStatus
from app.repositories.document import DocumentChunkRepository, DocumentRepository
from app.repositories.session import SessionRepository
from app.schemas.document import (
    DocumentResponse,
    DocumentsListResponse,
    DocumentStatusResponse,
)

logger = logging.getLogger(__name__)


class DocumentService:
    """Service for document management."""

    def __init__(
        self,
        document_repo: DocumentRepository,
        session_repo: SessionRepository,
    ):
        self.document_repo = document_repo
        self.session_repo = session_repo

    async def list_documents(self, session_id: UUID) -> DocumentsListResponse:
        """List all documents for a session."""
        # Validate session exists
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Session not found"},
            )

        documents = await self.document_repo.list_by_session(session_id)
        return DocumentsListResponse(
            documents=[
                DocumentResponse(
                    id=doc.id,
                    name=doc.name,
                    file_size=doc.file_size,
                    page_count=doc.page_count,
                    chunk_count=doc.chunk_count,
                    status=doc.status.value,
                    processing_progress=doc.processing_progress,
                    error_message=doc.error_message,
                    uploaded_at=doc.uploaded_at,
                    processed_at=doc.processed_at,
                )
                for doc in documents
            ]
        )

    async def get_document(self, document_id: UUID) -> DocumentResponse:
        """Get document details."""
        document = await self.document_repo.get_by_id(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
            )

        return DocumentResponse(
            id=document.id,
            name=document.name,
            file_size=document.file_size,
            page_count=document.page_count,
            chunk_count=document.chunk_count,
            status=document.status.value,
            processing_progress=document.processing_progress,
            error_message=document.error_message,
            uploaded_at=document.uploaded_at,
            processed_at=document.processed_at,
        )

    async def get_status(self, document_id: UUID) -> DocumentStatusResponse:
        """Get document processing status."""
        document = await self.document_repo.get_by_id(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
            )

        return DocumentStatusResponse(
            status=document.status.value,
            progress=document.processing_progress,
            error_message=document.error_message,
            chunks_processed=document.chunk_count if document.status == DocumentStatus.READY else 0,
            chunks_total=document.chunk_count,
        )

    async def upload_document(
        self,
        session_id: UUID,
        file: UploadFile,
    ) -> DocumentResponse:
        """Upload a document for a session."""
        # Validate session exists
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Session not found"},
            )

        # Validate file type
        if not file.content_type or "pdf" not in file.content_type.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INVALID_FILE_TYPE", "message": "Only PDF files are supported"},
            )

        # Read file content
        content = await file.read()
        file_size = len(content)

        # Validate file size
        if file_size > settings.max_upload_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "FILE_TOO_LARGE",
                    "message": f"File size exceeds maximum of {settings.max_upload_size_mb}MB",
                },
            )

        # Create upload directory
        upload_dir = Path(settings.upload_dir) / str(session_id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_filename = re.sub(r"[^a-zA-Z0-9._-]", "_", file.filename or "document.pdf")
        file_path = upload_dir / f"{timestamp}_{safe_filename}"

        # Save file
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

        # Create document record
        document = await self.document_repo.create(
            session_id=session_id,
            name=file.filename or "document.pdf",
            file_path=str(file_path),
            file_size=file_size,
        )

        logger.info(f"Uploaded document: {document.id} - {document.name}")

        return DocumentResponse(
            id=document.id,
            name=document.name,
            file_size=document.file_size,
            page_count=document.page_count,
            chunk_count=document.chunk_count,
            status=document.status.value,
            processing_progress=document.processing_progress,
            error_message=document.error_message,
            uploaded_at=document.uploaded_at,
            processed_at=document.processed_at,
        )

    async def delete_document(
        self,
        document_id: UUID,
        chroma_client: ChromaClient,
    ) -> None:
        """Delete a document and its embeddings.
        
        Performs cleanup in order: vector embeddings, file, database record.
        File and DB cleanup proceed even if vector deletion fails.
        """
        document = await self.document_repo.get_by_id(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
            )

        # Track cleanup errors to report but continue cleanup
        cleanup_errors = []

        # Delete embeddings from Chroma (best effort)
        try:
            await chroma_client.delete_by_document(
                collection_name="documents",
                document_id=str(document_id),
            )
        except Exception as e:
            logger.error(f"Failed to delete embeddings for document {document_id}: {e}")
            cleanup_errors.append(f"Vector deletion failed: {e}")

        # Delete file (always attempt even if vector deletion failed)
        try:
            if os.path.exists(document.file_path):
                os.remove(document.file_path)
        except Exception as e:
            logger.error(f"Failed to delete file for document {document_id}: {e}")
            cleanup_errors.append(f"File deletion failed: {e}")

        # Delete database record (always attempt)
        try:
            await self.document_repo.delete(document_id)
        except Exception as e:
            logger.error(f"Failed to delete DB record for document {document_id}: {e}")
            cleanup_errors.append(f"Database deletion failed: {e}")
            # Re-raise DB errors as they are critical
            raise

        if cleanup_errors:
            logger.warning(f"Document {document_id} deleted with errors: {cleanup_errors}")
        else:
            logger.info(f"Deleted document: {document_id}")

    async def retry_processing(self, document_id: UUID) -> DocumentResponse:
        """Retry processing a failed document."""
        document = await self.document_repo.get_by_id(document_id)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
            )

        # Reset status to pending
        document = await self.document_repo.update_status(
            document_id=document_id,
            status=DocumentStatus.PENDING,
            progress=0,
            error_message=None,
        )

        return DocumentResponse(
            id=document.id,
            name=document.name,
            file_size=document.file_size,
            page_count=document.page_count,
            chunk_count=document.chunk_count,
            status=document.status.value,
            processing_progress=document.processing_progress,
            error_message=document.error_message,
            uploaded_at=document.uploaded_at,
            processed_at=document.processed_at,
        )


class DocumentProcessingService:
    """Service for document processing (text extraction, chunking, embedding).
    
    Uses local bge-base-en-v1.5 embeddings for fast, cost-free indexing.
    """

    TARGET_CHUNK_SIZE = 500  # tokens
    CHUNK_OVERLAP = 50  # tokens

    def __init__(
        self,
        document_repo: DocumentRepository,
        chunk_repo: DocumentChunkRepository,
        chroma_client: ChromaClient,
        embedding_service: LocalEmbeddingService,
    ):
        self.document_repo = document_repo
        self.chunk_repo = chunk_repo
        self.chroma_client = chroma_client
        self.embedding_service = embedding_service

    async def process_document(self, document_id: UUID) -> None:
        """Process a document: extract text, chunk, embed, and store."""
        document = await self.document_repo.get_by_id(document_id)
        if not document:
            logger.error(f"Document not found: {document_id}")
            return

        try:
            # Update status to processing
            await self.document_repo.update_status(
                document_id=document_id,
                status=DocumentStatus.PROCESSING,
                progress=10,
            )

            # Extract text from PDF
            pages = self._extract_text(document.file_path)
            if not pages:
                raise ValueError("No text content found in PDF")

            page_count = len(pages)
            await self.document_repo.update_status(
                document_id=document_id,
                status=DocumentStatus.PROCESSING,
                progress=30,
            )

            # Chunk text
            chunks = self._chunk_text(pages)
            await self.document_repo.update_status(
                document_id=document_id,
                status=DocumentStatus.PROCESSING,
                progress=50,
            )

            # Generate embeddings using local model
            chunk_texts = [c["content"] for c in chunks]
            embeddings = self._generate_embeddings(chunk_texts)
            await self.document_repo.update_status(
                document_id=document_id,
                status=DocumentStatus.PROCESSING,
                progress=80,
            )

            # Store chunks in database
            chunk_records = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                embedding_id = f"{document_id}_{i}"
                chunk_record = await self.chunk_repo.create(
                    document_id=document_id,
                    chunk_index=i,
                    page_number=chunk["page_number"],
                    section_heading=chunk.get("section_heading"),
                    content=chunk["content"],
                    token_count=chunk["token_count"],
                    embedding_id=embedding_id,
                )
                chunk_records.append(chunk_record)

            # Store embeddings in Chroma
            await self.chroma_client.add_embeddings(
                collection_name="documents",
                ids=[f"{document_id}_{i}" for i in range(len(chunks))],
                embeddings=embeddings,
                metadatas=[
                    {
                        "document_id": str(document_id),
                        "session_id": str(document.session_id),
                        "chunk_index": i,
                        "page_number": chunks[i]["page_number"],
                        "section_heading": chunks[i].get("section_heading") or "",
                        "document_name": document.name,
                    }
                    for i in range(len(chunks))
                ],
                documents=chunk_texts,
            )

            # Update document as processed
            await self.document_repo.update_processed(
                document_id=document_id,
                page_count=page_count,
                chunk_count=len(chunks),
            )

            logger.info(
                f"Processed document {document_id}: {page_count} pages, {len(chunks)} chunks"
            )

        except Exception as e:
            logger.error(f"Failed to process document {document_id}: {e}")
            await self.document_repo.update_status(
                document_id=document_id,
                status=DocumentStatus.ERROR,
                progress=0,
                error_message=str(e),
            )

    def _extract_text(self, file_path: str) -> list[dict]:
        """Extract text from PDF with page boundaries."""
        pages = []
        try:
            reader = PdfReader(file_path)
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append({
                        "page_number": i + 1,
                        "text": text.strip(),
                    })
        except Exception as e:
            logger.error(f"Failed to extract text from PDF: {e}")
            raise

        return pages

    def _chunk_text(self, pages: list[dict]) -> list[dict]:
        """Chunk text with overlap, respecting page boundaries."""
        chunks = []
        current_chunk = ""
        current_page = 1
        current_tokens = 0

        for page in pages:
            page_text = page["text"]
            page_number = page["page_number"]

            # Split into paragraphs
            paragraphs = re.split(r"\n\s*\n", page_text)

            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue

                # Estimate tokens (rough: ~4 chars per token)
                para_tokens = len(para) // 4

                if current_tokens + para_tokens > self.TARGET_CHUNK_SIZE:
                    # Save current chunk
                    if current_chunk:
                        chunks.append({
                            "content": current_chunk.strip(),
                            "page_number": current_page,
                            "token_count": current_tokens,
                            "section_heading": self._detect_heading(current_chunk),
                        })

                    # Start new chunk with overlap
                    overlap_text = self._get_overlap_text(current_chunk)
                    current_chunk = overlap_text + " " + para if overlap_text else para
                    current_page = page_number
                    current_tokens = len(current_chunk) // 4
                else:
                    current_chunk += " " + para if current_chunk else para
                    current_tokens += para_tokens

        # Save final chunk
        if current_chunk:
            chunks.append({
                "content": current_chunk.strip(),
                "page_number": current_page,
                "token_count": current_tokens,
                "section_heading": self._detect_heading(current_chunk),
            })

        return chunks

    def _get_overlap_text(self, text: str) -> str:
        """Get the last ~50 tokens of text for overlap."""
        words = text.split()
        overlap_words = words[-(self.CHUNK_OVERLAP // 2) :]  # ~2 words per token
        return " ".join(overlap_words)

    def _detect_heading(self, text: str) -> Optional[str]:
        """Detect section heading from text."""
        lines = text.split("\n")
        for line in lines[:3]:  # Check first 3 lines
            line = line.strip()
            # Heuristic: short lines that look like headings
            if len(line) < 100 and len(line) > 3:
                if line.isupper() or line.istitle():
                    return line[:255]  # Truncate to max length
        return None

    def _generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for texts using local bge-base-en-v1.5 model.
        
        Uses sentence-transformers for fast local inference (~10ms per batch).
        """
        if not texts:
            return []
        
        # Local embedding is fast, process all at once
        # The embedding service handles batching internally
        embeddings = self.embedding_service.create_embeddings(texts)
        
        logger.info(f"Generated {len(embeddings)} embeddings with {len(embeddings[0])} dimensions")
        return embeddings
