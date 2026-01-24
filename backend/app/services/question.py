"""Question translation service."""

import logging

from fastapi import HTTPException, status

from app.core.config import settings
from app.external.openrouter import OpenRouterClient
from app.schemas.translation import QuestionTranslateResponse

logger = logging.getLogger(__name__)


class QuestionTranslationService:
    """Service for translating student questions to English."""

    def __init__(self, openrouter_client: OpenRouterClient):
        self.openrouter_client = openrouter_client

    async def translate(
        self,
        text: str,
        source_language: str | None = None,
    ) -> QuestionTranslateResponse:
        """Translate a question to English.

        Args:
            text: Question text in source language
            source_language: Optional source language hint

        Returns:
            Translation result with detected language
        """
        if not text or not text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "TEXT_EMPTY", "message": "Input text is empty"},
            )

        if len(text) > 1000:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "TEXT_TOO_LONG", "message": "Input exceeds 1000 characters"},
            )

        try:
            result = await self.openrouter_client.translate_question(
                text=text,
                source_language=source_language,
            )

            # Validate detected language
            detected_lang = result.get("detected_language", "")
            if detected_lang not in settings.supported_languages:
                # Allow translation but note unsupported
                logger.warning(f"Detected unsupported language: {detected_lang}")

            return QuestionTranslateResponse(
                original_text=text,
                translated_text=result.get("translated_text", text),
                detected_language=detected_lang,
                detected_language_name=result.get("detected_language_name", "Unknown"),
                confidence=result.get("confidence", 0.0),
            )

        except ValueError as e:
            logger.error(f"Translation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "TRANSLATION_ERROR", "message": str(e)},
            )
        except Exception as e:
            logger.error(f"Translation service error: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "SERVICE_UNAVAILABLE", "message": "Translation service unavailable"},
            )

    def detect_language(self, text: str) -> str:
        """Detect the language of text (synchronous, basic heuristic).

        This is a simple fallback. Primary detection uses LLM.
        """
        # Basic heuristic based on character ranges
        for char in text:
            code = ord(char)
            # Chinese
            if 0x4E00 <= code <= 0x9FFF:
                return "zh"
            # Hindi/Devanagari
            if 0x0900 <= code <= 0x097F:
                return "hi"
            # Bengali
            if 0x0980 <= code <= 0x09FF:
                return "bn"

        # Default to English for Latin scripts
        return "en"
