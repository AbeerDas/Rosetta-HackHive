"""OpenRouter API client for LLM and embedding access."""

import json
import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenRouterClient:
    """Client for OpenRouter API (LLM and embeddings)."""

    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._http_client: Optional[httpx.AsyncClient] = None

    def _validate_api_key(self) -> None:
        """Validate that API key is configured."""
        if not self.api_key or not self.api_key.strip():
            raise ValueError(
                "OpenRouter API key is not configured. "
                "Please set OPENROUTER_API_KEY in your .env file."
            )

    @property
    def http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        self._validate_api_key()
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                base_url=self.BASE_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "HTTP-Referer": "https://rosetta.app",
                    "X-Title": "Rosetta",
                },
                timeout=60.0,
            )
        return self._http_client

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()

    async def validate_api_key(self) -> bool:
        """Validate the API key."""
        try:
            response = await self.http_client.get("/auth/key")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to validate OpenRouter API key: {e}")
            return False

    async def create_chat_completion(
        self,
        messages: list[dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4000,
    ) -> dict[str, Any]:
        """Create a chat completion.

        Args:
            messages: List of message objects with role and content
            model: Model to use (default from settings)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Returns:
            Completion response
        """
        model = model or settings.llm_model

        try:
            response = await self.http_client.post(
                "/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Chat completion failed with status {e.response.status_code}")
            # Try fallback model
            if model != settings.llm_model_fallback:
                logger.info(f"Retrying with fallback model: {settings.llm_model_fallback}")
                return await self.create_chat_completion(
                    messages=messages,
                    model=settings.llm_model_fallback,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            raise
        except Exception as e:
            logger.error(f"Chat completion failed: {e}")
            raise

    async def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4000,
    ) -> str:
        """Generate text from a prompt.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            model: Model to use
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate

        Returns:
            Generated text
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = await self.create_chat_completion(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return response["choices"][0]["message"]["content"]

    async def create_embedding(
        self,
        text: str,
        model: Optional[str] = None,
    ) -> list[float]:
        """Create an embedding for a single text.

        Args:
            text: Text to embed
            model: Embedding model to use

        Returns:
            Embedding vector
        """
        embeddings = await self.create_embeddings([text], model)
        return embeddings[0]

    async def create_embeddings(
        self,
        texts: list[str],
        model: Optional[str] = None,
    ) -> list[list[float]]:
        """Create embeddings for multiple texts.

        Args:
            texts: List of texts to embed
            model: Embedding model to use

        Returns:
            List of embedding vectors
        """
        model = model or settings.embedding_model_realtime

        try:
            response = await self.http_client.post(
                "/embeddings",
                json={
                    "model": model,
                    "input": texts,
                },
            )
            response.raise_for_status()
            data = response.json()
            # Sort by index and extract embeddings
            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            return [item["embedding"] for item in sorted_data]
        except Exception as e:
            logger.error(f"Embedding creation failed: {e}")
            raise

    async def extract_keywords(self, text: str) -> list[str]:
        """Extract keywords from text using LLM.

        Args:
            text: Text to extract keywords from

        Returns:
            List of keywords
        """
        prompt = f"""Extract 3-5 key academic terms from this lecture transcript segment.
Focus on: technical terms, proper nouns, concept names.
Return ONLY a JSON array of strings, no other text.

Text: "{text}"
"""
        try:
            response = await self.generate_text(
                prompt=prompt,
                temperature=0.1,
                max_tokens=200,
            )
            # Parse JSON response
            keywords = json.loads(response.strip())
            if isinstance(keywords, list):
                return keywords[:5]
            return []
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Keyword extraction failed: {e}")
            return []

    async def expand_concepts(self, keywords: list[str]) -> list[str]:
        """Expand keywords with related concepts.

        Args:
            keywords: List of keywords to expand

        Returns:
            List of expanded concepts
        """
        if not keywords:
            return []

        prompt = f"""Given these academic keywords, suggest 2-3 related concepts that might appear in course materials.
Focus on: synonyms, broader concepts, related technical terms.
Return ONLY a JSON array of strings, no other text.

Keywords: {json.dumps(keywords)}
"""
        try:
            response = await self.generate_text(
                prompt=prompt,
                temperature=0.2,
                max_tokens=200,
            )
            concepts = json.loads(response.strip())
            if isinstance(concepts, list):
                return concepts[:6]
            return []
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Concept expansion failed: {e}")
            return []

    async def translate_question(
        self,
        text: str,
        source_language: Optional[str] = None,
    ) -> dict[str, Any]:
        """Translate a question to English.

        Args:
            text: Question text to translate
            source_language: Optional source language hint

        Returns:
            Translation result with detected language
        """
        prompt = f"""You are a translation assistant helping students participate in English-language classrooms.

Task: Translate the following text to natural, grammatically correct English suitable for asking a professor in an academic setting.

Instructions:
1. First, detect the source language
2. Translate to English, preserving the original meaning and intent
3. Ensure the translation is a complete, well-formed question
4. Use academic but conversational language appropriate for a classroom
5. If the input is already in English, correct any grammar issues and return a polished version

Input text: "{text}"

Respond in this EXACT JSON format only, no other text:
{{"detected_language": "language code (zh, hi, es, fr, bn, en)", "detected_language_name": "full language name", "confidence": 0.0-1.0, "translated_text": "the English translation"}}
"""
        try:
            response = await self.generate_text(
                prompt=prompt,
                temperature=0.3,
                max_tokens=500,
            )
            result = json.loads(response.strip())
            return result
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Question translation failed: {e}")
            raise ValueError(f"Translation failed: {e}")

    async def translate_to_language(
        self,
        text: str,
        target_language: str,
    ) -> str:
        """Translate English text to a target language.

        Args:
            text: English text to translate
            target_language: Target language code (zh, hi, es, fr, bn)

        Returns:
            Translated text in target language
        """
        language_names = {
            "zh": "Chinese (Mandarin)",
            "hi": "Hindi",
            "es": "Spanish",
            "fr": "French",
            "bn": "Bengali",
        }
        
        target_name = language_names.get(target_language, target_language)
        
        prompt = f"""You are a real-time lecture translator. Translate the following English text to {target_name}.

Rules:
1. Translate naturally and fluently, as if spoken by a native speaker
2. Preserve the academic/educational tone
3. Keep technical terms accurate
4. Do not add explanations or commentary
5. Return ONLY the translated text, nothing else

English text: "{text}"

{target_name} translation:"""

        try:
            response = await self.generate_text(
                prompt=prompt,
                temperature=0.3,
                max_tokens=1000,
            )
            return response.strip()
        except Exception as e:
            logger.error(f"Translation to {target_language} failed: {e}")
            raise ValueError(f"Translation failed: {e}")


# Singleton instance
_openrouter_client: Optional[OpenRouterClient] = None


def get_openrouter_client() -> OpenRouterClient:
    """Get or create the OpenRouter client singleton."""
    global _openrouter_client
    if _openrouter_client is None:
        _openrouter_client = OpenRouterClient(settings.openrouter_api_key)
    return _openrouter_client
