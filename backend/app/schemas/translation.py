"""Translation schemas for API request/response models."""

from typing import List, Optional

from pydantic import BaseModel, Field


class LanguageInfo(BaseModel):
    """Schema for language information."""

    code: str
    name: str
    native_name: str
    available: bool


class LanguagesResponse(BaseModel):
    """Schema for supported languages response."""

    languages: List[LanguageInfo]


class QuestionTranslateRequest(BaseModel):
    """Schema for question translation request."""

    text: str = Field(..., min_length=1, max_length=1000, description="Text to translate")
    source_language: Optional[str] = Field(None, description="Optional source language hint")
    session_id: Optional[str] = Field(None, description="Optional session ID for context")


class QuestionTranslateResponse(BaseModel):
    """Schema for question translation response."""

    original_text: str
    translated_text: str
    detected_language: str
    detected_language_name: str
    confidence: float


class TTSSpeakRequest(BaseModel):
    """Schema for TTS speak request."""

    text: str = Field(..., min_length=1, max_length=1000, description="Text to speak")
    voice_id: Optional[str] = Field(None, description="ElevenLabs voice ID (uses default if not provided)")


# WebSocket message schemas for translation stream
class TranslationConnectedMessage(BaseModel):
    """WebSocket message for connection established."""

    type: str = "connected"
    session_id: str
    language: str


class TranslationStatusMessage(BaseModel):
    """WebSocket message for status update."""

    type: str = "status"
    status: str  # "live" | "muted" | "reconnecting"


class TranslationLanguageChangedMessage(BaseModel):
    """WebSocket message for language change."""

    type: str = "language_changed"
    language: str


class TranslationErrorMessage(BaseModel):
    """WebSocket message for error."""

    type: str = "error"
    code: str
    message: str
