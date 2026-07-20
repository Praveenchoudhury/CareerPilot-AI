# ── CareerPilot AI — Production Dockerfile ────────────────────────────────────
# Targets AWS App Runner (expects port 8080) and any OCI-compliant runtime.
# Single-stage build; Python 3.12-slim keeps the image lean (~200 MB).
# ──────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

# Metadata
LABEL maintainer="CareerPilot AI"
LABEL version="1.0.0"
LABEL description="AI-powered Career Assistant — FastAPI + Gemini"

# ── Environment ────────────────────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

# ── Dependencies (cached layer) ────────────────────────────────────────────────
# Install system dependencies (Tesseract OCR)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ───────────────────────────────────────────────────────────
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# ── Non-root user for security ─────────────────────────────────────────────────
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

# ── Port ───────────────────────────────────────────────────────────────────────
EXPOSE 8080

# ── Health check ───────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c \
        "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health')" \
    || exit 1

# ── Start server ───────────────────────────────────────────────────────────────
# --workers 2: safe default for App Runner 1 vCPU instance.
# Increase to (2 * CPU_COUNT + 1) for larger instances.
CMD ["uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--workers", "2", \
     "--no-access-log"]
