"""ElevenLabs API client for speech-to-speech translation and TTS."""

import asyncio
import logging
from typing import AsyncGenerator, Optional

import httpx
import websockets
from websockets.client import WebSocketClientProtocol

from app.core.config import settings

logger = logging.getLogger(__name__)


class ElevenLabsClient:
    """Client for ElevenLabs Speech-to-Speech and TTS APIs."""

    BASE_URL = "https://api.elevenlabs.io/v1"
    S2S_WS_URL = "wss://api.elevenlabs.io/v1/speech-to-speech"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._http_client: Optional[httpx.AsyncClient] = None

    @property
    def http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers={"xi-api-key": self.api_key},
                timeout=30.0,
            )
        return self._http_client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    async def validate_api_key(self) -> bool:
        """Validate the API key by checking user info."""
        try:
            response = await self.http_client.get("/user")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to validate ElevenLabs API key: {e}")
            return False

    async def get_voices(self) -> list[dict]:
        """Get available voices."""
        try:
            response = await self.http_client.get("/voices")
            response.raise_for_status()
            data = response.json()
            return data.get("voices", [])
        except Exception as e:
            logger.error(f"Failed to get voices: {e}")
            return []

    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: Optional[str] = None,
    ) -> bytes:
        """Convert text to speech and return audio bytes.

        Args:
            text: The text to convert to speech
            voice_id: ElevenLabs voice ID (default from settings)
            model_id: ElevenLabs model ID (default from settings)

        Returns:
            Audio bytes in MP3 format
        """
        voice_id = voice_id or settings.elevenlabs_voice_id
        model_id = model_id or settings.elevenlabs_model_id

        try:
            response = await self.http_client.post(
                f"/text-to-speech/{voice_id}",
                json={
                    "text": text,
                    "model_id": model_id,
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
                headers={
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            return response.content
        except httpx.HTTPStatusError as e:
            logger.error(f"TTS request failed with status {e.response.status_code}: {e}")
            raise
        except Exception as e:
            logger.error(f"TTS request failed: {e}")
            raise

    async def create_s2s_websocket(
        self,
        target_language: str,
        voice_id: Optional[str] = None,
    ) -> WebSocketClientProtocol:
        """Create a WebSocket connection for Speech-to-Speech streaming.

        Args:
            target_language: Target language code
            voice_id: Optional voice ID override

        Returns:
            WebSocket connection
        """
        voice_id = voice_id or self._get_voice_for_language(target_language)

        ws_url = f"{self.S2S_WS_URL}/{voice_id}/stream"
        headers = {"xi-api-key": self.api_key}

        websocket = await websockets.connect(
            ws_url,
            extra_headers=headers,
        )
        return websocket

    def _get_voice_for_language(self, language_code: str) -> str:
        """Get the appropriate voice ID for a language.

        These are example voice IDs - in production, configure via settings.
        """
        # Language to voice mapping (example IDs)
        language_voices = {
            "zh": settings.elevenlabs_voice_id,  # Chinese
            "hi": settings.elevenlabs_voice_id,  # Hindi
            "es": settings.elevenlabs_voice_id,  # Spanish
            "fr": settings.elevenlabs_voice_id,  # French
            "bn": settings.elevenlabs_voice_id,  # Bengali
        }
        return language_voices.get(language_code, settings.elevenlabs_voice_id)


class ElevenLabsS2SStream:
    """Streaming handler for Speech-to-Speech translation."""

    def __init__(
        self,
        websocket: WebSocketClientProtocol,
        target_language: str,
    ):
        self.websocket = websocket
        self.target_language = target_language
        self._closed = False

    async def send_audio(self, audio_chunk: bytes) -> None:
        """Send audio chunk to ElevenLabs."""
        if not self._closed:
            await self.websocket.send(audio_chunk)

    async def receive_audio(self) -> AsyncGenerator[bytes, None]:
        """Receive translated audio chunks from ElevenLabs."""
        try:
            async for message in self.websocket:
                if isinstance(message, bytes):
                    yield message
        except websockets.exceptions.ConnectionClosed:
            logger.info("ElevenLabs WebSocket connection closed")
        finally:
            self._closed = True

    async def close(self) -> None:
        """Close the WebSocket connection."""
        if not self._closed:
            self._closed = True
            await self.websocket.close()


# Singleton instance
_elevenlabs_client: Optional[ElevenLabsClient] = None


def get_elevenlabs_client() -> ElevenLabsClient:
    """Get or create the ElevenLabs client singleton."""
    global _elevenlabs_client
    if _elevenlabs_client is None:
        _elevenlabs_client = ElevenLabsClient(settings.elevenlabs_api_key)
    return _elevenlabs_client
