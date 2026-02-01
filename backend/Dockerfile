# Rosetta Backend Dockerfile
# Optimized for Render deployment with cold start considerations
FROM python:3.11-slim-bookworm

# Set working directory
WORKDIR /app

# Install system dependencies for WeasyPrint (PDF export)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # WeasyPrint dependencies
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    # Additional dependencies
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Render uses PORT environment variable (default to 10000 for Render)
ENV PORT=10000

# Expose the port
EXPOSE $PORT

# Health check for Render
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

# Run the application with shell to expand $PORT
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
