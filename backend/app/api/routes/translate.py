"""Translation API routes and WebSocket handler."""

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
    """WebSocket endpoint for real-time speech-to-speech translation.

    Query params:
        session_id: Session ID
        target_language: Target language code (e.g., "zh", "hi")

    Protocol:
        Client → Server: Binary frames (PCM audio chunks)
        Server → Client: Binary frames (translated audio)
        Client → Server: JSON control messages (mute, unmute, change_language)
        Server → Client: JSON status messages
    """
    # Validate language
    if target_language not in settings.supported_languages:
        await websocket.close(code=4001, reason="Invalid language")
        return

    await websocket.accept()

    # Send connected message
    await websocket.send_json({
        "type": "connected",
        "session_id": str(session_id),
        "language": target_language,
    })

    # Note: In a full implementation, this would:
    # 1. Create an ElevenLabs S2S stream
    # 2. Forward audio bidirectionally
    # 3. Handle mute/unmute/language change

    # For now, implement a basic echo/placeholder
    is_muted = False

    try:
        while True:
            message = await websocket.receive()

            if "bytes" in message:
                # Audio chunk received
                audio_chunk = message["bytes"]

                if not is_muted:
                    # In production: forward to ElevenLabs and return translated audio
                    # For now, acknowledge receipt
                    pass

            elif "text" in message:
                # Control message
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "mute":
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
                            target_language = new_lang
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
        await websocket.close(code=4000, reason=str(e))
