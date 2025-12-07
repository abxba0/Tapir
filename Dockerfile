# Multi-stage Dockerfile for YT-video-downloader
# Using Alpine Linux for a lightweight image

# Stage 1: Builder stage for Python dependencies
FROM python:3.12-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev

# Create and activate virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install Python requirements
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /tmp/requirements.txt

# Stage 2: Runtime stage
FROM python:3.12-alpine

# Set metadata labels
LABEL maintainer="YT-video-downloader"
LABEL description="Multi-Site Video Downloader & Audio Converter supporting YouTube, Vimeo, SoundCloud, and 1800+ sites"
LABEL version="4.0.0"

# Install runtime dependencies only
# ffmpeg is essential for audio conversion and high-quality video merging
RUN apk add --no-cache ffmpeg

# Copy Python virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Set working directory
WORKDIR /app

# Copy application file
COPY youtube_downloader.py .

# Create downloads directory with appropriate permissions
RUN mkdir -p /downloads && chmod 755 /downloads

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Volume for downloads
VOLUME ["/downloads"]

# Set entrypoint and default command
ENTRYPOINT ["python", "youtube_downloader.py"]
CMD ["--help"]
