"""Translation API routes and WebSocket handler."""

import asyncio
import json
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from fastapi.responses import Response

from app.api.deps import (
    QuestionTranslationServiceDep,
    TranslationServiceDep,
    TTSServiceDep,
)
from app.core.config import settings
from app.external.elevenlabs import get_elevenlabs_client
from app.external.openrouter import get_openrouter_client
from app.schemas.translation import (
    LanguageInfo,
    LanguagesResponse,
    QuestionTranslateRequest,
    QuestionTranslateResponse,
    TTSSpeakRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/languages", response_model=LanguagesResponse)
async def get_languages() -> LanguagesResponse:
    """Get supported languages for translation."""
    languages = [
        LanguageInfo(
            code="zh",
            name="Chinese (Mandarin)",
            native_name="中文",
            available=True,
        ),
        LanguageInfo(
            code="hi",
            name="Hindi",
            native_name="हिन्दी",
            available=True,
        ),
        LanguageInfo(
            code="es",
            name="Spanish",
            native_name="Español",
            available=True,
        ),
        LanguageInfo(
            code="fr",
            name="French",
            native_name="Français",
            available=True,
        ),
        LanguageInfo(
            code="bn",
            name="Bengali",
            native_name="বাংলা",
            available=True,
        ),
    ]
    return LanguagesResponse(languages=languages)


@router.post("/question", response_model=QuestionTranslateResponse)
async def translate_question(
    data: QuestionTranslateRequest,
    service: QuestionTranslationServiceDep,
) -> QuestionTranslateResponse:
    """Translate a question to English."""
    return await service.translate(
        text=data.text,
        source_language=data.source_language,
    )


@router.post("/tts/speak")
async def text_to_speech(
    data: TTSSpeakRequest,
    service: TTSServiceDep,
) -> Response:
    """Convert text to speech and return audio."""
    audio_bytes = await service.speak(data.text)
    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
        },
    )


@router.websocket("/stream")
async def translation_websocket(
    websocket: WebSocket,
    session_id: UUID,
    target_language: str,
):
    """WebSocket endpoint for real-time text-to-speech translation.

    This implements a text-based translation pipeline:
    1. Receive transcribed English text from frontend
    2. Translate to target language using LLM
    3. Convert translated text to speech using ElevenLabs TTS
    4. Send audio back to frontend

    Query params:
        session_id: Session ID
        target_language: Target language code (e.g., "zh", "hi")

    Protocol:
        Client → Server: JSON messages with transcribed text segments
        Server → Client: Binary frames (translated audio MP3)
        Client → Server: JSON control messages (mute, unmute, change_language)
        Server → Client: JSON status messages
    """
    # Validate language
    if target_language not in settings.supported_languages:
        await websocket.close(code=4001, reason="Invalid language")
        return

    await websocket.accept()

    # Get clients for translation pipeline
    elevenlabs_client = get_elevenlabs_client()
    openrouter_client = get_openrouter_client()
    
    # Track state
    is_muted = False
    current_language = target_language
    processing_lock = asyncio.Lock()

    async def translate_and_speak(text: str, lang: str) -> tuple[str | None, bytes | None]:
        """Translate text and convert to speech.
        
        Returns:
            Tuple of (translated_text, audio_bytes)
        """
        try:
            # Step 1: Translate English text to target language
            translated_text = await openrouter_client.translate_to_language(text, lang)
            logger.info(f"Translated '{text[:50]}...' to {lang}: '{translated_text[:50]}...'")
            
            # Step 2: Convert translated text to speech using ElevenLabs TTS
            audio_bytes = await elevenlabs_client.text_to_speech(translated_text)
            return translated_text, audio_bytes
        except Exception as e:
            logger.error(f"Translation pipeline failed: {e}")
            return None, None

    # Send connected message
    await websocket.send_json({
        "type": "connected",
        "session_id": str(session_id),
        "language": target_language,
    })

    try:
        while True:
            message = await websocket.receive()

            if "bytes" in message:
                # Legacy: ignore raw audio chunks (we now use text-based translation)
                pass

            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "translate":
                        # Receive text segment for translation
                        text = data.get("text", "").strip()
                        segment_id = data.get("segment_id")  # Optional segment ID for UI updates
                        if text and not is_muted:
                            # Process translation
                            async with processing_lock:
                                translated_text, audio_bytes = await translate_and_speak(text, current_language)
                                if translated_text:
                                    # Send translated text first for immediate UI update
                                    await websocket.send_json({
                                        "type": "translated_text",
                                        "original_text": text,
                                        "translated_text": translated_text,
                                        "segment_id": segment_id,
                                    })
                                if audio_bytes:
                                    # Then send audio
                                    await websocket.send_bytes(audio_bytes)

                    elif msg_type == "mute":
                        is_muted = True
                        await websocket.send_json({
                            "type": "status",
                            "status": "muted",
                        })

                    elif msg_type == "unmute":
                        is_muted = False
                        await websocket.send_json({
                            "type": "status",
                            "status": "live",
                        })

                    elif msg_type == "change_language":
                        new_lang = data.get("language")
                        if new_lang in settings.supported_languages:
                            current_language = new_lang
                            await websocket.send_json({
                                "type": "language_changed",
                                "language": new_lang,
                            })
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "code": "INVALID_LANGUAGE",
                                "message": f"Language {new_lang} not supported",
                            })

                    elif msg_type == "ping":
                        await websocket.send_json({"type": "pong"})

                except json.JSONDecodeError:
                    await websocket.send_json({
                        "type": "error",
                        "code": "INVALID_MESSAGE",
                        "message": "Invalid JSON message",
                    })

    except WebSocketDisconnect:
        logger.info(f"Translation WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"Translation WebSocket error: {e}")
        try:
            await websocket.close(code=4000, reason=str(e))
        except Exception:
            pass
