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
