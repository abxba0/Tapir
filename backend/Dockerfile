# =============================================================================
# Stage 1: Builder - Install dependencies and pre-download Whisper model
# =============================================================================
FROM debian:bookworm-slim AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    unzip \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    poppler-utils \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Bun runtime
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages \
    yt-dlp \
    openai-whisper \
    edge-tts \
    gTTS

# Pre-download Whisper base model to reduce startup time
RUN python3 -c "import whisper; whisper.load_model('base')"

# =============================================================================
# Stage 2: Runtime - Minimal image with only required files
# =============================================================================
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    poppler-utils \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Bun from builder
COPY --from=builder /root/.bun /root/.bun
ENV PATH="/root/.bun/bin:${PATH}"

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/dist-packages /usr/local/lib/python3.11/dist-packages

# Copy pre-downloaded Whisper model from builder
COPY --from=builder /root/.cache/whisper /root/.cache/whisper

# Create app directory
WORKDIR /app

# Copy workspace dependencies in correct order (shared -> tui -> backend)
# This ensures all imports work correctly
COPY shared /app/shared
COPY tui/src /app/tui/src
COPY tui/package.json /app/tui/package.json
COPY backend/src /app/backend/src
COPY backend/package.json /app/backend/package.json

# Set working directory to backend
WORKDIR /app/backend

# Install backend dependencies
RUN bun install --production

# Create output directory
RUN mkdir -p /app/youtube_downloads

# Create non-root user for security (UID 1000, common in Docker)
RUN useradd -m -u 1000 -s /bin/bash tapir && \
    chown -R tapir:tapir /app /root/.cache/whisper

# Switch to non-root user
USER tapir

# Expose API port
EXPOSE 8384

# Environment variables with defaults
ENV TAPIR_API_KEY=""
ENV TAPIR_CORS_ORIGIN="*"
ENV TAPIR_RATE_LIMIT="60"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8384/api/health || exit 1

# Start the backend server on 0.0.0.0 for Docker accessibility
CMD ["bun", "run", "src/server.ts", "--host", "0.0.0.0", "--port", "8384"]
