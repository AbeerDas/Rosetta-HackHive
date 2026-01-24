# Rosetta 🎓🔮

**Real-time lecture translation and learning assistant for HackHive 2026**

Rosetta helps international students and language learners break through language barriers in real-time. It provides live lecture translation, automatic transcription, intelligent citations from course materials, and structured note generation.

![Rosetta Banner](docs/assets/banner.png)

## ✨ Features

- **🎙️ Real-Time Translation** - Hear lectures in your preferred language with natural-sounding voice synthesis powered by ElevenLabs Speech-to-Speech
- **📝 Live Transcription** - Follow along with real-time text transcription using Google Web Speech API
- **📚 Smart Citations** - Automatically surface relevant course materials as the lecture progresses via RAG pipeline
- **❓ Question Translation** - Translate your questions to English before asking the professor
- **📒 AI Note Generation** - Generate structured lecture notes with embedded citations
- **📄 PDF Export** - Export your notes as professionally formatted PDFs

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Sidebar   │  │ Transcribe  │  │  Citations  │  │   Notes    │ │
│  │  (Folders)  │  │   Panel     │  │   Panel     │  │   Editor   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │ WebSocket │ REST
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend (FastAPI)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ Translation │  │ Transcribe  │  │     RAG     │  │   Notes    │ │
│  │   Service   │  │   Service   │  │   Service   │  │  Service   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
       │                                      │                │
       ▼                                      ▼                ▼
┌──────────────┐                    ┌─────────────────┐  ┌───────────┐
│  ElevenLabs  │                    │   OpenRouter    │  │PostgreSQL │
│    (S2S)     │                    │ (Embeddings+LLM)│  │  Chroma   │
└──────────────┘                    └─────────────────┘  └───────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ & npm
- Python 3.11+
- **System Libraries** (for PDF export):
  - macOS: `brew install cairo pango gdk-pixbuf libffi`
  - Ubuntu: `sudo apt-get install python3-cffi libpango-1.0-0 libpangoft2-1.0-0`
- API Keys:
  - [ElevenLabs](https://elevenlabs.io/) - Speech-to-Speech translation
  - [OpenRouter](https://openrouter.ai/) - LLM and embeddings

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/HackHive2026.git
   cd HackHive2026
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start the databases**
   ```bash
   cd docker
   docker-compose up -d
   ```

4. **Set up the backend**
   ```bash
   cd ../backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Run database migrations
   alembic upgrade head
   
   # Start the backend server
   uvicorn app.main:app --reload --port 8080
   ```

5. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:5173](http://localhost:5173)

## 📁 Project Structure

```
HackHive2026/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   └── routes/        # Route handlers
│   │   ├── core/              # Config, database
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic DTOs
│   │   ├── repositories/      # Data access layer
│   │   ├── services/          # Business logic
│   │   ├── external/          # API clients
│   │   └── main.py            # App entrypoint
│   ├── alembic/               # Database migrations
│   └── requirements.txt
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # Shared components
│   │   ├── features/          # Feature modules
│   │   ├── services/          # API client
│   │   ├── stores/            # Zustand stores
│   │   ├── theme/             # MUI theme
│   │   └── types/             # TypeScript types
│   └── package.json
├── docker/                     # Docker configs
│   └── docker-compose.yml
└── docs/                       # Documentation
    ├── FRDs/                   # Feature specs
    ├── PRD.md                  # Product requirements
    └── SETUP_GUIDE.md          # Setup guide
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ELEVENLABS_API_KEY` | ElevenLabs API key | Required |
| `OPENROUTER_API_KEY` | OpenRouter API key | Required |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://...` |
| `CHROMA_HOST` | ChromaDB host | `localhost` |
| `CHROMA_PORT` | ChromaDB port | `8000` |
| `EMBEDDING_MODEL_REALTIME` | Fast embedding model | `openai/text-embedding-3-small` |
| `EMBEDDING_MODEL_INDEXING` | Quality embedding model | `openai/text-embedding-3-large` |
| `LLM_MODEL` | Primary LLM for generation | `anthropic/claude-3-haiku` |

### Supported Languages

| Code | Language |
|------|----------|
| `en` | English (source) |
| `zh` | Chinese (Mandarin) |
| `hi` | Hindi |
| `es` | Spanish |
| `fr` | French |
| `bn` | Bengali |

## 📖 Usage

### Creating a Folder

1. Click the **+** button in the sidebar
2. Enter a name (e.g., "CS 401 - Machine Learning")
3. Click **Create**

### Starting a Session

1. Select a folder in the sidebar
2. Click **New Session**
3. Enter a session name and select target language
4. Click **Start Session**

### Uploading Documents

1. In an active session, drag & drop PDFs to the Documents panel
2. Wait for processing (documents are chunked and embedded)
3. Citations will appear automatically as the lecture progresses

### Real-Time Translation

1. Click **Play** in the audio controls
2. Speak or play lecture audio
3. Translation audio will play in your selected language

### Generating Notes

1. After the lecture, click the **Notes** button
2. Click **Generate from Transcripts**
3. Edit the generated notes as needed
4. Click **Export as PDF** to download

## 🧪 Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Code Style

```bash
# Backend (Black + isort)
cd backend
black .
isort .

# Frontend (ESLint + Prettier)
cd frontend
npm run lint
npm run format
```

### API Documentation

When the backend is running, visit:
- Swagger UI: [http://localhost:8080/docs](http://localhost:8080/docs)
- ReDoc: [http://localhost:8080/redoc](http://localhost:8080/redoc)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [ElevenLabs](https://elevenlabs.io/) for Speech-to-Speech API
- [OpenRouter](https://openrouter.ai/) for unified LLM access
- [ChromaDB](https://www.trychroma.com/) for vector storage
- [FastAPI](https://fastapi.tiangolo.com/) & [React](https://react.dev/)

---

Built with ❤️ for HackHive 2026
