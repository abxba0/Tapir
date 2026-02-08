# Tapir Test Scripts

Comprehensive test suites for verifying all features across the backend REST API, Docker container, and frontend website.

## Scripts

| Script | Target | Tests | Prerequisites |
|--------|--------|-------|---------------|
| `test_backend.sh` | Backend REST API | ~100 | Backend server running |
| `test_backend_docker.sh` | Docker container | ~80 | Docker installed & running |
| `test_frontend.sh` | Next.js website | ~120 | Node.js 18+ and npm |

## Quick Start

```bash
# Run all three
./tests/test_backend.sh
./tests/test_backend_docker.sh
./tests/test_frontend.sh
```

## test_backend.sh

Tests the Tapir REST API server against a running instance.

### Usage

```bash
./tests/test_backend.sh                              # default localhost:8384
./tests/test_backend.sh http://localhost:9000         # custom URL
TAPIR_API_KEY=secret ./tests/test_backend.sh         # with authentication
```

### Prerequisites

- Backend server running (`bun run --cwd backend src/server.ts`)
- `curl` and `python3` available

### What It Tests

- **Health endpoint** -- status, version, uptime, job counts
- **CORS** -- preflight OPTIONS, Access-Control headers
- **Security headers** -- X-Content-Type-Options, X-Frame-Options, Content-Type
- **Authentication** -- API key enforcement when `TAPIR_API_KEY` is set
- **POST /api/search** -- query validation, maxResults capping
- **POST /api/info** -- URL validation, blocks `file://`, `javascript:`, `data:`, `vbscript://`
- **POST /api/download** -- URL safety, outputDir validation, job queueing (HTTP 202)
- **POST /api/convert** -- all 6 audio formats (mp3, aac, m4a, ogg, wav, flac), path traversal blocking
- **POST /api/tts** -- all 3 engines (edge-tts, gtts, espeak), format validation, outputDir blocking
- **POST /api/transcribe** -- all 5 Whisper models (tiny, base, small, medium, large), output formats (txt, srt, vtt)
- **GET /api/jobs** -- listing, filtering by status and type
- **GET/DELETE /api/jobs/:id** -- job lookup, deletion lifecycle, running job protection
- **GET /api/plugins** -- plugin info retrieval
- **POST /api/metadata/embed** -- SSRF prevention (localhost, 10.x, 192.168.x, 169.254.169.254, .internal, .local)
- **Error handling** -- 404 for unknown routes, malformed JSON, empty bodies

---

## test_backend_docker.sh

Builds the Docker image, runs the container, and validates everything inside it.

### Usage

```bash
./tests/test_backend_docker.sh
TAPIR_API_KEY=secret ./tests/test_backend_docker.sh
```

### Prerequisites

- Docker installed and daemon running
- Run from the project root (the script auto-detects paths)

### What It Tests

- **Dockerfile validation** -- multi-stage build, non-root USER, HEALTHCHECK, EXPOSE, apt optimizations
- **Docker Compose validation** -- service definition, port mapping, volumes, restart policy, resource limits, env vars
- **Image build** -- successful build, reasonable image size (<3GB)
- **Container startup** -- runs successfully, API responds within 60s
- **Internal dependencies** -- Bun, Python, FFmpeg, FFprobe, yt-dlp, faster-whisper, edge-tts, gTTS, poppler-utils, curl
- **Security** -- runs as non-root (UID 1000), /etc not writable
- **File system** -- downloads dir writable, whisper cache present, source files present
- **Environment variables** -- TAPIR_HOST, TAPIR_PORT, TAPIR_CORS_ORIGIN, TAPIR_RATE_LIMIT
- **All API endpoints** -- health, search, info, download, convert, TTS, transcribe, jobs, plugins, metadata
- **Docker health check** -- healthy/starting status
- **Container logs** -- startup banner present, no fatal errors
- **Graceful shutdown** -- clean exit code 0

The script automatically cleans up the test container on exit.

---

## test_frontend.sh

Validates the Next.js website structure, builds the project, and checks all components.

### Usage

```bash
./tests/test_frontend.sh
```

### Prerequisites

- Node.js 18+ and npm installed

### What It Tests

- **Project structure** -- package.json, tsconfig.json, next.config.js, src/app/
- **Dependencies** -- next, react, react-dom, MUI, Emotion, Tabler Icons, TypeScript, ESLint
- **TypeScript config** -- strict mode, path aliases, Next.js plugin, JSX preserve
- **Next.js config** -- static export, React strict mode, image optimization
- **ESLint config** -- extends next/core-web-vitals and next/typescript
- **All 6 route pages** -- dashboard, download, transcribe, text-to-speech, features, getting-started
- **Layout components** -- Header (GitHub button, mobile toggle), Sidebar (responsive drawer), MenuItems (all nav links)
- **Dashboard components** -- CapabilityCards, FeatureHighlights, QuickStart, SitesSupported, BlankCard, DashboardCard, PageContainer
- **Page content** -- URL inputs, format selectors, model selectors, engine selectors, job status displays
- **API client (tapirApi.ts)** -- all 9 functions, all 7 endpoints, type definitions, error handling, HTTP methods
- **npm install** -- succeeds, key packages in node_modules
- **ESLint** -- passes with no errors
- **TypeScript type checking** -- `tsc --noEmit` passes
- **Next.js production build** -- completes successfully
- **Static export** -- out/ directory, all route HTML files, JS/CSS bundles, proper HTML structure
- **Interactive features** -- useState/useEffect hooks, submit handlers, auto-refresh polling
- **Responsive design** -- breakpoints, Grid layout, mobile support
- **Build output analysis** -- total size, file counts, page count

---

## Output Format

All scripts use colored output:

- **PASS** (green) -- test passed
- **FAIL** (red) -- test failed
- **SKIP** (yellow) -- test skipped (missing prerequisite)

Each script exits with code `0` on success and `1` if any test fails. A summary table is printed at the end with pass/fail/skip counts and a list of all failures.

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `TAPIR_API_KEY` | `test_backend.sh`, `test_backend_docker.sh` | API key for authentication tests |
| `NEXT_PUBLIC_TAPIR_API_URL` | `test_frontend.sh` (indirectly) | Backend URL used by the frontend API client |
