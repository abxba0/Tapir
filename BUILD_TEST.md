# Building and Testing the Docker Image

## Note for CI/CD Environments

If you're building this Docker image in a CI/CD environment with network restrictions, you may encounter issues with Alpine package repositories. The Dockerfile is designed to work in standard Docker environments with internet access.

## Quick Dockerfile Validation

To validate the Dockerfile syntax without building:

```bash
# Check Dockerfile with hadolint (if installed)
docker run --rm -i hadolint/hadolint < Dockerfile

# Or simply check for syntax errors
docker build --help > /dev/null && echo "Docker is available"
```

## Local Build (with network access)

```bash
# Build the image
docker build -t yt-video-downloader:latest .

# Verify the build
docker images | grep yt-video-downloader

# Test the image
docker run --rm yt-video-downloader:latest --help
```

## Testing All Features

```bash
# Create a test downloads directory
mkdir -p ./test-downloads

# Test help command
docker run --rm yt-video-downloader:latest --help

# Test list sites
docker run --rm yt-video-downloader:latest --list-sites

# Test with a stable public domain video (Big Buck Bunny)
TEST_VIDEO="https://www.youtube.com/watch?v=aqz-KE-bpKQ"

# Get video info
docker run --rm yt-video-downloader:latest "$TEST_VIDEO" --info

# Test with output directory
docker run --rm -v $(pwd)/test-downloads:/downloads yt-video-downloader:latest \
  "$TEST_VIDEO" -o /downloads --info
```

## Verifying FFmpeg

```bash
# Check FFmpeg is installed
docker run --rm yt-video-downloader:latest sh -c "ffmpeg -version"

# Check Python packages
docker run --rm yt-video-downloader:latest sh -c "pip list"
```

## Image Size Check

```bash
# Check image size (should be lightweight due to Alpine base)
docker images yt-video-downloader:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

Expected size: ~300-500MB (Alpine + Python + FFmpeg + dependencies)

## Automated Testing

Use the provided test script:

```bash
# Make it executable
chmod +x test-docker.sh

# Run all tests
./test-docker.sh
```
