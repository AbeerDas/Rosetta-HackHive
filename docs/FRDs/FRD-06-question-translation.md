# FRD-06: Question Translation Assistant

## Overview

The Question Translation Assistant enables students to type questions in their native language and receive grammatically correct English translations they can ask the professor. This feature removes the language barrier from classroom participation, allowing students to formulate thoughts in their strongest language while still engaging with English-speaking instructors.

**Key Design Decisions:**

1. **Text-Based Input** — Questions are typed, not spoken. This provides better accuracy and allows students to review before submitting.

2. **Language Auto-Detection** — The system automatically detects the input language, removing friction from the translation process.

3. **Context-Aware Translation** — The LLM is instructed to produce natural, classroom-appropriate English suitable for asking a professor.

4. **Session History** — Translation history persists within the session for easy reference and re-use.

5. **Copy-Focused UX** — The primary action is copying the translation to clipboard for pasting into chat or reading aloud.

---

## User Stories

### Translating a Question

A Chinese-speaking student has a question about the lecture topic but isn't confident expressing it in English. They open the Question Assistant panel (accessible via a floating button or keyboard shortcut).

In the input field, they type their question in Chinese: "这个算法的时间复杂度是多少？" The system automatically detects the language as Chinese and displays "Chinese detected" below the input.

They click "Translate" (or press Enter). After a brief loading indicator, the English translation appears: "What is the time complexity of this algorithm?"

The translation is well-formed, grammatically correct, and appropriate for asking a professor. A "Copy" button appears next to the translation. The student clicks it, and the text is copied to their clipboard. They can now paste it into the class chat or read it aloud when called upon.

### Reviewing Translation History

During the lecture, the student translates three different questions. They want to go back to the first question they translated. The Question Assistant panel shows a history section below the input area.

Each history item shows:
- The original text (in the source language)
- The translated English text
- A timestamp
- A copy button

The student clicks the copy button on the first translation to reuse it.

### Clearing History

After the lecture, the student wants to clear their translation history. They click the "Clear History" button at the bottom of the history section. A confirmation appears, and after confirming, all history items are removed.

### Using Keyboard Shortcuts

An experienced user wants to translate quickly without using the mouse. They press `Ctrl+Shift+Q` (or `Cmd+Shift+Q` on Mac) to open the Question Assistant panel. They type their question and press Enter to translate. They press `Ctrl+C` while focused on the result to copy it. They press Escape to close the panel.

### Handling Translation Errors

The student types a question, but the translation fails due to a network error. The panel shows an error message: "Translation failed. Please try again." A "Retry" button appears. The original text is preserved in the input field so they don't have to retype.

---

## System Behavior

### Translation Flow

```
┌─────────────────────┐
│   User types text   │
│   in native lang    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Detect language    │
│  (optional hint)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Send to OpenRouter │
│  with translation   │
│  prompt             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  LLM translates to  │
│  natural English    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Return translation │
│  and detected lang  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Add to session     │
│  history            │
└─────────────────────┘
```

### Language Detection

The system uses the LLM to detect the input language as part of the translation request. This is more reliable than client-side detection libraries and handles mixed-language input gracefully.

**Supported Languages:**
- Chinese (Mandarin) - zh
- Hindi - hi
- Spanish - es
- French - fr
- Bengali - bn
- English - en (returns as-is with grammar check)

### Translation Prompt Design

The LLM is instructed to:
1. Detect the source language
2. Translate to natural, conversational English
3. Preserve the question's intent and specificity
4. Use academic/classroom-appropriate language
5. Return a grammatically correct, complete question

If the input is already in English, the LLM performs a grammar check and returns a polished version.

### Response Time Target

Translation should complete in under 2 seconds for typical question lengths (under 200 characters). The UI shows a loading indicator during translation.

---

## API Endpoints

### Translate Question

```
POST /api/v1/translate/question
```

Request Schema:
```
{
  text: string (required, max 1000 chars),
  source_language: string | null (optional hint),
  session_id: UUID | null (optional, for context)
}
```

Response Schema:
```
{
  original_text: string,
  translated_text: string,
  detected_language: string,
  detected_language_name: string,
  confidence: number (0-1)
}
```

### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | TEXT_EMPTY | Input text is empty |
| 400 | TEXT_TOO_LONG | Input exceeds 1000 characters |
| 400 | UNSUPPORTED_LANGUAGE | Detected language not in supported list |
| 500 | TRANSLATION_ERROR | LLM translation failed |
| 503 | SERVICE_UNAVAILABLE | OpenRouter unavailable |

---

## System State

### Client-Side State Only

Translation history is stored in client-side state (Zustand) and persists only for the browser session. This is a deliberate privacy decision — question translations are ephemeral and not stored on the server.

**Translation History Item:**
```typescript
interface TranslationHistoryItem {
  id: string;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  timestamp: Date;
}
```

**Store State:**
```typescript
interface QuestionTranslationState {
  history: TranslationHistoryItem[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  addTranslation: (item: TranslationHistoryItem) => void;
  clearHistory: () => void;
  setOpen: (open: boolean) => void;
}
```

---

## Frontend Behavior

### Panel Design

The Question Assistant appears as a slide-out panel from the right side of the screen, similar to a chat interface.

**Panel Layout:**
```
┌────────────────────────────────┐
│  Question Translation    [X]  │
├────────────────────────────────┤
│                                │
│  ┌──────────────────────────┐  │
│  │ Type your question...   │  │
│  │                          │  │
│  └──────────────────────────┘  │
│  Chinese detected    [Translate]│
│                                │
├────────────────────────────────┤
│  Translation:                  │
│  ┌──────────────────────────┐  │
│  │ What is the time         │  │
│  │ complexity of this       │  │
│  │ algorithm?          [📋] │  │
│  └──────────────────────────┘  │
│                                │
├────────────────────────────────┤
│  History                       │
│  ┌──────────────────────────┐  │
│  │ 这个算法...              │  │
│  │ What is the time...  [📋]│  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ Previous question...     │  │
│  └──────────────────────────┘  │
│                                │
│  [Clear History]               │
└────────────────────────────────┘
```

### Trigger Button

A floating action button appears in the bottom-right corner of the session view:
- Icon: Speech bubble with translation symbol
- Tooltip: "Translate Question (Ctrl+Shift+Q)"
- Badge: Number of translations in history (if > 0)

### Input Area

**Text Input:**
- Multi-line textarea
- Placeholder: "Type your question in your language..."
- Character counter showing current/max (e.g., "45/1000")
- Auto-grows up to 4 lines

**Language Indicator:**
- Appears below input after typing starts
- Shows detected language with confidence
- Updates as user types (debounced)

**Translate Button:**
- Primary action button
- Disabled when input is empty
- Shows loading spinner during translation
- Keyboard shortcut: Enter (when input focused)

### Translation Result

**Result Display:**
- Appears after successful translation
- Shows English translation in a distinct card
- Copy button with tooltip "Copy to clipboard"
- Visual feedback on successful copy (icon changes to checkmark)

**Error Display:**
- Red-bordered card for errors
- Error message with retry button
- Input preserved for retry

### History Section

**History List:**
- Scrollable list of past translations
- Most recent at top
- Each item shows:
  - Original text (truncated with "..." if long)
  - Translated text
  - Relative timestamp ("2 min ago")
  - Copy button
- Maximum 20 items stored

**Clear History:**
- Text button at bottom of history
- Confirmation dialog before clearing

### Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Shift + Q` | Open/close panel |
| `Enter` | Translate (when input focused) |
| `Escape` | Close panel |
| `Tab` | Navigate between elements |

### Responsive Behavior

**Desktop:**
- Panel slides in from right
- Width: 400px
- Overlays main content

**Tablet:**
- Full-width modal
- Slides up from bottom

**Mobile:**
- Full-screen modal
- Slides up from bottom

---

## Backend Implementation

### Service Layer

**QuestionTranslationService:**
```python
class QuestionTranslationService:
    def translate(self, text: str, source_language: str | None = None) -> TranslationResult
    def detect_language(self, text: str) -> LanguageDetection
```

**TranslationResult:**
```python
class TranslationResult:
    original_text: str
    translated_text: str
    detected_language: str
    detected_language_name: str
    confidence: float
```

### OpenRouter Integration

**Translation Prompt:**
```
You are a translation assistant helping students participate in English-language classrooms.

Task: Translate the following text to natural, grammatically correct English suitable for asking a professor in an academic setting.

Instructions:
1. First, detect the source language
2. Translate to English, preserving the original meaning and intent
3. Ensure the translation is a complete, well-formed question
4. Use academic but conversational language appropriate for a classroom
5. If the input is already in English, correct any grammar issues and return a polished version

Input text: "{user_text}"

Respond in this exact JSON format:
{
  "detected_language": "language code (zh, hi, es, fr, bn, en)",
  "detected_language_name": "full language name",
  "confidence": 0.0-1.0,
  "translated_text": "the English translation"
}
```

**Model Selection:**
- Use `openai/gpt-4o-mini` for fast, accurate translation
- Temperature: 0.3 (low creativity, high accuracy)
- Max tokens: 500

### External Client

**OpenRouterClient (translation methods):**
```python
class OpenRouterClient:
    async def translate_question(self, text: str, source_lang: str | None) -> TranslationResult
```

### Error Handling

| Scenario | Handling |
|----------|----------|
| Empty input | Return 400 before calling LLM |
| Input too long | Return 400, truncate suggestion |
| Unsupported language detected | Return 400 with supported list |
| LLM timeout | Retry once, then return 503 |
| Invalid LLM response | Return 500 with generic message |
| Rate limit exceeded | Return 429 with retry-after header |

### Rate Limiting

- Per-session limit: 30 translations per hour
- Prevents abuse while allowing reasonable usage
- Returns 429 with remaining time when exceeded

---

## Accessibility

### Screen Reader Support

- Panel has appropriate ARIA labels
- Live region announces translation results
- Error messages announced immediately

### Keyboard Accessibility

- All actions accessible via keyboard
- Focus trapped within panel when open
- Visible focus indicators on all interactive elements

### Visual Accessibility

- High contrast text
- Clear visual distinction between input and output
- Error states use both color and icons

