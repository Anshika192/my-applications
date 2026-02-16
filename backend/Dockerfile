# backend/Dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for your libs (tesseract, opencv-headless etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Python deps (requirements.txt sits in backend/)
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && \
    pip install --prefer-binary -r /app/requirements.txt

# Copy backend code
COPY . /app

# Render provides $PORT
ENV PORT=10000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]