# Tapir Backend

The REST API server for [Tapir](../README.md) - run Tapir as a background HTTP service for external tools, web UIs, and scripts.

## Overview

The Tapir backend provides a RESTful API that exposes all core Tapir functionality over HTTP. This allows you to integrate Tapir into web applications, automation scripts, and other services without requiring direct access to the TUI.

## Prerequisites

| Dependency | Version | Purpose | Install |
|------------|---------|---------|---------|
| **[Bun](https://bun.sh)** | >= 1.0 | Runtime and package manager | `curl -fsSL https://bun.sh/install \| bash` |
| **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** | >= 2023.0.0 | Video/audio downloading | `pip install yt-dlp` or `brew install yt-dlp` |

### Optional Dependencies

| Dependency | Purpose |
|------------|---------|
| **[FFmpeg](https://ffmpeg.org)** | Audio conversion, high-quality downloads |
| **[OpenAI Whisper](https://github.com/openai/whisper)** | Media transcription |
| **[edge-tts](https://github.com/rany2/edge-tts)** | Text-to-speech (highest quality) |
| **[gTTS](https://github.com/pndurette/gTTS)** | Text-to-speech (fallback) |
| **[espeak](https://espeak.sourceforge.net/)** | Text-to-speech (offline) |

See the [main README](../README.md) for detailed installation instructions.

## Installation

```bash
cd backend
bun install
```

## Usage

### Starting the Server

```bash
# Start on default port 8384
bun start

# Custom port
bun start --port 9000

# Custom host and port
bun start --host 0.0.0.0 --port 9000
```

### Development Mode

```bash
# Run with auto-reload on file changes
bun dev
```

## Configuration

Configure the server via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TAPIR_API_KEY` | Bearer token for authentication (if set, all requests must include `Authorization: Bearer <token>`) | _(none)_ |
| `TAPIR_CORS_ORIGIN` | CORS allowed origin | `*` (all origins) |
| `TAPIR_RATE_LIMIT` | Maximum requests per IP per minute | `60` |

Example with authentication:

```bash
TAPIR_API_KEY=your-secret-key bun start
```

## Docker Deployment

The easiest way to run Tapir backend is using Docker. All dependencies (Bun, Python, yt-dlp, FFmpeg, Whisper, TTS engines, poppler-utils) are pre-installed and ready to use.

### Quick Start with Docker Compose

1. **Create a `.env` file (optional)** in the `backend/` directory:

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

Or create it manually:
```bash
# .env
TAPIR_API_KEY=your-secret-key-here
TAPIR_CORS_ORIGIN=*
TAPIR_RATE_LIMIT=60
```

2. **Start the container**:

```bash
cd backend
docker-compose up -d
```

3. **Verify it's running**:

```bash
curl http://localhost:8384/api/health
```

### Docker Compose Configuration

The `docker-compose.yml` includes:

- **Port mapping**: `8384:8384` - Access API on http://localhost:8384
- **Volume mounts**:
  - `./youtube_downloads:/app/youtube_downloads` - Downloaded files persist on host
  - `./whisper-cache:/root/.cache/whisper` - Whisper models cached (saves re-downloading)
- **Environment variables**: API key, CORS, rate limiting
- **Health check**: Automatically monitors server status
- **Restart policy**: `unless-stopped` - Auto-restart on failures
- **Resource limits**: 4GB memory limit (adjustable)

#### Pre-downloading Whisper Models (Optional but Recommended)

To avoid downloading the Whisper model on first transcription request, pre-download it:

```bash
# Create cache directory
mkdir -p backend/whisper-cache

# Download Whisper base model (142 MB)
docker run --rm -v $(pwd)/whisper-cache:/root/.cache/whisper \
  python:3.11-slim bash -c \
  "pip install openai-whisper && python3 -c 'import whisper; whisper.load_model(\"base\")'"
```

Now the model is cached and will be instantly available when the container starts.

### Standalone Docker Container

If you prefer using Docker directly without docker-compose:

**Build the image**:

```bash
# From backend directory
cd backend
docker build -t tapir-backend -f Dockerfile ..
```

**Run the container**:

```bash
docker run -d \
  --name tapir-backend \
  -p 8384:8384 \
  -v $(pwd)/youtube_downloads:/app/youtube_downloads \
  -v $(pwd)/whisper-cache:/root/.cache/whisper \
  -e TAPIR_API_KEY="" \
  -e TAPIR_CORS_ORIGIN="*" \
  -e TAPIR_RATE_LIMIT="60" \
  --restart unless-stopped \
  tapir-backend
```

**View logs**:

```bash
docker logs -f tapir-backend
```

**Stop and remove**:

```bash
docker stop tapir-backend
docker rm tapir-backend
```

### Docker Image Details

- **Base image**: Debian Bookworm Slim (lightweight, stable)
- **Multi-stage build**: Optimized for size and security
- **Final image size**: ~1.2 GB (without Whisper model; add ~142 MB for base model when cached)
- **Pre-installed dependencies**:
  - Bun runtime (>= 1.0)
  - Python 3.11 with pip
  - yt-dlp (latest)
  - FFmpeg (>= 5.0)
  - OpenAI Whisper library (models downloaded on first use or via volume mount)
  - edge-tts, gTTS (text-to-speech engines)
  - poppler-utils (PDF text extraction)
- **Security**: Runs as non-root user (`tapir`, UID 1000)
- **Networking**: Binds to `0.0.0.0:8384` for Docker accessibility

### Testing All Features

After starting the container, verify each feature works:

#### 1. Health Check
```bash
curl http://localhost:8384/api/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "5.0.0",
  "uptime": 123.45,
  "jobs": { "total": 0, "queued": 0, "running": 0, "completed": 0, "failed": 0 }
}
```

#### 2. YouTube Search
```bash
curl -X POST http://localhost:8384/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test video", "maxResults": 5}'
```

#### 3. Queue Download
```bash
curl -X POST http://localhost:8384/api/download \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "format": "best",
    "outputDir": "youtube_downloads"
  }'
```

Response includes `jobId`. Check status with:
```bash
curl http://localhost:8384/api/jobs/<jobId>
```

#### 4. Transcribe Media (Whisper base model)
```bash
curl -X POST http://localhost:8384/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "modelSize": "base",
    "outputFormat": "txt"
  }'
```

#### 5. Text-to-Speech (edge-tts)
First, create a text file in `youtube_downloads/test.txt`, then:
```bash
curl -X POST http://localhost:8384/api/tts \
  -H "Content-Type: application/json" \
  -d '{
    "inputFile": "/app/youtube_downloads/test.txt",
    "voice": "en-US-AriaNeural",
    "engine": "edge-tts",
    "outputFormat": "mp3"
  }'
```

#### 6. Audio Conversion (FFmpeg)
```bash
# First download a video, then convert it
curl -X POST http://localhost:8384/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "inputFile": "/app/youtube_downloads/video.m4a",
    "outputFormat": "mp3",
    "bitrate": 320
  }'
```

#### 7. Metadata Embedding (with thumbnail)
```bash
curl -X POST http://localhost:8384/api/metadata/embed \
  -H "Content-Type: application/json" \
  -d '{
    "file": "/app/youtube_downloads/audio.mp3",
    "title": "Test Title",
    "artist": "Test Artist",
    "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
  }'
```

### Accessing Downloaded Files

Files are saved to the mounted volume `./youtube_downloads` on your host machine:

```bash
ls -la backend/youtube_downloads/
```

### Environment Variables Reference

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `TAPIR_API_KEY` | Bearer token for authentication. If set, all requests must include `Authorization: Bearer <token>` | _(disabled)_ | `mysecret123` |
| `TAPIR_CORS_ORIGIN` | CORS allowed origin. Set to your frontend URL or `*` for all | `*` | `https://myapp.com` |
| `TAPIR_RATE_LIMIT` | Maximum requests per IP per minute | `60` | `100` |

### Troubleshooting

#### Container won't start
```bash
# Check logs
docker logs tapir-backend

# Check if port 8384 is already in use
lsof -i :8384  # macOS/Linux
netstat -ano | findstr :8384  # Windows
```

#### Health check failing
```bash
# Test health endpoint manually
docker exec tapir-backend curl -f http://localhost:8384/api/health

# Check if server is running
docker exec tapir-backend ps aux | grep bun
```

#### "yt-dlp not found" error
This should not happen in Docker. If it does:
```bash
# Verify yt-dlp is installed
docker exec tapir-backend which yt-dlp
docker exec tapir-backend yt-dlp --version
```

#### Transcription fails (Whisper)
```bash
# Verify Whisper model was downloaded
docker exec tapir-backend ls -la /root/.cache/whisper/

# Test Whisper manually
docker exec tapir-backend python3 -c "import whisper; print(whisper.load_model('base'))"
```

#### Permission issues with mounted volumes
If you get permission errors accessing `youtube_downloads`:
```bash
# Fix permissions (run on host)
sudo chown -R $(id -u):$(id -g) backend/youtube_downloads
sudo chown -R $(id -u):$(id -g) backend/whisper-cache
```

#### Out of memory errors
Large transcriptions or downloads may require more memory. Increase in `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      memory: 8G  # Increase from 4G
```

Then restart:
```bash
docker-compose down
docker-compose up -d
```

#### Rebuild with latest changes
```bash
# Stop and remove old container
docker-compose down

# Rebuild image from scratch
docker-compose build --no-cache

# Start fresh container
docker-compose up -d
```

### Security Best Practices

1. **Always set an API key in production**:
   ```bash
   TAPIR_API_KEY=$(openssl rand -hex 32)
   echo "TAPIR_API_KEY=$TAPIR_API_KEY" >> .env
   ```

2. **Restrict CORS in production**:
   ```bash
   TAPIR_CORS_ORIGIN=https://yourdomain.com
   ```

3. **Use a reverse proxy** (nginx, Caddy) for HTTPS:
   ```nginx
   location /api/ {
       proxy_pass http://localhost:8384/api/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

4. **Limit resource usage** with Docker constraints

5. **Keep images updated**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

### Advanced Configuration

#### Custom Port Mapping
To run on a different port (e.g., 9000):

```yaml
# docker-compose.yml
ports:
  - "9000:8384"
```

#### Multiple Instances
Run multiple instances by changing the container name and port:

```bash
docker run -d --name tapir-backend-2 -p 8385:8384 tapir-backend
```

#### Persistent Logs
Mount a log directory:

```yaml
volumes:
  - ./logs:/app/logs
```

## API Endpoints

### Health Check

**GET** `/api/health`

Returns server status, version, uptime, and job statistics.

**Response:**
```json
{
  "status": "ok",
  "version": "5.0.0",
  "uptime": 3600.5,
  "jobs": {
    "total": 10,
    "queued": 2,
    "running": 1,
    "completed": 6,
    "failed": 1
  }
}
```

### YouTube Search

**POST** `/api/search`

Search YouTube and return video results.

**Request:**
```json
{
  "query": "search terms",
  "maxResults": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "VIDEO_ID",
      "title": "Video Title",
      "channel": "Channel Name",
      "duration": "5:23",
      "viewCount": "1.2M views"
    }
  ],
  "count": 10
}
```

### Get Video Info

**POST** `/api/info`

Fetch metadata about a video URL.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=VIDEO_ID"
}
```

### Queue Download

**POST** `/api/download`

Queue a video download job.

**Request:**
```json
{
  "url": "https://youtube.com/watch?v=VIDEO_ID",
  "format": "best",
  "outputDir": "youtube_downloads",
  "downloadSubs": true,
  "subLangs": "en",
  "embedMetadata": true,
  "embedThumbnail": true
}
```

**Response:**
```json
{
  "jobId": "job_1234567890_1",
  "status": "queued"
}
```

### Queue Audio Conversion

**POST** `/api/convert`

Queue an audio conversion job.

**Request:**
```json
{
  "inputFile": "/path/to/audio.m4a",
  "outputFormat": "mp3",
  "bitrate": 320
}
```

Supported formats: `mp3`, `aac`, `m4a`, `ogg`, `wav`, `flac`

### Queue Text-to-Speech

**POST** `/api/tts`

Queue a text-to-speech job.

**Request:**
```json
{
  "inputFile": "/path/to/document.pdf",
  "voice": "en-US-AriaNeural",
  "outputFormat": "mp3",
  "outputDir": "youtube_downloads",
  "engine": "edge-tts"
}
```

Supported engines: `edge-tts`, `gtts`, `espeak`

### Queue Transcription

**POST** `/api/transcribe`

Queue a media transcription job.

**Request (from URL):**
```json
{
  "url": "https://youtube.com/watch?v=VIDEO_ID",
  "modelSize": "base",
  "language": "en",
  "outputFormat": "txt",
  "outputDir": "youtube_downloads"
}
```

**Request (from local file):**
```json
{
  "filePath": "/path/to/video.mp4",
  "modelSize": "base",
  "language": "en",
  "outputFormat": "srt",
  "outputDir": "youtube_downloads"
}
```

Supported models: `tiny`, `base`, `small`, `medium`, `large`
Supported formats: `txt`, `srt`, `vtt`

### List All Jobs

**GET** `/api/jobs`

List all jobs with optional filtering.

**Query Parameters:**
- `status` - Filter by status: `queued`, `running`, `completed`, `failed`
- `type` - Filter by type: `download`, `convert`, `tts`, `transcribe`

**Response:**
```json
{
  "jobs": [
    {
      "id": "job_1234567890_1",
      "type": "download",
      "status": "completed",
      "createdAt": 1234567890000,
      "startedAt": 1234567891000,
      "completedAt": 1234567920000,
      "result": { "success": true, "outputFile": "video.mp4" }
    }
  ],
  "count": 1
}
```

### Get Job Status

**GET** `/api/jobs/:id`

Get detailed status of a specific job.

**Response:**
```json
{
  "id": "job_1234567890_1",
  "type": "download",
  "status": "running",
  "progress": {
    "percent": 45.5,
    "downloaded": "10.2 MB",
    "total": "22.4 MB",
    "speed": "1.5 MB/s",
    "eta": "8s"
  }
}
```

### Delete Job

**DELETE** `/api/jobs/:id`

Delete a completed or failed job. Running jobs cannot be deleted.

### List Plugins

**GET** `/api/plugins`

List installed post-download, post-convert, and post-transcribe plugins.

### Embed Metadata

**POST** `/api/metadata/embed`

Manually embed metadata into a media file.

**Request:**
```json
{
  "file": "/path/to/video.mp4",
  "title": "Video Title",
  "artist": "Artist Name",
  "thumbnailUrl": "https://example.com/thumb.jpg"
}
```

## Authentication

If `TAPIR_API_KEY` is set, all requests must include an `Authorization` header:

```bash
curl -H "Authorization: Bearer your-secret-key" http://localhost:8384/api/health
```

## Rate Limiting

By default, the server limits each IP address to 60 requests per minute. This can be configured via the `TAPIR_RATE_LIMIT` environment variable.

When rate limited, the server responds with:
- Status: `429 Too Many Requests`
- Header: `Retry-After: 60`

## Job Management

Jobs are stored in-memory and persist for 24 hours after completion. The server maintains up to 1000 jobs at a time. Old completed jobs are automatically cleaned up.

Job statuses:
- `queued` - Job is waiting to start
- `running` - Job is currently processing
- `completed` - Job finished successfully
- `failed` - Job encountered an error

## Plugin System

The backend automatically runs user scripts from `~/.config/tapir/plugins/` after certain operations:

- **post-download** - After a video download completes
- **post-convert** - After audio conversion completes
- **post-transcribe** - After transcription completes

Plugin results are included in the job response.

## Project Structure

```
backend/
├── package.json        # Project configuration and scripts
├── tsconfig.json       # TypeScript configuration
├── README.md           # This file
└── src/
    └── server.ts       # REST API server implementation
```

## Security

The backend includes several security features:

- **Path validation** - Prevents directory traversal attacks
- **URL scheme validation** - Only allows safe URL schemes (http/https)
- **Rate limiting** - Prevents abuse
- **CORS configuration** - Configurable origin restrictions
- **Content-Type validation** - Enforces JSON payloads
- **Request size limits** - Maximum 1 MB request body
- **Security headers** - `X-Content-Type-Options`, `X-Frame-Options`

## Graceful Shutdown

The server handles `SIGINT` (Ctrl+C) and `SIGTERM` gracefully:
1. Stops accepting new requests
2. Waits for running jobs to complete (up to 30 seconds)
3. Exits cleanly

## Integration Examples

### cURL

```bash
# Download a video
curl -X POST http://localhost:8384/api/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=VIDEO_ID"}'

# Check job status
curl http://localhost:8384/api/jobs/job_1234567890_1
```

### JavaScript/TypeScript

```typescript
const response = await fetch('http://localhost:8384/api/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://youtube.com/watch?v=VIDEO_ID',
    format: 'best'
  })
});

const { jobId } = await response.json();

// Poll for status
const job = await fetch(`http://localhost:8384/api/jobs/${jobId}`).then(r => r.json());
```

### Python

```python
import requests

response = requests.post('http://localhost:8384/api/download', json={
    'url': 'https://youtube.com/watch?v=VIDEO_ID',
    'format': 'best'
})

job_id = response.json()['jobId']

# Poll for status
job = requests.get(f'http://localhost:8384/api/jobs/{job_id}').json()
```

## License

[MIT](../LICENSE)
