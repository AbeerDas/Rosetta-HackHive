# Rosetta Architecture - Hybrid Convex + FastAPI

## Overview

Rosetta uses a **hybrid architecture** where:
- **Convex** handles all data storage, CRUD operations, authentication, and real-time subscriptions
- **FastAPI** handles all ML/AI services that require models, complex processing, or external APIs

---

## Convex Responsibilities

### Authentication
- User sign-up/sign-in (OAuth + email/password)
- Session management
- User profiles

**Location**: `frontend/convex/auth.ts`, `frontend/convex/users.ts`

### Data Storage & CRUD

| Entity | Convex File | Description |
|--------|-------------|-------------|
| **Folders** | `convex/folders.ts` | Course/subject organization |
| **Sessions** | `convex/sessions.ts` | Lecture sessions within folders |
| **Documents** | `convex/documents.ts` | PDF metadata + file storage |
| **Transcripts** | `convex/transcripts.ts` | Speech-to-text segments |
| **Citations** | `convex/citations.ts` | RAG-retrieved references |
| **Notes** | `convex/notes.ts` | Generated notes metadata |

### Real-time Features
- Live data subscriptions (no polling needed)
- Automatic UI updates when data changes

---

## FastAPI Responsibilities

### ML/AI Services

**Location**: All endpoints at `http://localhost:8001/api/v1/`

| Service | Endpoint | Purpose |
|---------|----------|---------|
| **Translation** | `/translate/*` | Question translation, language detection, TTS |
| **Transcription** | `/ws/transcription` | WebSocket for live speech-to-text |
| **Translation Stream** | `/ws/translation` | WebSocket for streaming translation |
| **RAG Pipeline** | N/A (internal) | Local ML models for citation retrieval |
| **Note Generation** | `/sessions/{id}/end` | LLM-powered note generation via OpenRouter |
| **Document Processing** | `/documents/{id}/process` | PDF extraction, chunking, embedding generation |
| **TTS** | `/translate/speak` | ElevenLabs text-to-speech |

### Why These Stay in FastAPI

1. **Local ML Models**: BGE embeddings, KeyBERT, TinyBERT require Python ML stack
2. **External API Integration**: ElevenLabs, OpenRouter need server-side keys
3. **Complex Processing**: PDF text extraction, chunking algorithms
4. **WebSocket Streaming**: Real-time audio/translation streaming

---

## Frontend API Usage

### Using Convex (Data Operations)

```typescript
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

// Query data (auto-subscribes to updates)
const folders = useQuery(api.folders.list);

// Mutate data
const createFolder = useMutation(api.folders.create);
await createFolder({ name: "New Folder" });
```

### Using FastAPI (ML Services)

```typescript
import { notesApi, translationApi, sessionApi } from '../../services/api';

// Generate notes (ML service)
await notesApi.generate(sessionId, { 
  force_regenerate: false,
  output_language: 'en' 
});

// Translate question
const translation = await translationApi.translateQuestion({
  question: "What is photosynthesis?",
  source_language: "en",
  target_language: "zh"
});

// End session and trigger note generation
await sessionApi.end(sessionId, { generate_notes: true });
```

---

## Migration Status

### ✅ Completed
- Convex schema defined
- Authentication system setup
- All CRUD operations migrated to Convex
- Frontend updated to use Convex for data
- ML services remain in FastAPI

### ⚠️ Temporarily Disabled
- Email verification (will add back with proper Convex actions)
- Password reset (will add back with proper Convex actions)

### 📝 Next Steps
1. Configure OAuth providers (GitHub, Google, Apple)
2. Set up Resend API for email OTPs
3. Re-enable email verification
4. Add password reset flow
5. Deploy to production

---

## Environment Variables

### Frontend (`.env.local`)
```bash
VITE_CONVEX_URL=https://your-project.convex.cloud  # Convex deployment URL
VITE_FASTAPI_URL=http://localhost:8001             # FastAPI ML services
```

### Backend (`.env`)
```bash
# Database (for document chunks and embeddings)
DATABASE_URL=postgresql://user:password@localhost:5433/lecturelens

# ChromaDB (for vector search)
CHROMA_HOST=localhost
CHROMA_PORT=8000

# OpenRouter (for LLM)
OPENROUTER_API_KEY=your_key

# ElevenLabs (for TTS)
ELEVENLABS_API_KEY=your_key
```

### Convex Dashboard Environment Variables
```bash
# OAuth (configure in Convex dashboard)
AUTH_GITHUB_ID=your_github_oauth_id
AUTH_GITHUB_SECRET=your_github_oauth_secret
AUTH_GOOGLE_ID=your_google_oauth_id
AUTH_GOOGLE_SECRET=your_google_oauth_secret
AUTH_APPLE_ID=your_apple_oauth_id
AUTH_APPLE_SECRET=your_apple_oauth_secret

# Email (Resend)
AUTH_RESEND_KEY=your_resend_api_key

# Site URL (for OAuth callbacks)
CONVEX_SITE_URL=https://your-project.convex.site
```

---

## Running Locally

### Start All Services

```bash
# Terminal 1: Docker services (PostgreSQL + ChromaDB)
cd docker
docker-compose up

# Terminal 2: FastAPI backend (ML services)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8001

# Terminal 3: Convex dev (data layer)
cd frontend
npx convex dev

# Terminal 4: Frontend dev server
cd frontend
npm run dev
```

### Access Points
- **Frontend**: http://localhost:5173
- **FastAPI Docs**: http://localhost:8001/docs
- **Convex Dashboard**: https://dashboard.convex.dev
