"""Note generation and management service.

Uses Convex + Pinecone for all data storage (fully cloud-native).
"""

import logging
from datetime import datetime
from typing import Optional

import markdown
from fastapi import HTTPException, status

from app.external.convex import ConvexClient
from app.external.openrouter import OpenRouterClient
from app.schemas.note import NoteResponse, NoteStatusResponse

logger = logging.getLogger(__name__)

# Note generation system prompt template (language will be inserted)
SYSTEM_PROMPT_TEMPLATE = """You are an expert academic note-taking assistant. Transform lecture transcripts into clear, well-organized study notes.

OUTPUT LANGUAGE: {output_language}
OUTPUT FORMAT: Markdown

STRUCTURE:
1. Title with session name
2. Metadata line (date, duration, languages)
3. "Key Concepts" section (3-5 bullet points)
4. "Detailed Notes" section with topic headings (##)
5. "Summary" paragraph
6. "Citations" section listing all references

GUIDELINES:
- Write ALL notes in {output_language} (translate content if transcript is in a different language)
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

# Language code to name mapping
LANGUAGE_NAMES = {
    "en": "English",
    "zh": "Chinese (Mandarin)",
    "hi": "Hindi",
    "es": "Spanish",
    "fr": "French",
    "bn": "Bengali",
}


class NoteGenerationService:
    """Service for LLM-powered note generation."""

    def __init__(self, openrouter_client: OpenRouterClient):
        self.openrouter_client = openrouter_client

    async def generate(
        self,
        transcript: str,
        citations: list[dict],
        session_name: str,
        date: Optional[datetime],
        duration_minutes: int,
        source_language: str,
        target_language: str,
        output_language: Optional[str] = None,
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
            output_language: Language code for generated notes (defaults to English)

        Returns:
            Generated notes in Markdown format
        """
        # Format citations for prompt
        formatted_citations = self._format_citations(citations)

        # Get output language name (default to English)
        output_lang_code = output_language or "en"
        output_lang_name = LANGUAGE_NAMES.get(output_lang_code, "English")

        # Build system prompt with language
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(output_language=output_lang_name)

        # Build user prompt
        # Handle optional date
        date_str = date.strftime("%B %d, %Y") if date else "N/A"
        
        prompt = f"""Please create structured lecture notes from the following:

Session: {session_name}
Date: {date_str}
Duration: {duration_minutes} minutes
Languages: {source_language} → {target_language}
Output Language: {output_lang_name}

TRANSCRIPT:
{transcript}

CITATIONS:
{formatted_citations}

Generate well-organized notes following the template structure. Write all notes in {output_lang_name}."""

        try:
            notes = await self.openrouter_client.generate_text(
                prompt=prompt,
                system_prompt=system_prompt,
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
            doc_name = citation.get("documentName", citation.get("document_name", "Unknown"))
            page = citation.get("pageNumber", citation.get("page_number", "?"))
            snippet = citation.get("chunkText", citation.get("snippet", ""))[:100]
            lines.append(f"{i}. {doc_name}, Page {page} - \"{snippet}...\"")

        return "\n".join(lines)


class NoteService:
    """Service for note management.
    
    Uses Convex for all data storage (no PostgreSQL).
    """

    # Track generation status in memory (for simplicity)
    _generation_status: dict = {}

    def __init__(
        self,
        convex_client: ConvexClient,
        generation_service: NoteGenerationService,
    ):
        self.convex_client = convex_client
        self.generation_service = generation_service

    async def get_notes(self, session_id: str) -> Optional[NoteResponse]:
        """Get notes for a session from Convex."""
        notes = await self.convex_client.get_notes(session_id)
        if not notes:
            return None

        # Get citation count
        citations = await self.convex_client.get_citations(session_id)

        return NoteResponse(
            id=notes.get("_id", ""),
            session_id=session_id,
            content_markdown=notes.get("contentMarkdown", ""),
            generated_at=datetime.fromtimestamp(notes.get("generatedAt", 0) / 1000),
            last_edited_at=datetime.fromtimestamp(notes.get("lastEditedAt", 0) / 1000),
            version=notes.get("version", 1),
            word_count=len(notes.get("contentMarkdown", "").split()),
            citation_count=len(citations),
        )

    async def generate_notes(
        self,
        session_id: str,
        force_regenerate: bool = False,
        output_language: Optional[str] = None,
    ) -> NoteResponse:
        """Generate notes for a session.

        Args:
            session_id: Convex session ID
            force_regenerate: Force regeneration even if notes exist
            output_language: Language code for generated notes (defaults to English)

        Returns:
            Generated notes
        """
        # Check if notes already exist
        existing = await self.convex_client.get_notes(session_id)
        if existing and not force_regenerate:
            logger.info(f"Notes already exist for session {session_id}, will update them")

        # Update status
        self._generation_status[session_id] = {"status": "generating", "progress": 0}

        try:
            # Get transcript from Convex
            transcript_data = await self.convex_client.get_full_transcript(session_id)
            transcript_text = transcript_data.get("originalText", "")
            
            if not transcript_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "NO_TRANSCRIPT",
                        "message": "No transcript available for note generation",
                    },
                )

            self._generation_status[session_id]["progress"] = 20

            # Get citations from Convex
            citations = await self.convex_client.get_citations(session_id)
            
            self._generation_status[session_id]["progress"] = 30
            
            # Get target language from output_language or default to English
            target_language = output_language or "en"
            
            # Generate English notes
            logger.info(f"[NoteGen] Generating English notes for session {session_id}")
            notes_content_english = await self.generation_service.generate(
                transcript=transcript_text,
                citations=citations,
                session_name=f"Session {session_id[:8]}",
                date=None,
                duration_minutes=0,
                source_language="en",
                target_language="en",
                output_language="en",
            )

            self._generation_status[session_id]["progress"] = 60
            
            # Generate target language notes if different from English
            notes_content_translated = None
            if target_language and target_language != "en":
                logger.info(f"[NoteGen] Generating {target_language} notes for session {session_id}")
                notes_content_translated = await self.generation_service.generate(
                    transcript=transcript_text,
                    citations=citations,
                    session_name=f"Session {session_id[:8]}",
                    date=None,
                    duration_minutes=0,
                    source_language="en",
                    target_language=target_language,
                    output_language=target_language,
                )

            self._generation_status[session_id]["progress"] = 90

            # Save both versions to Convex
            note_id = await self.convex_client.upsert_notes(
                session_id=session_id,
                content_markdown=notes_content_english,
                content_markdown_translated=notes_content_translated,
                target_language=target_language if target_language != "en" else None,
            )

            self._generation_status[session_id] = {"status": "ready", "progress": 100}

            return NoteResponse(
                id=note_id,
                session_id=session_id,
                content_markdown=notes_content_english,
                generated_at=datetime.now(),
                last_edited_at=datetime.now(),
                version=1,
                word_count=len(notes_content_english.split()),
                citation_count=len(citations),
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Note generation failed: {e}")
            self._generation_status[session_id] = {
                "status": "error",
                "progress": 0,
                "error_message": str(e),
            }
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "GENERATION_ERROR", "message": f"Note generation failed: {e}"},
            )

    async def update_notes(self, session_id: str, content: str) -> NoteResponse:
        """Update notes content.

        Args:
            session_id: Convex session ID
            content: New Markdown content

        Returns:
            Updated notes
        """
        # Update notes in Convex
        note_id = await self.convex_client.upsert_notes(
            session_id=session_id,
            content_markdown=content,
        )

        citations = await self.convex_client.get_citations(session_id)

        return NoteResponse(
            id=note_id,
            session_id=session_id,
            content_markdown=content,
            generated_at=datetime.now(),
            last_edited_at=datetime.now(),
            version=1,  # Version tracking is handled by Convex
            word_count=len(content.split()),
            citation_count=len(citations),
        )

    async def get_status(self, session_id: str) -> NoteStatusResponse:
        """Get note generation status."""
        status_data = self._generation_status.get(session_id)

        if status_data:
            return NoteStatusResponse(
                status=status_data.get("status", "not_generated"),
                progress=status_data.get("progress", 0),
                error_message=status_data.get("error_message"),
            )

        # Check if notes exist in Convex
        notes = await self.convex_client.get_notes(session_id)
        if notes:
            return NoteStatusResponse(status="ready", progress=100, error_message=None)

        return NoteStatusResponse(status="not_generated", progress=0, error_message=None)

    async def export_to_pdf(self, session_id: str) -> bytes:
        """Export notes to PDF.

        Args:
            session_id: Convex session ID

        Returns:
            PDF bytes
        """
        notes = await self.convex_client.get_notes(session_id)
        if not notes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOTES_NOT_FOUND", "message": "Notes not found for session"},
            )

        content_markdown = notes.get("contentMarkdown", "")

        # Convert Markdown to HTML
        html_content = markdown.markdown(
            content_markdown,
            extensions=["extra", "codehilite", "toc"],
        )

        # Add styling
        styled_html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Lecture Notes</title>
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
        Generated by Rosetta | {datetime.now().strftime("%B %d, %Y")}
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
