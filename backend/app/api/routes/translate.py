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

# Default voices to use as fallback if API doesn't have voices_read permission
DEFAULT_VOICES = [
    {
        "voice_id": "21m00Tcm4TlvDq8ikWAM",
        "name": "Rachel",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Female", "age": "Young"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-5c96-470d-8571-1f6d2119b596.mp3"
    },
    {
        "voice_id": "EXAVITQu4vr4xnSDxMaL",
        "name": "Bella",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Female", "age": "Young"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/04e5ed84-4426-4700-9e82-e9e35f289f8b.mp3"
    },
    {
        "voice_id": "ErXwobaYiN019PkySvjV",
        "name": "Antoni",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Male", "age": "Young"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/ErXwobaYiN019PkySvjV/38d8f8f0-1122-4333-b323-0b87478d506a.mp3"
    },
    {
        "voice_id": "VR6AewLTigWG4xSOukaG",
        "name": "Arnold",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Male", "age": "Middle-Aged"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/VR6AewLTigWG4xSOukaG/66e83dc8-b2f6-4580-a2d5-f1f6b8f9e321.mp3"
    },
    {
        "voice_id": "pNInz6obpgDQGcFmaJgB",
        "name": "Adam",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Male", "age": "Middle-Aged"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/e0b45450-78db-49b9-aaa4-d5358a6871bd.mp3"
    },
    {
        "voice_id": "yoZ06aMxZJJ28mfd3POQ",
        "name": "Sam",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Male", "age": "Young"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/yoZ06aMxZJJ28mfd3POQ/1c4d417c-ba80-4de8-874a-a1c57987ea63.mp3"
    },
    {
        "voice_id": "AZnzlk1XvdvUeBnXmlld",
        "name": "Domi",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Female", "age": "Young"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/AZnzlk1XvdvUeBnXmlld/69c5373f-0dc2-4efd-9232-a0140182c0a9.mp3"
    },
    {
        "voice_id": "MF3mGyEYCl7XYWbV9V6O",
        "name": "Elli",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Female", "age": "Young"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/MF3mGyEYCl7XYWbV9V6O/d8c8a3c3-cf64-4354-8866-ab14d4e5af2e.mp3"
    },
    {
        "voice_id": "TxGEqnHWrfWFTfGW9XjX",
        "name": "Josh",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Male", "age": "Young"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/TxGEqnHWrfWFTfGW9XjX/e9cff670-a54c-490b-a4e4-57a6c9d4e7b8.mp3"
    },
    {
        "voice_id": "g5CIjZEefAph4nQFvHAz",
        "name": "Ethan",
        "category": "premade",
        "labels": {"accent": "American", "gender": "Male", "age": "Young"},
        "preview_url": "https://storage.googleapis.com/eleven-public-prod/premade/voices/g5CIjZEefAph4nQFvHAz/48eaef24-6b8c-4b06-8be8-38d3d5a2c67c.mp3"
    },
]


@router.get("/voices")
async def get_voices():
    """Get available ElevenLabs voices for TTS."""
    elevenlabs_client = get_elevenlabs_client()
    voices = await elevenlabs_client.get_voices()
    
    # If API returns empty (missing permissions), use default voices
    if not voices:
        logger.info("Using default voices (API may lack voices_read permission)")
        return {"voices": DEFAULT_VOICES}
    
    # Return a simplified list of voices
    simplified_voices = [
        {
            "voice_id": voice.get("voice_id"),
            "name": voice.get("name"),
            "category": voice.get("category", ""),
            "labels": voice.get("labels", {}),
            "preview_url": voice.get("preview_url"),
        }
        for voice in voices
    ]
    return {"voices": simplified_voices}


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
    audio_bytes = await service.speak(data.text, voice_id=data.voice_id)
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
    voice_id: str = None,
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
        voice_id: Optional ElevenLabs voice ID for TTS

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
    current_voice_id = voice_id
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
            audio_bytes = await elevenlabs_client.text_to_speech(translated_text, voice_id=current_voice_id)
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
                                    # Note: Frontend saves to database via REST API after receiving backend ID
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
