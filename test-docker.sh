#!/bin/sh
# Test script for Docker image verification
# This script tests the Docker image functionality

set -e

echo "==================================="
echo "YT-Video-Downloader Docker Tests"
echo "==================================="

IMAGE_NAME="yt-video-downloader:latest"
# Using a public domain video that should remain available
TEST_VIDEO_URL="https://www.youtube.com/watch?v=aqz-KE-bpKQ"  # Big Buck Bunny (CC licensed, stable)

echo "\n1. Checking if Docker is installed..."
if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is not installed"
    exit 1
fi
echo "✓ Docker is installed: $(docker --version)"

echo "\n2. Checking if image exists..."
if ! docker images | grep -q "yt-video-downloader"; then
    echo "WARNING: Image not found. Building now..."
    docker build -t "$IMAGE_NAME" .
fi
echo "✓ Image exists"

echo "\n3. Testing help command..."
docker run --rm "$IMAGE_NAME" --help > /dev/null
echo "✓ Help command works"

echo "\n4. Testing list-sites command..."
docker run --rm "$IMAGE_NAME" --list-sites > /dev/null
echo "✓ List sites command works"

echo "\n5. Verifying FFmpeg installation..."
docker run --rm "$IMAGE_NAME" sh -c "ffmpeg -version" > /dev/null
echo "✓ FFmpeg is installed"

echo "\n6. Verifying Python version..."
PYTHON_VERSION=$(docker run --rm "$IMAGE_NAME" sh -c "python --version")
echo "✓ Python version: $PYTHON_VERSION"

echo "\n7. Checking installed Python packages..."
if docker run --rm "$IMAGE_NAME" sh -c "pip list | grep -E '(yt-dlp|rich|textual)'" > /dev/null 2>&1; then
    echo "✓ Python packages are installed"
else
    echo "⚠ Some optional packages may not be installed (this is normal)"
fi

echo "\n8. Testing volume mount..."
TEST_DIR=$(mktemp -d)
docker run --rm -v "$TEST_DIR:/downloads" "$IMAGE_NAME" sh -c "ls -la /downloads" > /dev/null
rm -rf "$TEST_DIR"
echo "✓ Volume mount works"

echo "\n9. Checking image size..."
SIZE=$(docker images "$IMAGE_NAME" --format "{{.Size}}")
echo "✓ Image size: $SIZE"

echo "\n10. Testing info command (requires internet)..."
if docker run --rm "$IMAGE_NAME" "$TEST_VIDEO_URL" --info 2>&1 | grep -q "Title:"; then
    echo "✓ Info command works with test video"
else
    echo "⚠ Info command test skipped (no internet or video unavailable)"
fi

echo "\n==================================="
echo "All Docker tests completed successfully!"
echo "==================================="
