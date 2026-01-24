"""Text-to-speech service using ElevenLabs."""

import logging

from fastapi import HTTPException, status

from app.external.elevenlabs import ElevenLabsClient

logger = logging.getLogger(__name__)


class TTSService:
    """Service for text-to-speech conversion."""

    def __init__(self, elevenlabs_client: ElevenLabsClient):
        self.elevenlabs_client = elevenlabs_client

    async def speak(self, text: str) -> bytes:
        """Convert text to speech and return audio bytes.

        Args:
            text: Text to convert to speech

        Returns:
            Audio bytes in MP3 format
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
            audio_bytes = await self.elevenlabs_client.text_to_speech(text)
            logger.info(f"Generated TTS audio for {len(text)} characters")
            return audio_bytes

        except Exception as e:
            logger.error(f"TTS failed: {e}")

            # Check for specific error types
            error_str = str(e).lower()
            if "rate limit" in error_str or "429" in error_str:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={"code": "TTS_RATE_LIMIT", "message": "TTS rate limit exceeded"},
                )

            if "unauthorized" in error_str or "401" in error_str:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={"code": "TTS_UNAVAILABLE", "message": "TTS service configuration error"},
                )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={"code": "TTS_ERROR", "message": "TTS request failed"},
            )
