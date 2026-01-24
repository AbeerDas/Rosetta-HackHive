# 🚀 LectureLens - Team Setup Guide

**Step-by-step instructions to get the app running on your machine.**

> ⚠️ Follow these steps **exactly** in order. Don't skip anything!

---

## 📋 Prerequisites Checklist

Before you begin, install these tools:

| Tool | Required Version | Download Link |
|------|------------------|---------------|
| **Docker Desktop** | 24+ | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Node.js** | 18+ (LTS recommended) | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.11+ | [python.org/downloads](https://www.python.org/downloads/) |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com/) |
| **Homebrew** (macOS only) | Latest | [brew.sh](https://brew.sh/) |

### Verify Your Installations

```bash
docker --version        # Should show: Docker version 24.x or higher
docker compose version  # Should show: Docker Compose version v2.x
node --version          # Should show: v18.x or higher
python3 --version       # Should show: Python 3.11.x or higher
```

**⚠️ IMPORTANT**: Make sure Docker Desktop is **running** (not just installed)!

---

## 📂 Step 1: Clone and Setup Environment

```bash
# Clone the project
git clone https://github.com/yourusername/HackHive2026.git
cd HackHive2026

# Copy the environment file
cp .env.example .env

# Edit .env and add your API keys (ELEVENLABS_API_KEY and OPENROUTER_API_KEY)
```

---

## 🔧 Step 2: Install System Dependencies (Optional for local dev)

PDF export requires some system libraries. You have TWO options:

### Option A: Run backend in Docker (recommended - no manual install)
Skip this step and use Docker for the backend (see Step 3b below).

### Option B: Run backend locally (requires manual install)
```bash
# macOS
brew install cairo pango gdk-pixbuf libffi

# Ubuntu/Debian
sudo apt-get install python3-cffi libpango-1.0-0 libpangoft2-1.0-0 libcairo2
```

> **Note**: If you skip this and run locally, PDF export won't work (but Markdown export will).

---

## 🐳 Step 3: Start Docker Services

### Option A: Databases only (for local development)

```bash
cd docker
docker compose up -d
cd ..
```

This starts PostgreSQL and ChromaDB. You'll run the backend locally (Step 4-6).

### Option B: Full stack in Docker (includes backend with all dependencies)

```bash
cd docker
docker compose --profile full up -d
cd ..
```

This starts PostgreSQL, ChromaDB, AND the backend. Skip Steps 4-6 and go directly to frontend setup!

> **Benefit**: All system dependencies (for PDF export) are included in Docker. No manual install needed.

### Verify Docker containers are running:

```bash
docker ps
```

**Option A** shows TWO containers:
- `lecturelens-postgres` on port **5432**
- `lecturelens-chroma` on port **8000**

**Option B** shows THREE containers (adds):
- `lecturelens-backend` on port **8080**

> ⚠️ **IMPORTANT**: ChromaDB uses port 8000. The backend runs on port **8080**.

---

## 🐍 Step 4: Setup Backend + Run Migration

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate    # Mac/Linux
# venv\Scripts\activate     # Windows

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### ⚠️ CRITICAL: Run Database Migration

This step is **required** - the app will not work without it!

```bash
# Make sure you're in the backend folder with venv activated
cd backend
source venv/bin/activate

# Run the migration
alembic upgrade head
```

You should see output like:
```
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 001, initial schema
```

If you see errors about "connection refused", make sure Docker containers are running (`docker ps`).

```bash
# Go back to root when done
cd ..
```

---

## ⚛️ Step 5: Setup Frontend

```bash
cd frontend
npm install
cd ..
```

---

## 🎯 Step 6: Run the Application

You need **TWO terminal windows**.

### Terminal 1: Start Backend on PORT 8080

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

> ⚠️ **CRITICAL**: You MUST use `--port 8080`. The frontend is configured to connect to port 8080!
> 
> Do NOT use port 8000 - that's already used by ChromaDB!

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8080
```

### Terminal 2: Start Frontend

```bash
cd frontend
npm run dev
```

---

## ✅ Step 7: Open the App

1. Open **Chrome** or **Edge** browser
2. Go to: **http://localhost:5173**

---

## 📊 Port Reference (IMPORTANT!)

| Service | Port | Notes |
|---------|------|-------|
| Frontend | 5173 | Vite dev server |
| **Backend API** | **8080** | ⚠️ MUST be 8080, NOT 8000! |
| PostgreSQL | 5432 | Database |
| ChromaDB | 8000 | Vector database (blocks this port) |

---

## 🔍 Common Issues

### "Cannot connect to database" or Migration fails

```bash
# Make sure Docker is running
docker ps

# Restart containers if needed
cd docker
docker compose down
docker compose up -d
cd ..

# Then retry migration
cd backend
source venv/bin/activate
alembic upgrade head
```

### Frontend shows errors / can't connect to backend

**Most likely cause**: Backend is running on wrong port!

1. Stop the backend (Ctrl+C)
2. Restart with correct port:
   ```bash
   uvicorn app.main:app --reload --port 8080
   ```

### "Port 8000 already in use"

That's ChromaDB! The backend must run on **8080**, not 8000.

```bash
uvicorn app.main:app --reload --port 8080
```

### "Port 8080 already in use"

```bash
# Find and kill the process
lsof -i :8080
kill -9 <PID>
```

### PDF Export not working

If PDF export fails with "PDF_DEPS_MISSING" error, you need to install the system dependencies:

```bash
# macOS
brew install cairo pango gdk-pixbuf libffi

# Ubuntu/Debian
sudo apt-get install python3-cffi libpango-1.0-0 libpangoft2-1.0-0
```

Then restart the backend. Alternatively, use "Export as Markdown" which works without additional libraries.

---

## 📱 Quick Reference: Daily Startup

### Option A: Local Backend Development

```bash
# Terminal 1: Docker + Backend
cd HackHive2026
cd docker && docker compose up -d && cd ..
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8080

# Terminal 2: Frontend
cd HackHive2026/frontend
npm run dev
```

### Option B: Full Docker Stack (easiest)

```bash
# Terminal 1: Start everything in Docker
cd HackHive2026/docker
docker compose --profile full up -d

# Terminal 2: Frontend only
cd HackHive2026/frontend
npm run dev
```

Open http://localhost:5173 in Chrome/Edge.
