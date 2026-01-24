#!/bin/bash

# LectureLens Setup Script
# This script will set up the entire LectureLens development environment

set -e  # Exit on error

echo "🎓 LectureLens Setup Script"
echo "======================================"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install Docker Compose."
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+."
    exit 1
fi

echo "✅ All prerequisites found"
echo ""

# Setup environment variables
echo "📝 Setting up environment variables..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please create one based on .env.example"
    echo "   and add your API keys (ElevenLabs, OpenRouter)"
    exit 1
fi
echo "✅ Environment file found"
echo ""

# Start Docker containers
echo "🐳 Starting Docker containers (PostgreSQL + ChromaDB)..."
cd docker
docker-compose up -d
cd ..
echo "✅ Docker containers started"
echo ""

# Setup backend
echo "🐍 Setting up Python backend..."
cd backend

if [ ! -d "venv" ]; then
    echo "   Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "   Activating virtual environment..."
source venv/bin/activate

echo "   Installing Python dependencies..."
pip install --upgrade pip > /dev/null
pip install -r requirements.txt > /dev/null

echo "   Running database migrations..."
alembic upgrade head

echo "✅ Backend setup complete"
cd ..
echo ""

# Setup frontend
echo "⚛️  Setting up React frontend..."
cd frontend

echo "   Installing Node.js dependencies..."
npm install > /dev/null 2>&1

echo "✅ Frontend setup complete"
cd ..
echo ""

# Final instructions
echo "======================================"
echo "🎉 Setup complete!"
echo ""
echo "To start the application:"
echo ""
echo "  Terminal 1 (Backend):"
echo "  $ cd backend"
echo "  $ source venv/bin/activate"
echo "  $ uvicorn app.main:app --reload --port 8080"
echo ""
echo "  Terminal 2 (Frontend):"
echo "  $ cd frontend"
echo "  $ npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser"
echo ""
echo "API Documentation: http://localhost:8080/docs"
echo "======================================"
