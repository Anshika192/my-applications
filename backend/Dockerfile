# ============================
# Backend Dockerfile (Final)
# Supports:
#  - FFmpeg
#  - Faster-Whisper
#  - Tesseract OCR
#  - OpenCV headless
#  - google-generativeai >= 0.6.0
# ============================

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# ---- Install system dependencies ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ---- Install Python dependencies ----
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefer-binary -r /app/requirements.txt

# ---- Copy app code ----
COPY . /app

# ---- Expose port (Render uses PORT) ----
ENV PORT=10000

# ---- Run FastAPI ----
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]