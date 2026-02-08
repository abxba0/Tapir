#!/usr/bin/env bash
# =============================================================================
# Tapir Backend Docker Test Script
# =============================================================================
# Comprehensive test suite for the Tapir Docker container.
# Tests Dockerfile build, container startup, health checks, internal
# dependencies, volume mounts, environment variables, security (non-root),
# network, resource limits, and all API endpoints inside the container.
#
# Usage:
#   chmod +x test_backend_docker.sh
#   ./test_backend_docker.sh                    # Full Docker test suite
#   TAPIR_API_KEY=secret ./test_backend_docker.sh
#
# Prerequisites:
#   - Docker (or Docker Desktop) installed and running
#   - docker compose (v2) available
#   - Run from the project root directory
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
SKIP=0
TOTAL=0
FAILURES=""
CONTAINER_NAME="tapir-backend-test"
IMAGE_NAME="tapir-backend-test-image"
API_PORT=8384
API_KEY="${TAPIR_API_KEY:-}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/backend/docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# =============================================================================
# Helpers
# =============================================================================

assert_pass() {
  local test_name="$1"
  TOTAL=$((TOTAL + 1))
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} $test_name"
}

assert_fail() {
  local test_name="$1"
  local detail="${2:-}"
  TOTAL=$((TOTAL + 1))
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - $test_name${detail:+: $detail}"
  echo -e "  ${RED}FAIL${NC} $test_name${detail:+ ($detail)}"
}

assert_condition() {
  local test_name="$1"
  local condition="$2"
  local detail="${3:-}"
  TOTAL=$((TOTAL + 1))
  if eval "$condition"; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $test_name"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $test_name${detail:+: $detail}"
    echo -e "  ${RED}FAIL${NC} $test_name${detail:+ ($detail)}"
  fi
}

skip_test() {
  local test_name="$1"
  local reason="$2"
  TOTAL=$((TOTAL + 1))
  SKIP=$((SKIP + 1))
  echo -e "  ${YELLOW}SKIP${NC} $test_name ($reason)"
}

section() {
  echo ""
  echo -e "${CYAN}${BOLD}[$1]${NC}"
}

curl_api() {
  local method="$1"
  local path="$2"
  shift 2
  local auth_args=()
  if [ -n "$API_KEY" ]; then
    auth_args=(-H "Authorization: Bearer $API_KEY")
  fi
  curl -s -w "\n%{http_code}" -X "$method" "${auth_args[@]}" "$@" "http://localhost:${API_PORT}${path}" 2>/dev/null
}

get_body() { echo "$1" | sed '$d'; }
get_status() { echo "$1" | tail -1; }

cleanup() {
  echo ""
  echo -e "${CYAN}Cleaning up...${NC}"
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  echo "Done."
}

trap cleanup EXIT

# =============================================================================
# Pre-flight checks
# =============================================================================
echo -e "${BOLD}Tapir Docker Test Suite${NC}"
echo "Project: $PROJECT_ROOT"
echo "---"

# Check Docker is available
if ! command -v docker &>/dev/null; then
  echo -e "${RED}ERROR: Docker is not installed or not in PATH${NC}"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo -e "${RED}ERROR: Docker daemon is not running${NC}"
  exit 1
fi

# Stop any existing test container
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

# =============================================================================
# 1. Dockerfile Validation
# =============================================================================
section "1. Dockerfile Validation"

DOCKERFILE="${PROJECT_ROOT}/backend/Dockerfile"

assert_condition "Dockerfile exists" "[ -f '$DOCKERFILE' ]" "File not found at $DOCKERFILE"

# Check multi-stage build
STAGE_COUNT=$(grep -c "^FROM " "$DOCKERFILE" 2>/dev/null || echo 0)
assert_condition "Multi-stage build ($STAGE_COUNT stages)" "[ $STAGE_COUNT -ge 2 ]" "Expected >= 2 stages, got $STAGE_COUNT"

# Check for non-root user
if grep -q "^USER" "$DOCKERFILE"; then
  assert_pass "Non-root USER directive present"
else
  assert_fail "Non-root USER directive" "Missing USER instruction"
fi

# Check for HEALTHCHECK
if grep -q "^HEALTHCHECK" "$DOCKERFILE"; then
  assert_pass "HEALTHCHECK instruction present"
else
  assert_fail "HEALTHCHECK instruction" "Missing HEALTHCHECK"
fi

# Check EXPOSE port
if grep -q "EXPOSE 8384" "$DOCKERFILE"; then
  assert_pass "EXPOSE 8384 declared"
else
  assert_fail "EXPOSE 8384" "Port 8384 not exposed"
fi

# Check for security best practices
if grep -q "no-install-recommends" "$DOCKERFILE"; then
  assert_pass "apt uses --no-install-recommends"
else
  assert_fail "apt optimization" "Missing --no-install-recommends"
fi

if grep -q "rm -rf /var/lib/apt/lists" "$DOCKERFILE"; then
  assert_pass "apt cache cleaned"
else
  assert_fail "apt cache cleanup" "Missing apt list cleanup"
fi

# =============================================================================
# 2. Docker Compose Validation
# =============================================================================
section "2. Docker Compose Validation"

assert_condition "docker-compose.yml exists" "[ -f '$COMPOSE_FILE' ]" "File not found"

if grep -q "tapir-backend" "$COMPOSE_FILE"; then
  assert_pass "Service 'tapir-backend' defined"
else
  assert_fail "Service definition" "tapir-backend not found"
fi

if grep -q "8384:8384" "$COMPOSE_FILE"; then
  assert_pass "Port mapping 8384:8384 present"
else
  assert_fail "Port mapping" "8384:8384 not found"
fi

if grep -q "youtube_downloads" "$COMPOSE_FILE"; then
  assert_pass "Downloads volume mount defined"
else
  assert_fail "Volume mount" "youtube_downloads volume missing"
fi

if grep -q "whisper-cache" "$COMPOSE_FILE"; then
  assert_pass "Whisper cache volume mount defined"
else
  assert_fail "Volume mount" "whisper-cache volume missing"
fi

if grep -q "restart: unless-stopped" "$COMPOSE_FILE"; then
  assert_pass "Restart policy: unless-stopped"
else
  assert_fail "Restart policy" "Missing restart policy"
fi

if grep -q "healthcheck" "$COMPOSE_FILE"; then
  assert_pass "Docker Compose healthcheck defined"
else
  assert_fail "Compose healthcheck" "Missing healthcheck in compose"
fi

if grep -q "memory:" "$COMPOSE_FILE"; then
  assert_pass "Resource memory limits defined"
else
  assert_fail "Resource limits" "Missing memory limits"
fi

if grep -q "TAPIR_API_KEY" "$COMPOSE_FILE"; then
  assert_pass "TAPIR_API_KEY env var configured"
else
  assert_fail "Environment" "TAPIR_API_KEY not configured"
fi

if grep -q "TAPIR_CORS_ORIGIN" "$COMPOSE_FILE"; then
  assert_pass "TAPIR_CORS_ORIGIN env var configured"
else
  assert_fail "Environment" "TAPIR_CORS_ORIGIN not configured"
fi

if grep -q "TAPIR_RATE_LIMIT" "$COMPOSE_FILE"; then
  assert_pass "TAPIR_RATE_LIMIT env var configured"
else
  assert_fail "Environment" "TAPIR_RATE_LIMIT not configured"
fi

# =============================================================================
# 3. Docker Image Build
# =============================================================================
section "3. Docker Image Build"

echo -e "  Building Docker image (this may take a while)..."
BUILD_OUTPUT=$(docker build -t "$IMAGE_NAME" -f "$DOCKERFILE" "$PROJECT_ROOT" 2>&1) || true
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  assert_pass "Docker image builds successfully"
else
  assert_fail "Docker image build" "Build failed with exit code $BUILD_EXIT"
  echo "$BUILD_OUTPUT" | tail -20
  echo -e "\n${RED}Build failed - cannot proceed with runtime tests${NC}"
  # Still print summary
  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  DOCKER TEST RESULTS (BUILD FAILED)${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  echo -e "  Total:   $TOTAL"
  echo -e "  ${GREEN}Passed:  $PASS${NC}"
  echo -e "  ${RED}Failed:  $FAIL${NC}"
  echo -e "  ${YELLOW}Skipped: $SKIP${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
  exit 1
fi

# Check image size
IMAGE_SIZE=$(docker image inspect "$IMAGE_NAME" --format='{{.Size}}' 2>/dev/null || echo "0")
IMAGE_SIZE_MB=$((IMAGE_SIZE / 1024 / 1024))
echo -e "  Image size: ${IMAGE_SIZE_MB} MB"
assert_condition "Image size reasonable (<3GB)" "[ $IMAGE_SIZE_MB -lt 3072 ]" "Image is ${IMAGE_SIZE_MB}MB"

# =============================================================================
# 4. Container Startup
# =============================================================================
section "4. Container Startup"

ENV_ARGS=()
if [ -n "$API_KEY" ]; then
  ENV_ARGS+=(-e "TAPIR_API_KEY=$API_KEY")
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${API_PORT}:8384" \
  -e TAPIR_HOST=0.0.0.0 \
  -e TAPIR_CORS_ORIGIN="*" \
  -e TAPIR_RATE_LIMIT=120 \
  "${ENV_ARGS[@]}" \
  "$IMAGE_NAME" >/dev/null 2>&1

CONTAINER_RUNNING=$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || echo "false")
assert_condition "Container is running" "[ '$CONTAINER_RUNNING' = 'true' ]" "Container not running"

# Wait for API to be ready
echo -e "  Waiting for API to be ready..."
READY=false
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 2
done

if $READY; then
  assert_pass "API is responding within startup period"
else
  assert_fail "API startup" "API not responding after 60 seconds"
  echo "Container logs:"
  docker logs "$CONTAINER_NAME" 2>&1 | tail -20
fi

# =============================================================================
# 5. Internal Dependencies Check
# =============================================================================
section "5. Internal Dependencies"

# Check Bun
BUN_VERSION=$(docker exec "$CONTAINER_NAME" bun --version 2>/dev/null || echo "NOT_FOUND")
if [ "$BUN_VERSION" != "NOT_FOUND" ]; then
  assert_pass "Bun installed (v$BUN_VERSION)"
else
  assert_fail "Bun installation" "bun not found in container"
fi

# Check Python
PYTHON_VERSION=$(docker exec "$CONTAINER_NAME" python3 --version 2>/dev/null || echo "NOT_FOUND")
if [ "$PYTHON_VERSION" != "NOT_FOUND" ]; then
  assert_pass "Python installed ($PYTHON_VERSION)"
else
  assert_fail "Python installation" "python3 not found"
fi

# Check FFmpeg
FFMPEG_VERSION=$(docker exec "$CONTAINER_NAME" ffmpeg -version 2>/dev/null | head -1 || echo "NOT_FOUND")
if [ "$FFMPEG_VERSION" != "NOT_FOUND" ]; then
  assert_pass "FFmpeg installed"
else
  assert_fail "FFmpeg installation" "ffmpeg not found"
fi

# Check FFprobe
FFPROBE_CHECK=$(docker exec "$CONTAINER_NAME" ffprobe -version 2>/dev/null | head -1 || echo "NOT_FOUND")
if [ "$FFPROBE_CHECK" != "NOT_FOUND" ]; then
  assert_pass "FFprobe installed"
else
  assert_fail "FFprobe installation" "ffprobe not found"
fi

# Check yt-dlp
YTDLP_VERSION=$(docker exec "$CONTAINER_NAME" yt-dlp --version 2>/dev/null || echo "NOT_FOUND")
if [ "$YTDLP_VERSION" != "NOT_FOUND" ]; then
  assert_pass "yt-dlp installed (v$YTDLP_VERSION)"
else
  assert_fail "yt-dlp installation" "yt-dlp not found"
fi

# Check faster-whisper (Python package)
WHISPER_CHECK=$(docker exec "$CONTAINER_NAME" python3 -c "import faster_whisper; print('ok')" 2>/dev/null || echo "NOT_FOUND")
if [ "$WHISPER_CHECK" = "ok" ]; then
  assert_pass "faster-whisper Python package installed"
else
  assert_fail "faster-whisper installation" "Module not importable"
fi

# Check edge-tts
EDGE_TTS_CHECK=$(docker exec "$CONTAINER_NAME" python3 -c "import edge_tts; print('ok')" 2>/dev/null || echo "NOT_FOUND")
if [ "$EDGE_TTS_CHECK" = "ok" ]; then
  assert_pass "edge-tts Python package installed"
else
  assert_fail "edge-tts installation" "Module not importable"
fi

# Check gTTS
GTTS_CHECK=$(docker exec "$CONTAINER_NAME" python3 -c "import gtts; print('ok')" 2>/dev/null || echo "NOT_FOUND")
if [ "$GTTS_CHECK" = "ok" ]; then
  assert_pass "gTTS Python package installed"
else
  assert_fail "gTTS installation" "Module not importable"
fi

# Check poppler-utils (pdftotext)
PDFTOTEXT_CHECK=$(docker exec "$CONTAINER_NAME" which pdftotext 2>/dev/null || echo "NOT_FOUND")
if [ "$PDFTOTEXT_CHECK" != "NOT_FOUND" ]; then
  assert_pass "poppler-utils (pdftotext) installed"
else
  assert_fail "poppler-utils installation" "pdftotext not found"
fi

# Check curl (for healthcheck)
CURL_CHECK=$(docker exec "$CONTAINER_NAME" which curl 2>/dev/null || echo "NOT_FOUND")
if [ "$CURL_CHECK" != "NOT_FOUND" ]; then
  assert_pass "curl installed (for healthcheck)"
else
  assert_fail "curl installation" "curl not found (needed for healthcheck)"
fi

# =============================================================================
# 6. Security - Non-root User
# =============================================================================
section "6. Security - Non-root Execution"

RUNNING_USER=$(docker exec "$CONTAINER_NAME" whoami 2>/dev/null || echo "unknown")
assert_condition "Running as non-root user" "[ '$RUNNING_USER' != 'root' ]" "Running as $RUNNING_USER"

RUNNING_UID=$(docker exec "$CONTAINER_NAME" id -u 2>/dev/null || echo "0")
assert_condition "UID is 1000 (tapir user)" "[ '$RUNNING_UID' = '1000' ]" "UID is $RUNNING_UID"

# Check sensitive paths are not writable
WRITE_ETC=$(docker exec "$CONTAINER_NAME" sh -c 'touch /etc/test_write 2>/dev/null && echo writable || echo protected' 2>/dev/null)
assert_condition "/etc is not writable" "[ '$WRITE_ETC' = 'protected' ]" "/etc is writable by container user"

# =============================================================================
# 7. File System & Volumes
# =============================================================================
section "7. File System & Volumes"

# Downloads directory exists and is writable
DL_DIR_EXISTS=$(docker exec "$CONTAINER_NAME" sh -c '[ -d /app/youtube_downloads ] && echo yes || echo no' 2>/dev/null)
assert_condition "Downloads directory exists" "[ '$DL_DIR_EXISTS' = 'yes' ]"

DL_DIR_WRITABLE=$(docker exec "$CONTAINER_NAME" sh -c 'touch /app/youtube_downloads/.test_write && rm /app/youtube_downloads/.test_write && echo yes || echo no' 2>/dev/null)
assert_condition "Downloads directory is writable" "[ '$DL_DIR_WRITABLE' = 'yes' ]" "Not writable by tapir user"

# Whisper cache directory exists
WHISPER_DIR=$(docker exec "$CONTAINER_NAME" sh -c '[ -d /home/tapir/.cache/huggingface ] && echo yes || echo no' 2>/dev/null)
assert_condition "Whisper cache directory exists" "[ '$WHISPER_DIR' = 'yes' ]"

# App source files present
APP_SERVER=$(docker exec "$CONTAINER_NAME" sh -c '[ -f /app/backend/src/server.ts ] && echo yes || echo no' 2>/dev/null)
assert_condition "Backend server.ts present" "[ '$APP_SERVER' = 'yes' ]"

APP_SHARED=$(docker exec "$CONTAINER_NAME" sh -c '[ -d /app/shared ] && echo yes || echo no' 2>/dev/null)
assert_condition "Shared module present" "[ '$APP_SHARED' = 'yes' ]"

APP_TUI_SRC=$(docker exec "$CONTAINER_NAME" sh -c '[ -d /app/tui/src ] && echo yes || echo no' 2>/dev/null)
assert_condition "TUI source present" "[ '$APP_TUI_SRC' = 'yes' ]"

# =============================================================================
# 8. Environment Variables
# =============================================================================
section "8. Environment Variables"

# Check default env values inside container
CONTAINER_HOST=$(docker exec "$CONTAINER_NAME" sh -c 'echo $TAPIR_HOST' 2>/dev/null || echo "")
assert_condition "TAPIR_HOST is set" "[ -n '$CONTAINER_HOST' ]" "TAPIR_HOST is empty"

CONTAINER_PORT=$(docker exec "$CONTAINER_NAME" sh -c 'echo $TAPIR_PORT' 2>/dev/null || echo "")
assert_condition "TAPIR_PORT is set" "[ -n '$CONTAINER_PORT' ]" "TAPIR_PORT is empty"

CONTAINER_CORS=$(docker exec "$CONTAINER_NAME" sh -c 'echo $TAPIR_CORS_ORIGIN' 2>/dev/null || echo "")
assert_condition "TAPIR_CORS_ORIGIN is set" "[ -n '$CONTAINER_CORS' ]" "TAPIR_CORS_ORIGIN is empty"

CONTAINER_RATE=$(docker exec "$CONTAINER_NAME" sh -c 'echo $TAPIR_RATE_LIMIT' 2>/dev/null || echo "")
assert_condition "TAPIR_RATE_LIMIT is set" "[ -n '$CONTAINER_RATE' ]" "TAPIR_RATE_LIMIT is empty"

# =============================================================================
# 9. API Endpoint Tests (Inside Container)
# =============================================================================
section "9. API Endpoints - Health"

RESP=$(curl_api GET /api/health)
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_condition "GET /api/health returns 200" "[ '$STATUS' = '200' ]" "Got HTTP $STATUS"

if [ "$STATUS" = "200" ]; then
  HAS_STATUS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")
  assert_condition "Health status is 'ok'" "[ '$HAS_STATUS' = 'ok' ]" "Status: $HAS_STATUS"

  HAS_VERSION=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null || echo "")
  assert_condition "Health has version" "[ -n '$HAS_VERSION' ]" "Version missing"
fi

section "10. API Endpoints - Search"

RESP=$(curl_api POST /api/search -H "Content-Type: application/json" -d '{"query":"bun javascript runtime","maxResults":2}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_condition "POST /api/search returns 200" "[ '$STATUS' = '200' ]" "Got HTTP $STATUS"

# Missing query
RESP=$(curl_api POST /api/search -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_condition "Search without query returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

section "11. API Endpoints - Info"

# Missing URL
RESP=$(curl_api POST /api/info -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_condition "Info without URL returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

# Unsafe URL
RESP=$(curl_api POST /api/info -H "Content-Type: application/json" -d '{"url":"file:///etc/passwd"}')
STATUS=$(get_status "$RESP")
assert_condition "Info with file:// URL returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

section "12. API Endpoints - Download"

# Queue a download
RESP=$(curl_api POST /api/download -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"best"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_condition "POST /api/download returns 202" "[ '$STATUS' = '202' ]" "Got HTTP $STATUS"

DL_JOB_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('jobId',''))" 2>/dev/null || echo "")
assert_condition "Download returns jobId" "[ -n '$DL_JOB_ID' ]" "No jobId in response"

# Validate download job state
if [ -n "$DL_JOB_ID" ]; then
  RESP=$(curl_api GET "/api/jobs/$DL_JOB_ID")
  BODY=$(get_body "$RESP")
  STATUS=$(get_status "$RESP")
  assert_condition "GET job by ID returns 200" "[ '$STATUS' = '200' ]" "Got HTTP $STATUS"

  JOB_TYPE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('type',''))" 2>/dev/null || echo "")
  assert_condition "Job type is 'download'" "[ '$JOB_TYPE' = 'download' ]" "Type: $JOB_TYPE"
fi

section "13. API Endpoints - Convert"

# Invalid format
RESP=$(curl_api POST /api/convert -H "Content-Type: application/json" -d '{"inputFile":"/tmp/test.wav","outputFormat":"exe"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_condition "Invalid convert format returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

# Path traversal
RESP=$(curl_api POST /api/convert -H "Content-Type: application/json" -d '{"inputFile":"/etc/passwd","outputFormat":"mp3"}')
STATUS=$(get_status "$RESP")
assert_condition "Convert path traversal returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

section "14. API Endpoints - TTS"

# Missing input
RESP=$(curl_api POST /api/tts -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_condition "TTS without input returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

# Invalid engine
RESP=$(curl_api POST /api/tts -H "Content-Type: application/json" -d '{"inputFile":"/tmp/test.txt","engine":"bad"}')
STATUS=$(get_status "$RESP")
assert_condition "TTS invalid engine returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

section "15. API Endpoints - Transcribe"

# Missing source
RESP=$(curl_api POST /api/transcribe -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_condition "Transcribe without source returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

# Invalid model
RESP=$(curl_api POST /api/transcribe -H "Content-Type: application/json" -d '{"url":"https://example.com/v.mp4","modelSize":"invalid"}')
STATUS=$(get_status "$RESP")
assert_condition "Transcribe invalid model returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

section "16. API Endpoints - Jobs"

RESP=$(curl_api GET /api/jobs)
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_condition "GET /api/jobs returns 200" "[ '$STATUS' = '200' ]" "Got HTTP $STATUS"

JOB_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null || echo "0")
assert_condition "Jobs list has count >= 1" "[ '$JOB_COUNT' -ge 1 ]" "Count: $JOB_COUNT"

# Filter by type
RESP=$(curl_api GET "/api/jobs?type=download")
STATUS=$(get_status "$RESP")
assert_condition "Jobs filter by type returns 200" "[ '$STATUS' = '200' ]" "Got HTTP $STATUS"

# Filter by status
RESP=$(curl_api GET "/api/jobs?status=queued")
STATUS=$(get_status "$RESP")
assert_condition "Jobs filter by status returns 200" "[ '$STATUS' = '200' ]" "Got HTTP $STATUS"

# Non-existent job
RESP=$(curl_api GET /api/jobs/nonexistent)
STATUS=$(get_status "$RESP")
assert_condition "Non-existent job returns 404" "[ '$STATUS' = '404' ]" "Got HTTP $STATUS"

section "17. API Endpoints - Plugins"

RESP=$(curl_api GET /api/plugins)
STATUS=$(get_status "$RESP")
assert_condition "GET /api/plugins returns 200" "[ '$STATUS' = '200' ]" "Got HTTP $STATUS"

section "18. API Endpoints - Metadata"

RESP=$(curl_api POST /api/metadata/embed -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_condition "Metadata without file returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

# SSRF test
RESP=$(curl_api POST /api/metadata/embed -H "Content-Type: application/json" -d '{"file":"/tmp/t.mp3","thumbnailUrl":"http://169.254.169.254/meta"}')
STATUS=$(get_status "$RESP")
assert_condition "Metadata SSRF blocked returns 400" "[ '$STATUS' = '400' ]" "Got HTTP $STATUS"

section "19. API Endpoints - Error Handling"

RESP=$(curl_api GET /api/nonexistent)
STATUS=$(get_status "$RESP")
assert_condition "Unknown endpoint returns 404" "[ '$STATUS' = '404' ]" "Got HTTP $STATUS"

# =============================================================================
# 10. Docker Health Check
# =============================================================================
section "20. Docker Health Check"

# Wait a bit for Docker to run its health check
sleep 5
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "unknown")
if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "starting" ]; then
  assert_pass "Docker health check status: $HEALTH_STATUS"
else
  assert_fail "Docker health check" "Status: $HEALTH_STATUS"
fi

# =============================================================================
# 11. Container Resource Usage
# =============================================================================
section "21. Container Metrics"

MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemUsage}}" "$CONTAINER_NAME" 2>/dev/null || echo "N/A")
echo -e "  Memory usage: $MEMORY_USAGE"

CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" "$CONTAINER_NAME" 2>/dev/null || echo "N/A")
echo -e "  CPU usage: $CPU_USAGE"

# =============================================================================
# 12. Container Logs Check
# =============================================================================
section "22. Container Logs"

LOG_LINES=$(docker logs "$CONTAINER_NAME" 2>&1 | wc -l)
assert_condition "Container has log output" "[ $LOG_LINES -gt 0 ]" "No log output"

# Check for startup banner
BANNER_CHECK=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "Tapir REST API" || echo 0)
assert_condition "Startup banner present in logs" "[ $BANNER_CHECK -gt 0 ]" "Banner not found"

# Check for fatal errors
ERROR_COUNT=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -ic "fatal\|panic\|unhandled" || echo 0)
assert_condition "No fatal errors in logs" "[ $ERROR_COUNT -eq 0 ]" "$ERROR_COUNT fatal errors found"

# =============================================================================
# 13. Graceful Shutdown
# =============================================================================
section "23. Graceful Shutdown"

docker stop --time 10 "$CONTAINER_NAME" >/dev/null 2>&1 || true
EXIT_CODE=$(docker inspect --format='{{.State.ExitCode}}' "$CONTAINER_NAME" 2>/dev/null || echo "999")
assert_condition "Container exits cleanly (code 0)" "[ '$EXIT_CODE' = '0' ]" "Exit code: $EXIT_CODE"

# =============================================================================
# Results Summary
# =============================================================================
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  DOCKER TEST RESULTS${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "  Total:   $TOTAL"
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}Skipped: $SKIP${NC}"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo -e "${RED}${BOLD}  Failed tests:${NC}"
  echo -e "$FAILURES"
fi

echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
exit 0
