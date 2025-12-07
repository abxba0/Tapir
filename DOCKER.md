# Docker Setup and Usage Guide

This document provides comprehensive instructions for building, running, and using the YT-video-downloader application in Docker.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Building the Docker Image](#building-the-docker-image)
- [Running the Container](#running-the-container)
- [Usage Examples](#usage-examples)
- [Advanced Configuration](#advanced-configuration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker Engine 20.10 or later
- Docker Compose 1.29 or later (optional, for easier management)
- At least 500MB of free disk space for the image

## Building the Docker Image

### Using Docker CLI

Build the image from the repository root:

```bash
docker build -t yt-video-downloader:latest .
```

To build with a specific tag:

```bash
docker build -t yt-video-downloader:4.0.0 .
```

### Using Docker Compose

Build the image using docker-compose:

```bash
docker-compose build
```

## Running the Container

### Basic Usage

**Show help:**
```bash
docker run --rm yt-video-downloader:latest
```

**Download a video:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID"
```

**On Windows (PowerShell):**
```powershell
docker run --rm -v ${PWD}/downloads:/downloads yt-video-downloader:latest `
  "https://youtube.com/watch?v=VIDEO_ID"
```

**On Windows (CMD):**
```cmd
docker run --rm -v %cd%\downloads:/downloads yt-video-downloader:latest ^
  "https://youtube.com/watch?v=VIDEO_ID"
```

### Using Docker Compose

**Download a video:**
```bash
docker-compose run --rm yt-downloader "https://youtube.com/watch?v=VIDEO_ID"
```

**Convert to MP3:**
```bash
docker-compose run --rm yt-downloader "https://youtube.com/watch?v=VIDEO_ID" --mp3
```

## Usage Examples

### Video Download Examples

**Download from YouTube:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://youtube.com/watch?v=dQw4w9WgXcQ"
```

**Download from Vimeo:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://vimeo.com/123456789"
```

**Download from SoundCloud:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://soundcloud.com/artist/track"
```

**Download as MP4:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID" --mp4
```

**Convert to MP3:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID" --mp3
```

**Download high quality (requires FFmpeg, included in image):**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID" --high
```

**Download with custom output directory:**
```bash
docker run --rm -v $(pwd)/my-videos:/downloads yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID" -o /downloads
```

### Playlist and Channel Downloads

**Download entire playlist:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://youtube.com/playlist?list=PLAYLIST_ID"
```

**Download from a channel:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "https://youtube.com/@username"
```

**Download playlist with archive file (incremental sync):**
```bash
docker run --rm \
  -v $(pwd)/downloads:/downloads \
  -v $(pwd)/archive:/app/archive \
  yt-video-downloader:latest \
  "https://youtube.com/playlist?list=PLAYLIST_ID" \
  --archive /app/archive/my-archive.txt
```

### Parallel Downloads

**Download multiple videos in parallel:**
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "URL1" "URL2" "URL3" --parallel --max-workers 5
```

**Download from a batch file:**
```bash
docker run --rm \
  -v $(pwd)/downloads:/downloads \
  -v $(pwd)/urls.txt:/app/urls.txt:ro \
  yt-video-downloader:latest \
  --batch-file /app/urls.txt --parallel
```

### Authentication with Cookies

**Using a cookies file:**
```bash
docker run --rm \
  -v $(pwd)/downloads:/downloads \
  -v $(pwd)/cookies.txt:/app/cookies.txt:ro \
  yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID" \
  --cookies /app/cookies.txt
```

### Interactive Mode

**Run the interactive menu:**
```bash
docker run --rm -it -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  --convert
```

**Note:** Audio conversion mode requires an interactive terminal (`-it` flags).

### Information Only

**Get video information without downloading:**
```bash
docker run --rm yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID" --info
```

**List supported sites:**
```bash
docker run --rm yt-video-downloader:latest --list-sites
```

## Advanced Configuration

### Volume Mounts

The container uses `/downloads` as the default download directory. Always mount a host directory to persist downloads:

```bash
-v /path/to/host/directory:/downloads
```

### Environment Variables

You can set environment variables for additional configuration:

```bash
docker run --rm \
  -e TZ=America/New_York \
  -v $(pwd)/downloads:/downloads \
  yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID"
```

### Custom Dockerfile Modifications

If you need to customize the image, you can modify the Dockerfile:

1. **Change the Python version:**
   ```dockerfile
   FROM python:3.11-alpine AS builder
   ```

2. **Add additional tools:**
   ```dockerfile
   RUN apk add --no-cache <package-name>
   ```

3. **Rebuild the image:**
   ```bash
   docker build -t yt-video-downloader:custom .
   ```

### Docker Compose Configuration

Customize `docker-compose.yml` for your needs:

```yaml
version: '3.8'

services:
  yt-downloader:
    build: .
    image: yt-video-downloader:latest
    volumes:
      - ./downloads:/downloads
      - ./cookies.txt:/app/cookies.txt:ro
    environment:
      - TZ=America/New_York
```

## Troubleshooting

### Permission Issues

If you encounter permission issues with downloaded files:

**On Linux/macOS:**
```bash
# Run with user ID mapping
docker run --rm \
  --user $(id -u):$(id -g) \
  -v $(pwd)/downloads:/downloads \
  yt-video-downloader:latest \
  "https://youtube.com/watch?v=VIDEO_ID"
```

### Download Failures

1. **Check internet connectivity:**
   ```bash
   docker run --rm yt-video-downloader:latest \
     "https://youtube.com/watch?v=VIDEO_ID" --info
   ```

2. **Verify the URL is valid:**
   ```bash
   docker run --rm yt-video-downloader:latest --list-sites
   ```

3. **Use cookies for restricted content:**
   ```bash
   docker run --rm \
     -v $(pwd)/cookies.txt:/app/cookies.txt:ro \
     -v $(pwd)/downloads:/downloads \
     yt-video-downloader:latest \
     "URL" --cookies /app/cookies.txt
   ```

### FFmpeg Issues

FFmpeg is included in the Docker image. If you encounter issues:

```bash
# Verify FFmpeg is available
docker run --rm yt-video-downloader:latest sh -c "ffmpeg -version"
```

### Container Size

To check the image size:
```bash
docker images yt-video-downloader:latest
```

To reduce image size, rebuild with `--squash` (requires experimental features):
```bash
docker build --squash -t yt-video-downloader:latest .
```

### Debug Mode

Run the container with a shell for debugging:
```bash
docker run --rm -it -v $(pwd)/downloads:/downloads \
  --entrypoint sh yt-video-downloader:latest
```

## Performance Tips

1. **Use parallel downloads for multiple videos:**
   ```bash
   --parallel --max-workers 5
   ```

2. **Mount the download directory on fast storage** (SSD recommended).

3. **Use archive files** for incremental playlist sync to avoid re-downloading.

4. **Limit workers** based on your network bandwidth and CPU.

## Security Best Practices

1. **Run as non-root user** when possible:
   ```bash
   docker run --rm --user $(id -u):$(id -g) ...
   ```

2. **Mount files as read-only** when they shouldn't be modified:
   ```bash
   -v $(pwd)/cookies.txt:/app/cookies.txt:ro
   ```

3. **Keep the image updated:**
   ```bash
   docker pull yt-video-downloader:latest
   docker-compose build --no-cache
   ```

4. **Review and audit cookies files** before mounting them.

## Cleanup

**Remove stopped containers:**
```bash
docker container prune
```

**Remove the image:**
```bash
docker rmi yt-video-downloader:latest
```

**Clean up all Docker resources:**
```bash
docker system prune -a
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Project README](README.md)

## Support

For issues related to:
- **Docker setup**: Check this guide and Docker documentation
- **Application features**: See the main README.md
- **Bugs or feature requests**: Open an issue on GitHub
