"""Translation service for speech-to-speech translation."""

import logging
from typing import AsyncGenerator

from app.external.elevenlabs import ElevenLabsClient, ElevenLabsS2SStream

logger = logging.getLogger(__name__)


class TranslationService:
    """Service for real-time speech-to-speech translation."""

    def __init__(self, elevenlabs_client: ElevenLabsClient):
        self.elevenlabs_client = elevenlabs_client

    async def create_stream(
        self,
        target_language: str,
    ) -> ElevenLabsS2SStream:
        """Create a new translation stream.

        Args:
            target_language: Target language code

        Returns:
            ElevenLabs S2S stream handler
        """
        websocket = await self.elevenlabs_client.create_s2s_websocket(
            target_language=target_language,
        )
        return ElevenLabsS2SStream(
            websocket=websocket,
            target_language=target_language,
        )

    async def translate_chunk(
        self,
        stream: ElevenLabsS2SStream,
        audio_chunk: bytes,
    ) -> AsyncGenerator[bytes, None]:
        """Send audio chunk and receive translated audio.

        Args:
            stream: Active translation stream
            audio_chunk: PCM audio chunk to translate

        Yields:
            Translated audio chunks
        """
        await stream.send_audio(audio_chunk)
        async for translated_chunk in stream.receive_audio():
            yield translated_chunk

    async def close_stream(self, stream: ElevenLabsS2SStream) -> None:
        """Close a translation stream.

        Args:
            stream: Stream to close
        """
        await stream.close()
        logger.info("Closed translation stream")
