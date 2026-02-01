"""Document processing service for Convex documents.

Handles PDF processing for documents stored in Convex:
1. Downloads PDF from Convex Storage URL
2. Extracts text and chunks it
3. Generates embeddings using local bge-base-en-v1.5 model
4. Stores embeddings in Pinecone

No local database - all metadata in Convex, vectors in Pinecone.
"""

import logging
import re
from typing import Optional

from PyPDF2 import PdfReader

from app.external.pinecone import PineconeClient
from app.external.embeddings import LocalEmbeddingService

logger = logging.getLogger(__name__)


class ConvexDocumentProcessingService:
    """Service for processing documents stored in Convex.
    
    This service handles documents uploaded to Convex Storage:
    1. Downloads PDF from Convex URL
    2. Extracts text and chunks it
    3. Generates embeddings with bge-base-en-v1.5
    4. Stores in Pinecone with Convex IDs
    """

    TARGET_CHUNK_SIZE = 500  # tokens
    CHUNK_OVERLAP = 50  # tokens

    def __init__(
        self,
        pinecone_client: PineconeClient,
        embedding_service: LocalEmbeddingService,
    ):
        self.pinecone_client = pinecone_client
        self.embedding_service = embedding_service

    async def process_convex_document(
        self,
        document_id: str,
        session_id: str,
        file_url: str,
        file_name: str,
    ) -> dict:
        """Process a document from Convex Storage.
        
        Args:
            document_id: Convex document ID (string, not UUID)
            session_id: Convex session ID (string, not UUID)
            file_url: URL to download the PDF from Convex Storage
            file_name: Original filename
            
        Returns:
            Dict with page_count, chunk_count, and status
        """
        import tempfile
        import httpx
        import os
        
        logger.info(f"[ConvexDoc] Starting processing: doc={document_id}, session={session_id}")
        logger.info(f"[ConvexDoc] File URL: {file_url}")
        
        try:
            # Step 1: Download PDF from Convex Storage URL
            async with httpx.AsyncClient() as client:
                response = await client.get(file_url, follow_redirects=True)
                response.raise_for_status()
                pdf_content = response.content
            
            logger.info(f"[ConvexDoc] Downloaded {len(pdf_content)} bytes")
            
            # Step 2: Save to temp file for PyPDF2
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(pdf_content)
                tmp_path = tmp.name
            
            try:
                # Step 3: Extract text from PDF
                pages = self._extract_text(tmp_path)
                if not pages:
                    logger.warning(f"[ConvexDoc] No text content found in PDF")
                    return {"status": "error", "error": "No text content found"}
                
                page_count = len(pages)
                logger.info(f"[ConvexDoc] Extracted {page_count} pages")
                
                # Step 4: Chunk text
                chunks = self._chunk_text(pages)
                logger.info(f"[ConvexDoc] Created {len(chunks)} chunks")
                
                # Step 5: Generate embeddings
                chunk_texts = [c["content"] for c in chunks]
                embeddings = self._generate_embeddings(chunk_texts)
                logger.info(f"[ConvexDoc] Generated {len(embeddings)} embeddings")
                
                # Step 6: Store in Pinecone with Convex IDs
                await self.pinecone_client.add_embeddings(
                    collection_name="documents",
                    ids=[f"{document_id}_{i}" for i in range(len(chunks))],
                    embeddings=embeddings,
                    metadatas=[
                        {
                            "document_id": document_id,  # Convex ID
                            "session_id": session_id,    # Convex ID
                            "chunk_index": i,
                            "page_number": chunks[i]["page_number"],
                            "section_heading": chunks[i].get("section_heading") or "",
                            "document_name": file_name,
                        }
                        for i in range(len(chunks))
                    ],
                    documents=chunk_texts,
                )
                
                logger.info(
                    f"[ConvexDoc] Successfully processed {document_id}: "
                    f"{page_count} pages, {len(chunks)} chunks indexed in Pinecone"
                )
                
                return {
                    "status": "ready",
                    "page_count": page_count,
                    "chunk_count": len(chunks),
                }
                
            finally:
                # Clean up temp file
                os.unlink(tmp_path)
                
        except Exception as e:
            logger.error(f"[ConvexDoc] Failed to process document {document_id}: {e}")
            return {
                "status": "error",
                "error": str(e),
            }

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
            logger.error(f"[ConvexDoc] Failed to extract text from PDF: {e}")
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
        overlap_words = words[-(self.CHUNK_OVERLAP // 2):]
        return " ".join(overlap_words)

    def _detect_heading(self, text: str) -> Optional[str]:
        """Detect section heading from text."""
        lines = text.split("\n")
        for line in lines[:3]:
            line = line.strip()
            if len(line) < 100 and len(line) > 3:
                if line.isupper() or line.istitle():
                    return line[:255]
        return None

    def _generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using local bge-base-en-v1.5 model."""
        if not texts:
            return []
        
        embeddings = self.embedding_service.create_embeddings(texts)
        logger.info(f"[ConvexDoc] Generated {len(embeddings)} embeddings with {len(embeddings[0])} dimensions")
        return embeddings
