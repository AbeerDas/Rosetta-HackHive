"""Note generation and management service."""

import io
import logging
import re
from datetime import datetime
from typing import Optional
from uuid import UUID

import markdown
from fastapi import HTTPException, status

from app.external.openrouter import OpenRouterClient
from app.repositories.citation import CitationRepository
from app.repositories.note import NoteRepository
from app.repositories.session import SessionRepository
from app.repositories.transcript import TranscriptRepository
from app.schemas.note import NoteResponse, NoteStatusResponse

logger = logging.getLogger(__name__)

# Note generation system prompt
SYSTEM_PROMPT = """You are an expert academic note-taking assistant. Transform lecture transcripts into clear, well-organized study notes.

OUTPUT FORMAT: Markdown

STRUCTURE:
1. Title with session name
2. Metadata line (date, duration, languages)
3. "Key Concepts" section (3-5 bullet points)
4. "Detailed Notes" section with topic headings (##)
5. "Summary" paragraph
6. "Citations" section listing all references

GUIDELINES:
- Reorganize content by TOPIC, not chronologically
- Create clear, descriptive section headings
- Use bullet points for lists and key points
- Preserve citation numbers EXACTLY as provided (¹, ², ³)
- Write in clear, academic language
- Be concise but comprehensive
- Include all important details from the transcript
- Group related concepts together

CITATION FORMAT:
- In text: Use superscript numbers (¹, ², ³)
- In citations section: "1. [Document], Page [X] - \\"[brief excerpt]\\""
"""


class NoteGenerationService:
    """Service for LLM-powered note generation."""

    def __init__(self, openrouter_client: OpenRouterClient):
        self.openrouter_client = openrouter_client

    async def generate(
        self,
        transcript: str,
        citations: list[dict],
        session_name: str,
        date: datetime,
        duration_minutes: int,
        source_language: str,
        target_language: str,
    ) -> str:
        """Generate structured notes from transcript and citations.

        Args:
            transcript: Full transcript text
            citations: List of citation dicts
            session_name: Name of the session
            date: Session date
            duration_minutes: Session duration
            source_language: Source language code
            target_language: Target language code

        Returns:
            Generated notes in Markdown format
        """
        # Format citations for prompt
        formatted_citations = self._format_citations(citations)

        # Build user prompt
        prompt = f"""Please create structured lecture notes from the following:

Session: {session_name}
Date: {date.strftime("%B %d, %Y")}
Duration: {duration_minutes} minutes
Languages: {source_language} → {target_language}

TRANSCRIPT:
{transcript}

CITATIONS:
{formatted_citations}

Generate well-organized notes following the template structure."""

        try:
            notes = await self.openrouter_client.generate_text(
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=4000,
            )
            return notes

        except Exception as e:
            logger.error(f"Note generation failed: {e}")
            raise

    def _format_citations(self, citations: list[dict]) -> str:
        """Format citations list for the prompt."""
        if not citations:
            return "No citations available."

        lines = []
        for i, citation in enumerate(citations, start=1):
            doc_name = citation.get("document_name", "Unknown")
            page = citation.get("page_number", "?")
            snippet = citation.get("snippet", "")[:100]
            lines.append(f"{i}. {doc_name}, Page {page} - \"{snippet}...\"")

        return "\n".join(lines)


class NoteService:
    """Service for note management."""

    # Track generation status in memory (for simplicity)
    _generation_status: dict = {}

    def __init__(
        self,
        note_repo: NoteRepository,
        transcript_repo: TranscriptRepository,
        citation_repo: CitationRepository,
        session_repo: SessionRepository,
        generation_service: NoteGenerationService,
    ):
        self.note_repo = note_repo
        self.transcript_repo = transcript_repo
        self.citation_repo = citation_repo
        self.session_repo = session_repo
        self.generation_service = generation_service

    async def get_notes(self, session_id: UUID) -> Optional[NoteResponse]:
        """Get notes for a session."""
        note = await self.note_repo.get_by_session(session_id)
        if not note:
            return None

        # Count citations
        citations = await self.citation_repo.list_by_session(session_id)

        return NoteResponse(
            id=note.id,
            session_id=note.session_id,
            content_markdown=note.content_markdown,
            generated_at=note.generated_at,
            last_edited_at=note.last_edited_at,
            version=note.version,
            word_count=note.word_count,
            citation_count=len(citations),
        )

    async def generate_notes(
        self,
        session_id: UUID,
        force_regenerate: bool = False,
    ) -> NoteResponse:
        """Generate notes for a session.

        Args:
            session_id: Session ID
            force_regenerate: Force regeneration even if notes exist

        Returns:
            Generated notes
        """
        # Check if notes already exist
        existing = await self.note_repo.get_by_session(session_id)
        if existing and not force_regenerate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "NOTES_EXIST",
                    "message": "Notes already exist. Use force_regenerate to replace.",
                },
            )

        # Get session details
        session = await self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "SESSION_NOT_FOUND", "message": "Session not found"},
            )

        # Update status
        self._generation_status[str(session_id)] = {"status": "generating", "progress": 0}

        try:
            # Get transcript
            transcript_text = await self.transcript_repo.get_full_text(session_id)
            if not transcript_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "NO_TRANSCRIPT",
                        "message": "No transcript available for note generation",
                    },
                )

            self._generation_status[str(session_id)]["progress"] = 30

            # Get citations
            citations = await self.citation_repo.list_by_session(session_id)
            citation_dicts = [
                {
                    "document_name": c.document.name if c.document else "Unknown",
                    "page_number": c.page_number,
                    "snippet": c.snippet,
                }
                for c in citations
            ]

            self._generation_status[str(session_id)]["progress"] = 50

            # Calculate duration
            duration_minutes = 0
            if session.ended_at and session.started_at:
                duration_minutes = int(
                    (session.ended_at - session.started_at).total_seconds() / 60
                )

            # Generate notes
            notes_content = await self.generation_service.generate(
                transcript=transcript_text,
                citations=citation_dicts,
                session_name=session.name,
                date=session.started_at,
                duration_minutes=duration_minutes,
                source_language=session.source_language,
                target_language=session.target_language,
            )

            self._generation_status[str(session_id)]["progress"] = 90

            # Save notes
            if existing:
                note = await self.note_repo.update_by_session(session_id, notes_content)
            else:
                note = await self.note_repo.create(session_id, notes_content)

            self._generation_status[str(session_id)] = {"status": "ready", "progress": 100}

            return NoteResponse(
                id=note.id,
                session_id=note.session_id,
                content_markdown=note.content_markdown,
                generated_at=note.generated_at,
                last_edited_at=note.last_edited_at,
                version=note.version,
                word_count=note.word_count,
                citation_count=len(citations),
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Note generation failed: {e}")
            self._generation_status[str(session_id)] = {
                "status": "error",
                "progress": 0,
                "error_message": str(e),
            }
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "GENERATION_ERROR", "message": f"Note generation failed: {e}"},
            )

    async def update_notes(self, session_id: UUID, content: str) -> NoteResponse:
        """Update notes content.

        Args:
            session_id: Session ID
            content: New Markdown content

        Returns:
            Updated notes
        """
        note = await self.note_repo.update_by_session(session_id, content)
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOTES_NOT_FOUND", "message": "Notes not found for session"},
            )

        citations = await self.citation_repo.list_by_session(session_id)

        return NoteResponse(
            id=note.id,
            session_id=note.session_id,
            content_markdown=note.content_markdown,
            generated_at=note.generated_at,
            last_edited_at=note.last_edited_at,
            version=note.version,
            word_count=note.word_count,
            citation_count=len(citations),
        )

    async def get_status(self, session_id: UUID) -> NoteStatusResponse:
        """Get note generation status."""
        status_data = self._generation_status.get(str(session_id))

        if status_data:
            return NoteStatusResponse(
                status=status_data.get("status", "not_generated"),
                progress=status_data.get("progress", 0),
                error_message=status_data.get("error_message"),
            )

        # Check if notes exist
        note = await self.note_repo.get_by_session(session_id)
        if note:
            return NoteStatusResponse(status="ready", progress=100, error_message=None)

        return NoteStatusResponse(status="not_generated", progress=0, error_message=None)

    async def export_to_pdf(self, session_id: UUID) -> bytes:
        """Export notes to PDF.

        Args:
            session_id: Session ID

        Returns:
            PDF bytes
        """
        note = await self.note_repo.get_by_session(session_id)
        if not note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOTES_NOT_FOUND", "message": "Notes not found for session"},
            )

        session = await self.session_repo.get_by_id(session_id)

        # Convert Markdown to HTML
        html_content = markdown.markdown(
            note.content_markdown,
            extensions=["extra", "codehilite", "toc"],
        )

        # Add styling
        styled_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{session.name if session else 'Lecture Notes'}</title>
    <style>
        body {{
            font-family: 'Georgia', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            color: #333;
        }}
        h1 {{
            font-size: 24px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }}
        h2 {{
            font-size: 20px;
            margin-top: 30px;
            color: #444;
        }}
        h3 {{
            font-size: 16px;
            margin-top: 20px;
        }}
        ul, ol {{
            margin-left: 20px;
        }}
        li {{
            margin-bottom: 5px;
        }}
        sup {{
            color: #0066cc;
            font-weight: bold;
        }}
        blockquote {{
            border-left: 3px solid #ccc;
            padding-left: 20px;
            margin-left: 0;
            color: #666;
        }}
        .footer {{
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
            font-size: 12px;
            color: #666;
        }}
    </style>
</head>
<body>
    {html_content}
    <div class="footer">
        Generated by LectureLens | {datetime.now().strftime("%B %d, %Y")}
    </div>
</body>
</html>
"""

        try:
            # Use weasyprint for PDF generation
            from weasyprint import HTML
            pdf_bytes = HTML(string=styled_html).write_pdf()
            return pdf_bytes
        except ImportError:
            logger.warning("weasyprint not available")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "PDF_UNAVAILABLE",
                    "message": "PDF export not available. WeasyPrint library not installed. Use Markdown export instead.",
                },
            )
        except OSError as e:
            # WeasyPrint requires system libraries (Cairo, Pango, GDK-PixBuf)
            # On macOS: brew install cairo pango gdk-pixbuf libffi
            # On Ubuntu: apt-get install python3-cffi libpango-1.0-0 libpangoft2-1.0-0
            logger.warning(f"WeasyPrint missing system dependencies: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "PDF_DEPS_MISSING",
                    "message": "PDF export requires system libraries. Run: brew install cairo pango gdk-pixbuf libffi (macOS) or see QUICKSTART.md",
                },
            )
        except Exception as e:
            logger.error(f"PDF generation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "PDF_ERROR", "message": f"PDF generation failed: {e}"},
            )
