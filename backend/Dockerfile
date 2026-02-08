# =============================================================================
# Stage 0: Bun - Pull Bun binary from official image (avoids flaky curl)
# =============================================================================
FROM oven/bun:1 AS bun

# =============================================================================
# Stage 1: Builder - Install dependencies
# =============================================================================
# Optimization: python:3.11-slim (~45MB) replaces debian:bookworm-slim (~75MB)
# Python is pre-installed, eliminating separate python3/pip apt packages
FROM python:3.11-slim AS builder

# Install system dependencies
# Optimization: ffmpeg removed from apt - using static binary instead
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    xz-utils \
    poppler-utils \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy Bun binary from official image (more reliable than curl bun.sh)
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx
ENV PATH="/usr/local/bin:${PATH}"

# Optimization: Static FFmpeg binary (~30-40MB) replaces apt ffmpeg (~50-80MB)
# Only extract ffmpeg and ffprobe - no extra libs or docs needed
# Retry logic for network resilience during builds
RUN for i in 1 2 3 4; do \
        curl -fsSL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
            -o /tmp/ffmpeg.tar.xz && break || sleep $((i * 2)); \
    done && \
    tar -xf /tmp/ffmpeg.tar.xz -C /tmp --wildcards '*/ffmpeg' '*/ffprobe' && \
    mv /tmp/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ffmpeg && \
    mv /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ffprobe && \
    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe && \
    rm -rf /tmp/ffmpeg* /tmp/ffmpeg-*

# Install Python dependencies
# Optimization: faster-whisper (~30-50MB with CTranslate2) replaces
# openai-whisper (~170-200MB with PyTorch) - 5-10x smaller, faster inference
RUN pip install --no-cache-dir \
    yt-dlp \
    faster-whisper \
    edge-tts \
    gTTS && \
    ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp 2>/dev/null || true

# =============================================================================
# Stage 2: Runtime - Minimal image with only required files
# =============================================================================
FROM python:3.11-slim

# Install runtime dependencies + aggressive cleanup in same layer
# Optimization: ffmpeg removed (static binary copied from builder)
# Optimization: aggressive removal of docs, man pages, apt caches
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    ca-certificates \
    curl \
    && apt-get purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/* \
        /usr/share/doc/* \
        /usr/share/man/* \
        /tmp/*

# Copy Bun from official image (not from builder, to avoid pulling builder deps)
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun /usr/local/bin/bunx /usr/local/bin/bunx

# Copy static FFmpeg binaries from builder
COPY --from=builder /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=builder /usr/local/bin/ffprobe /usr/local/bin/ffprobe

# Copy Python packages from builder
# Optimization: path corrected to site-packages (standard for python:slim images)
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Optimization: consolidated ENV block reduces layer metadata overhead
ENV PATH="/usr/local/bin:${PATH}" \
    TAPIR_API_KEY="" \
    TAPIR_CORS_ORIGIN="*" \
    TAPIR_RATE_LIMIT="60" \
    TAPIR_HOST="0.0.0.0" \
    TAPIR_PORT="8384"

# Create Whisper cache directory in a location accessible to non-root user
RUN mkdir -p /home/tapir/.cache/huggingface

# Create app directory
WORKDIR /app

# Copy workspace dependencies in correct order (shared -> tui -> backend)
COPY shared /app/shared
COPY tui/src /app/tui/src
COPY tui/package.json /app/tui/package.json
COPY backend/src /app/backend/src
COPY backend/package.json /app/backend/package.json

# Set working directory to backend
WORKDIR /app/backend

# Create output directory
RUN mkdir -p /app/youtube_downloads

# Create non-root user for security (UID 1000, common in Docker)
RUN useradd -m -u 1000 -s /bin/bash tapir && \
    chown -R tapir:tapir /app /home/tapir/.cache

# Switch to non-root user
USER tapir

# Expose API port
EXPOSE 8384

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8384/api/health || exit 1

# Start the backend server on 0.0.0.0 for Docker accessibility
CMD ["sh", "-c", "bun run src/server.ts --host ${TAPIR_HOST:-0.0.0.0} --port ${TAPIR_PORT:-8384}"]
