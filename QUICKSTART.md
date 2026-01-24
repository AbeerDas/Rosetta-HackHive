# LectureLens - Quick Start Guide

Welcome to LectureLens! This guide will help you get the application up and running.

## Prerequisites

Before you begin, ensure you have:

- **Docker & Docker Compose** - For PostgreSQL and ChromaDB
- **Python 3.11+** - For the FastAPI backend
- **Node.js 18+** - For the React frontend
- **API Keys**:
  - [ElevenLabs API Key](https://elevenlabs.io/) - For Speech-to-Speech translation
  - [OpenRouter API Key](https://openrouter.ai/) - For LLM and embeddings

## Quick Setup

### 1. Clone and Configure

```bash
git clone https://github.com/yourusername/HackHive2026.git
cd HackHive2026
```

### 2. Set up Environment Variables

```bash
# Create .env file
cp .env.example .env

# Edit .env and add your API keys
# ELEVENLABS_API_KEY=your_key_here
# OPENROUTER_API_KEY=your_key_here
```

### 3. Run Setup Script (Automated)

```bash
chmod +x setup.sh
./setup.sh
```

**OR** follow the manual steps below:

### 3. Manual Setup

#### Start Docker Containers

**Option A: Databases only** (run backend locally)
```bash
cd docker
docker-compose up -d
cd ..
```

**Option B: Full stack** (backend runs in Docker with all dependencies)
```bash
cd docker
docker-compose --profile full up -d
cd ..
# Skip the backend setup below - it's running in Docker!
```

#### Setup Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
cd ..
```

#### Setup Frontend

```bash
cd frontend
npm install
cd ..
```

## Running the Application

You'll need **two terminal windows**:

### Terminal 1: Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

Backend will be available at: http://localhost:8080

API Documentation: http://localhost:8080/docs

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

Frontend will be available at: http://localhost:5173

## First Steps

1. **Create a folder** - Click the + button in the sidebar (e.g., "CS 401 - Machine Learning")
2. **Start a session** - Select your folder and click "New Session", choose your target language
3. **Upload documents** - Drag & drop PDF course materials for intelligent citations
4. **Start translation** - Click the Play button to begin real-time translation
5. **Generate notes** - After the lecture, generate structured notes from transcripts

## Troubleshooting

### Docker containers not starting

```bash
# Check Docker is running
docker ps

# Restart containers
cd docker
docker-compose down
docker-compose up -d
```

### Backend database connection errors

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check .env DATABASE_URL is correct
cat .env | grep DATABASE_URL
```

### Frontend won't start

```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Port already in use

If ports 5173, 8080, 5432, or 8000 are in use:

```bash
# Find and kill the process using a port (Linux/Mac)
lsof -ti:8080 | xargs kill -9

# On Windows PowerShell
netstat -ano | Select-String ":8080"
# Then kill the process: taskkill /PID <pid> /F
```

### PostgreSQL Port Conflict (Windows)

**Problem**: If you have a local PostgreSQL installation on Windows, it will conflict with the Docker PostgreSQL container since both try to use port 5432. You'll see errors like:

```
asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "lecturelens"
```

**Solution**: The project is configured to use port **5433** instead of 5432 to avoid conflicts.

If you encounter this issue, ensure these settings are correct:

1. **docker/docker-compose.yml** should map to port 5433:
   ```yaml
   ports:
     - "5433:5432"
   ```

2. **Both `.env` files** (root and backend/) should use port 5433:
   ```
   POSTGRES_PORT=5433
   DATABASE_URL=postgresql+asyncpg://lecturelens:lecturelens_dev@localhost:5433/lecturelens
   ```

3. After changes, recreate the Docker containers:
   ```bash
   cd docker
   docker-compose down -v
   docker-compose up -d
   ```

**To check if you have a local PostgreSQL**:
```powershell
# Windows PowerShell
netstat -ano | Select-String ":5432"
Get-Process -Id <pid>  # Check if it's postgres
```

### PDF Export not working

PDF export requires WeasyPrint system libraries. If you get "PDF_DEPS_MISSING" error:

**macOS:**
```bash
brew install cairo pango gdk-pixbuf libffi
```

**Ubuntu/Debian:**
```bash
sudo apt-get install python3-cffi libpango-1.0-0 libpangoft2-1.0-0
```

**Windows:**
See https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#windows

Alternatively, use "Export as Markdown" which doesn't require additional libraries.

## Development Workflow

### Backend Development

```bash
cd backend
source venv/bin/activate

# Run with auto-reload
uvicorn app.main:app --reload --port 8080

# Run tests
pytest

# Format code
black .
isort .

# Create new migration
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Frontend Development

```bash
cd frontend

# Run dev server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm test
```

## Project Structure

```
HackHive2026/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── api/      # API routes
│   │   ├── models/   # Database models
│   │   ├── services/ # Business logic
│   │   └── main.py
│   └── alembic/      # Database migrations
├── frontend/          # React frontend
│   ├── src/
│   │   ├── features/ # Feature modules
│   │   ├── stores/   # State management
│   │   └── services/ # API client
│   └── package.json
└── docker/           # Docker containers
    └── docker-compose.yml
```

## Supported Features

- ✅ Real-time lecture translation (6 languages)
- ✅ Live transcription with citations
- ✅ Document upload and processing (PDF)
- ✅ RAG-powered intelligent citations
- ✅ Question translation
- ✅ AI note generation
- ✅ PDF export

## API Endpoints

- `GET /health` - Health check
- `POST /api/folders` - Create folder
- `POST /api/sessions` - Create session
- `POST /api/documents/upload` - Upload document
- `WS /api/translate/stream` - Real-time translation
- `WS /api/transcribe/stream` - Live transcription
- `POST /api/notes/generate` - Generate notes

Full API documentation: http://localhost:8080/docs

## Need Help?

- Check the [README.md](README.md) for detailed documentation
- Review the [FRD documents](docs/FRDs/) for feature specifications
- Check Docker logs: `docker-compose logs`
- Check backend logs in the terminal
- Check browser console for frontend errors

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ for HackHive 2026
