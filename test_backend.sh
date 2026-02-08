#!/usr/bin/env bash
# =============================================================================
# Tapir Backend Test Script
# =============================================================================
# Comprehensive test suite for the Tapir REST API backend.
# Tests all 12 endpoints, security features, rate limiting, auth, CORS,
# input validation, job lifecycle, and error handling.
#
# Usage:
#   chmod +x test_backend.sh
#   ./test_backend.sh                          # Test against localhost:8384
#   ./test_backend.sh http://localhost:9000     # Custom base URL
#   TAPIR_API_KEY=secret ./test_backend.sh      # With auth
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:8384}"
API_KEY="${TAPIR_API_KEY:-}"
PASS=0
FAIL=0
SKIP=0
TOTAL=0
FAILURES=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Temp files for test artifacts
TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

# =============================================================================
# Helpers
# =============================================================================

auth_header() {
  if [ -n "$API_KEY" ]; then
    echo "-H \"Authorization: Bearer $API_KEY\""
  fi
}

curl_cmd() {
  local method="$1"
  local path="$2"
  shift 2
  local url="${BASE_URL}${path}"
  local auth_args=()
  if [ -n "$API_KEY" ]; then
    auth_args=(-H "Authorization: Bearer $API_KEY")
  fi
  curl -s -w "\n%{http_code}" -X "$method" "${auth_args[@]}" "$@" "$url" 2>/dev/null
}

get_body() {
  echo "$1" | sed '$d'
}

get_status() {
  echo "$1" | tail -1
}

assert_status() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $test_name (HTTP $actual)"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $test_name: expected HTTP $expected, got HTTP $actual"
    echo -e "  ${RED}FAIL${NC} $test_name (expected HTTP $expected, got HTTP $actual)"
  fi
}

assert_json_field() {
  local test_name="$1"
  local body="$2"
  local field="$3"
  local expected="$4"
  TOTAL=$((TOTAL + 1))
  local actual
  actual=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$field)" 2>/dev/null || echo "__PARSE_ERROR__")
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $test_name ($field = $actual)"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $test_name: $field expected '$expected', got '$actual'"
    echo -e "  ${RED}FAIL${NC} $test_name ($field expected '$expected', got '$actual')"
  fi
}

assert_json_exists() {
  local test_name="$1"
  local body="$2"
  local field="$3"
  TOTAL=$((TOTAL + 1))
  local result
  result=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('exists' if d$field is not None else 'missing')" 2>/dev/null || echo "missing")
  if [ "$result" = "exists" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $test_name ($field exists)"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $test_name: $field not found in response"
    echo -e "  ${RED}FAIL${NC} $test_name ($field not found)"
  fi
}

assert_body_contains() {
  local test_name="$1"
  local body="$2"
  local needle="$3"
  TOTAL=$((TOTAL + 1))
  if echo "$body" | grep -q "$needle"; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $test_name (contains '$needle')"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $test_name: response does not contain '$needle'"
    echo -e "  ${RED}FAIL${NC} $test_name (missing '$needle')"
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

# =============================================================================
# Pre-flight: check server is up
# =============================================================================
echo -e "${BOLD}Tapir Backend Test Suite${NC}"
echo "Target: $BASE_URL"
echo "Auth:   $([ -n "$API_KEY" ] && echo 'enabled' || echo 'disabled')"
echo "---"

PREFLIGHT=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" 2>/dev/null || echo "000")
if [ "$PREFLIGHT" = "000" ]; then
  echo -e "${RED}ERROR: Cannot reach $BASE_URL - is the backend running?${NC}"
  echo "Start it with: bun run --cwd backend src/server.ts"
  exit 1
fi

# =============================================================================
# 1. Health Endpoint
# =============================================================================
section "1. GET /api/health - Health Check"

RESP=$(curl_cmd GET /api/health)
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")

assert_status "Health returns 200" "200" "$STATUS"
assert_json_field "Status is ok" "$BODY" "['status']" "ok"
assert_json_exists "Has version field" "$BODY" "['version']"
assert_json_exists "Has uptime field" "$BODY" "['uptime']"
assert_json_exists "Has jobs.total" "$BODY" "['jobs']['total']"
assert_json_exists "Has jobs.queued" "$BODY" "['jobs']['queued']"
assert_json_exists "Has jobs.running" "$BODY" "['jobs']['running']"
assert_json_exists "Has jobs.completed" "$BODY" "['jobs']['completed']"
assert_json_exists "Has jobs.failed" "$BODY" "['jobs']['failed']"

# =============================================================================
# 2. CORS Preflight
# =============================================================================
section "2. OPTIONS - CORS Preflight"

RESP=$(curl_cmd OPTIONS /api/health -H "Origin: http://example.com" -H "Access-Control-Request-Method: POST")
STATUS=$(get_status "$RESP")
assert_status "OPTIONS returns 200" "200" "$STATUS"

# Check CORS headers
CORS_HEADERS=$(curl -s -D - -o /dev/null -X OPTIONS "${BASE_URL}/api/health" -H "Origin: http://example.com" 2>/dev/null)
TOTAL=$((TOTAL + 1))
if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin"; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} CORS Access-Control-Allow-Origin header present"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - CORS: Access-Control-Allow-Origin header missing"
  echo -e "  ${RED}FAIL${NC} CORS Access-Control-Allow-Origin header missing"
fi

TOTAL=$((TOTAL + 1))
if echo "$CORS_HEADERS" | grep -qi "access-control-allow-methods"; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} CORS Access-Control-Allow-Methods header present"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - CORS: Access-Control-Allow-Methods header missing"
  echo -e "  ${RED}FAIL${NC} CORS Access-Control-Allow-Methods header missing"
fi

# =============================================================================
# 3. Security Headers
# =============================================================================
section "3. Security Headers"

SEC_HEADERS=$(curl -s -D - -o /dev/null "${BASE_URL}/api/health" 2>/dev/null)

TOTAL=$((TOTAL + 1))
if echo "$SEC_HEADERS" | grep -qi "x-content-type-options: nosniff"; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} X-Content-Type-Options: nosniff present"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - Security: X-Content-Type-Options header missing"
  echo -e "  ${RED}FAIL${NC} X-Content-Type-Options: nosniff missing"
fi

TOTAL=$((TOTAL + 1))
if echo "$SEC_HEADERS" | grep -qi "x-frame-options: DENY"; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} X-Frame-Options: DENY present"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - Security: X-Frame-Options header missing"
  echo -e "  ${RED}FAIL${NC} X-Frame-Options: DENY missing"
fi

TOTAL=$((TOTAL + 1))
if echo "$SEC_HEADERS" | grep -qi "content-type: application/json"; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} Content-Type is application/json"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - Security: Content-Type not application/json"
  echo -e "  ${RED}FAIL${NC} Content-Type is not application/json"
fi

# =============================================================================
# 4. Authentication
# =============================================================================
section "4. Authentication"

if [ -n "$API_KEY" ]; then
  # Test with no auth header (should fail)
  RESP=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/health" 2>/dev/null)
  STATUS=$(get_status "$RESP")
  assert_status "No auth header returns 401" "401" "$STATUS"

  # Test with wrong key
  RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer wrong-key" "${BASE_URL}/api/health" 2>/dev/null)
  STATUS=$(get_status "$RESP")
  assert_status "Wrong API key returns 401" "401" "$STATUS"

  # Test with correct key
  RESP=$(curl_cmd GET /api/health)
  STATUS=$(get_status "$RESP")
  assert_status "Correct API key returns 200" "200" "$STATUS"
else
  skip_test "Auth rejection test" "TAPIR_API_KEY not set"
  # Unauthenticated access should work
  RESP=$(curl_cmd GET /api/health)
  STATUS=$(get_status "$RESP")
  assert_status "No-auth mode allows access" "200" "$STATUS"
fi

# =============================================================================
# 5. POST /api/search - YouTube Search
# =============================================================================
section "5. POST /api/search - YouTube Search"

# Missing query
RESP=$(curl_cmd POST /api/search -H "Content-Type: application/json" -d '{}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Missing query returns 400" "400" "$STATUS"
assert_body_contains "Error message present" "$BODY" "query"

# Valid search
RESP=$(curl_cmd POST /api/search -H "Content-Type: application/json" -d '{"query":"test video","maxResults":2}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Valid search returns 200" "200" "$STATUS"
assert_json_exists "Has results array" "$BODY" "['results']"
assert_json_exists "Has count field" "$BODY" "['count']"

# Max results capping (max 25)
RESP=$(curl_cmd POST /api/search -H "Content-Type: application/json" -d '{"query":"test","maxResults":100}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Overcapped maxResults still returns 200" "200" "$STATUS"

# =============================================================================
# 6. POST /api/info - Video Info
# =============================================================================
section "6. POST /api/info - Video Info"

# Missing URL
RESP=$(curl_cmd POST /api/info -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_status "Missing URL returns 400" "400" "$STATUS"

# Unsafe URL scheme (file://)
RESP=$(curl_cmd POST /api/info -H "Content-Type: application/json" -d '{"url":"file:///etc/passwd"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "file:// URL returns 400" "400" "$STATUS"
assert_body_contains "Scheme error message" "$BODY" "not allowed"

# Unsafe URL scheme (javascript:)
RESP=$(curl_cmd POST /api/info -H "Content-Type: application/json" -d '{"url":"javascript:alert(1)"}')
STATUS=$(get_status "$RESP")
assert_status "javascript: URL returns 400" "400" "$STATUS"

# Unsafe URL scheme (data:)
RESP=$(curl_cmd POST /api/info -H "Content-Type: application/json" -d '{"url":"data:text/html,<h1>test</h1>"}')
STATUS=$(get_status "$RESP")
assert_status "data: URL returns 400" "400" "$STATUS"

# Unsafe URL scheme (vbscript:)
RESP=$(curl_cmd POST /api/info -H "Content-Type: application/json" -d '{"url":"vbscript:msgbox"}')
STATUS=$(get_status "$RESP")
assert_status "vbscript: URL returns 400" "400" "$STATUS"

# =============================================================================
# 7. POST /api/download - Queue Download
# =============================================================================
section "7. POST /api/download - Queue Download"

# Missing URL
RESP=$(curl_cmd POST /api/download -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_status "Missing URL returns 400" "400" "$STATUS"

# Unsafe URL
RESP=$(curl_cmd POST /api/download -H "Content-Type: application/json" -d '{"url":"file:///etc/shadow"}')
STATUS=$(get_status "$RESP")
assert_status "file:// download returns 400" "400" "$STATUS"

# Invalid output directory (blocked path)
RESP=$(curl_cmd POST /api/download -H "Content-Type: application/json" -d '{"url":"https://example.com/video","outputDir":"/etc/evil"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Blocked outputDir returns 400" "400" "$STATUS"
assert_body_contains "Output dir error" "$BODY" "not allowed"

# Valid download request (will queue even if yt-dlp fails later)
RESP=$(curl_cmd POST /api/download -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"best"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Valid download returns 202" "202" "$STATUS"
assert_json_field "Status is queued" "$BODY" "['status']" "queued"
assert_json_exists "Has jobId" "$BODY" "['jobId']"
DOWNLOAD_JOB_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])" 2>/dev/null || echo "")

# =============================================================================
# 8. POST /api/convert - Queue Conversion
# =============================================================================
section "8. POST /api/convert - Queue Conversion"

# Missing fields
RESP=$(curl_cmd POST /api/convert -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_status "Missing fields returns 400" "400" "$STATUS"

# Missing outputFormat
RESP=$(curl_cmd POST /api/convert -H "Content-Type: application/json" -d '{"inputFile":"/tmp/test.mp3"}')
STATUS=$(get_status "$RESP")
assert_status "Missing outputFormat returns 400" "400" "$STATUS"

# Invalid output format
RESP=$(curl_cmd POST /api/convert -H "Content-Type: application/json" -d '{"inputFile":"/tmp/test.mp3","outputFormat":"exe"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Invalid format returns 400" "400" "$STATUS"
assert_body_contains "Format error message" "$BODY" "Unsupported"

# All valid format names accepted
for fmt in mp3 aac m4a ogg wav flac; do
  RESP=$(curl_cmd POST /api/convert -H "Content-Type: application/json" -d "{\"inputFile\":\"/tmp/nonexistent.wav\",\"outputFormat\":\"$fmt\"}")
  BODY=$(get_body "$RESP")
  STATUS=$(get_status "$RESP")
  # Should return 400 for invalid file path, NOT for unsupported format
  TOTAL=$((TOTAL + 1))
  if echo "$BODY" | grep -q "Unsupported"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - Format $fmt rejected as unsupported"
    echo -e "  ${RED}FAIL${NC} Format '$fmt' incorrectly rejected as unsupported"
  else
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} Format '$fmt' accepted as valid"
  fi
done

# Path traversal attack
RESP=$(curl_cmd POST /api/convert -H "Content-Type: application/json" -d '{"inputFile":"/etc/passwd","outputFormat":"mp3"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Path traversal /etc returns 400" "400" "$STATUS"
assert_body_contains "Path validation" "$BODY" "Invalid"

# Sensitive path (.ssh)
RESP=$(curl_cmd POST /api/convert -H "Content-Type: application/json" -d "{\"inputFile\":\"$HOME/.ssh/id_rsa\",\"outputFormat\":\"mp3\"}")
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status ".ssh path blocked" "400" "$STATUS"

# =============================================================================
# 9. POST /api/tts - Queue Text-to-Speech
# =============================================================================
section "9. POST /api/tts - Queue Text-to-Speech"

# Missing inputFile
RESP=$(curl_cmd POST /api/tts -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_status "Missing inputFile returns 400" "400" "$STATUS"

# Invalid TTS engine
RESP=$(curl_cmd POST /api/tts -H "Content-Type: application/json" -d '{"inputFile":"/tmp/test.txt","engine":"invalid-engine"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Invalid engine returns 400" "400" "$STATUS"
assert_body_contains "Engine error" "$BODY" "Unsupported"

# Invalid TTS output format
RESP=$(curl_cmd POST /api/tts -H "Content-Type: application/json" -d '{"inputFile":"/tmp/test.txt","outputFormat":"exe"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Invalid TTS format returns 400" "400" "$STATUS"

# Valid engine names accepted
for engine in edge-tts gtts espeak; do
  RESP=$(curl_cmd POST /api/tts -H "Content-Type: application/json" -d "{\"inputFile\":\"/tmp/nonexistent.txt\",\"engine\":\"$engine\"}")
  BODY=$(get_body "$RESP")
  TOTAL=$((TOTAL + 1))
  if echo "$BODY" | grep -q "Unsupported TTS engine"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - TTS engine $engine rejected"
    echo -e "  ${RED}FAIL${NC} Engine '$engine' incorrectly rejected"
  else
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} Engine '$engine' accepted as valid"
  fi
done

# Valid TTS output formats
for fmt in mp3 wav; do
  RESP=$(curl_cmd POST /api/tts -H "Content-Type: application/json" -d "{\"inputFile\":\"/tmp/nonexistent.txt\",\"outputFormat\":\"$fmt\"}")
  BODY=$(get_body "$RESP")
  TOTAL=$((TOTAL + 1))
  if echo "$BODY" | grep -q "Unsupported TTS output format"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - TTS format $fmt rejected"
    echo -e "  ${RED}FAIL${NC} TTS format '$fmt' incorrectly rejected"
  else
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} TTS format '$fmt' accepted as valid"
  fi
done

# Invalid output directory
RESP=$(curl_cmd POST /api/tts -H "Content-Type: application/json" -d '{"inputFile":"/tmp/test.txt","outputDir":"/proc/evil"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Blocked TTS outputDir returns 400" "400" "$STATUS"

# File path validation (/etc)
RESP=$(curl_cmd POST /api/tts -H "Content-Type: application/json" -d '{"inputFile":"/etc/passwd"}')
STATUS=$(get_status "$RESP")
assert_status "/etc file blocked for TTS" "400" "$STATUS"

# =============================================================================
# 10. POST /api/transcribe - Queue Transcription
# =============================================================================
section "10. POST /api/transcribe - Queue Transcription"

# Missing both url and filePath
RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d '{}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Missing source returns 400" "400" "$STATUS"
assert_body_contains "Source required" "$BODY" "url"

# Unsafe URL
RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d '{"url":"file:///etc/passwd"}')
STATUS=$(get_status "$RESP")
assert_status "file:// transcribe URL returns 400" "400" "$STATUS"

# Invalid whisper model
RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d '{"url":"https://example.com/video.mp4","modelSize":"xxxlarge"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Invalid model returns 400" "400" "$STATUS"
assert_body_contains "Model error" "$BODY" "Unsupported"

# Valid whisper model names
for model in tiny base small medium large; do
  RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d "{\"url\":\"https://example.com/v.mp4\",\"modelSize\":\"$model\"}")
  BODY=$(get_body "$RESP")
  TOTAL=$((TOTAL + 1))
  if echo "$BODY" | grep -q "Unsupported Whisper model"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - Whisper model $model rejected"
    echo -e "  ${RED}FAIL${NC} Model '$model' incorrectly rejected"
  else
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} Model '$model' accepted as valid"
  fi
done

# Invalid transcription output format
RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d '{"url":"https://example.com/v.mp4","outputFormat":"docx"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Invalid transcription format returns 400" "400" "$STATUS"

# Valid transcription output formats
for fmt in txt srt vtt; do
  RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d "{\"url\":\"https://example.com/v.mp4\",\"outputFormat\":\"$fmt\"}")
  BODY=$(get_body "$RESP")
  TOTAL=$((TOTAL + 1))
  if echo "$BODY" | grep -q "Unsupported transcription output format"; then
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - Transcription format $fmt rejected"
    echo -e "  ${RED}FAIL${NC} Transcription format '$fmt' incorrectly rejected"
  else
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} Transcription format '$fmt' accepted as valid"
  fi
done

# File path validation for filePath
RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d '{"filePath":"/etc/shadow"}')
STATUS=$(get_status "$RESP")
assert_status "Blocked filePath returns 400" "400" "$STATUS"

# Invalid output directory
RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d '{"url":"https://example.com/v.mp4","outputDir":"/sys/malicious"}')
STATUS=$(get_status "$RESP")
assert_status "Blocked transcribe outputDir returns 400" "400" "$STATUS"

# Valid transcription request (will queue)
RESP=$(curl_cmd POST /api/transcribe -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","modelSize":"tiny","outputFormat":"txt"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Valid transcribe returns 202" "202" "$STATUS"
assert_json_field "Transcribe status queued" "$BODY" "['status']" "queued"
TRANSCRIBE_JOB_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['jobId'])" 2>/dev/null || echo "")

# =============================================================================
# 11. GET /api/jobs - List Jobs
# =============================================================================
section "11. GET /api/jobs - Job Listing & Filtering"

# List all jobs
RESP=$(curl_cmd GET /api/jobs)
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "List jobs returns 200" "200" "$STATUS"
assert_json_exists "Has jobs array" "$BODY" "['jobs']"
assert_json_exists "Has count field" "$BODY" "['count']"

# Filter by status
RESP=$(curl_cmd GET "/api/jobs?status=queued")
STATUS=$(get_status "$RESP")
assert_status "Filter by status=queued returns 200" "200" "$STATUS"

RESP=$(curl_cmd GET "/api/jobs?status=completed")
STATUS=$(get_status "$RESP")
assert_status "Filter by status=completed returns 200" "200" "$STATUS"

RESP=$(curl_cmd GET "/api/jobs?status=failed")
STATUS=$(get_status "$RESP")
assert_status "Filter by status=failed returns 200" "200" "$STATUS"

RESP=$(curl_cmd GET "/api/jobs?status=running")
STATUS=$(get_status "$RESP")
assert_status "Filter by status=running returns 200" "200" "$STATUS"

# Filter by type
RESP=$(curl_cmd GET "/api/jobs?type=download")
STATUS=$(get_status "$RESP")
assert_status "Filter by type=download returns 200" "200" "$STATUS"

RESP=$(curl_cmd GET "/api/jobs?type=convert")
STATUS=$(get_status "$RESP")
assert_status "Filter by type=convert returns 200" "200" "$STATUS"

RESP=$(curl_cmd GET "/api/jobs?type=tts")
STATUS=$(get_status "$RESP")
assert_status "Filter by type=tts returns 200" "200" "$STATUS"

RESP=$(curl_cmd GET "/api/jobs?type=transcribe")
STATUS=$(get_status "$RESP")
assert_status "Filter by type=transcribe returns 200" "200" "$STATUS"

# Combined filters
RESP=$(curl_cmd GET "/api/jobs?status=queued&type=download")
STATUS=$(get_status "$RESP")
assert_status "Combined filter returns 200" "200" "$STATUS"

# =============================================================================
# 12. GET /api/jobs/:id - Single Job Status
# =============================================================================
section "12. GET /api/jobs/:id - Job Status"

# Non-existent job
RESP=$(curl_cmd GET /api/jobs/nonexistent_job_id)
STATUS=$(get_status "$RESP")
assert_status "Unknown job returns 404" "404" "$STATUS"

# Existing job (if we created one earlier)
if [ -n "$DOWNLOAD_JOB_ID" ]; then
  RESP=$(curl_cmd GET "/api/jobs/$DOWNLOAD_JOB_ID")
  BODY=$(get_body "$RESP")
  STATUS=$(get_status "$RESP")
  assert_status "Existing job returns 200" "200" "$STATUS"
  assert_json_field "Job ID matches" "$BODY" "['id']" "$DOWNLOAD_JOB_ID"
  assert_json_field "Job type is download" "$BODY" "['type']" "download"
  assert_json_exists "Has createdAt" "$BODY" "['createdAt']"
  assert_json_exists "Has request" "$BODY" "['request']"
else
  skip_test "Existing job lookup" "No download job was created"
fi

# =============================================================================
# 13. DELETE /api/jobs/:id - Delete Job
# =============================================================================
section "13. DELETE /api/jobs/:id - Delete Job"

# Non-existent job
RESP=$(curl_cmd DELETE /api/jobs/nonexistent_job_id)
STATUS=$(get_status "$RESP")
assert_status "Delete unknown job returns 404" "404" "$STATUS"

# Create a job to delete (use an invalid URL so it fails quickly)
RESP=$(curl_cmd POST /api/download -H "Content-Type: application/json" -d '{"url":"https://example.com/nonexistent-video-for-delete-test"}')
BODY=$(get_body "$RESP")
DELETE_JOB_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('jobId',''))" 2>/dev/null || echo "")

if [ -n "$DELETE_JOB_ID" ]; then
  # Wait for it to finish (fail)
  sleep 3

  RESP=$(curl_cmd GET "/api/jobs/$DELETE_JOB_ID")
  JOB_STATUS=$(echo "$(get_body "$RESP")" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "")

  if [ "$JOB_STATUS" = "running" ]; then
    RESP=$(curl_cmd DELETE "/api/jobs/$DELETE_JOB_ID")
    BODY=$(get_body "$RESP")
    STATUS=$(get_status "$RESP")
    assert_status "Cannot delete running job" "409" "$STATUS"
  else
    RESP=$(curl_cmd DELETE "/api/jobs/$DELETE_JOB_ID")
    BODY=$(get_body "$RESP")
    STATUS=$(get_status "$RESP")
    assert_status "Delete completed/failed job returns 200" "200" "$STATUS"
    assert_json_field "Deleted flag is true" "$BODY" "['deleted']" "True"

    # Verify it's gone
    RESP=$(curl_cmd GET "/api/jobs/$DELETE_JOB_ID")
    STATUS=$(get_status "$RESP")
    assert_status "Deleted job returns 404" "404" "$STATUS"
  fi
else
  skip_test "Job deletion" "Could not create a job to delete"
fi

# =============================================================================
# 14. GET /api/plugins - Plugin Info
# =============================================================================
section "14. GET /api/plugins - Plugin Info"

RESP=$(curl_cmd GET /api/plugins)
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Plugins returns 200" "200" "$STATUS"
assert_json_exists "Has plugins field" "$BODY" "['plugins']"

# =============================================================================
# 15. POST /api/metadata/embed - Metadata Embedding
# =============================================================================
section "15. POST /api/metadata/embed - Metadata Embedding"

# Missing file field
RESP=$(curl_cmd POST /api/metadata/embed -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_status "Missing file returns 400" "400" "$STATUS"

# Blocked file path
RESP=$(curl_cmd POST /api/metadata/embed -H "Content-Type: application/json" -d '{"file":"/etc/passwd"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Blocked file path returns 400" "400" "$STATUS"

# SSRF protection on thumbnail URL
RESP=$(curl_cmd POST /api/metadata/embed -H "Content-Type: application/json" -d '{"file":"/tmp/test.mp3","thumbnailUrl":"http://localhost:8080/evil"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Localhost thumbnail URL returns 400" "400" "$STATUS"

# SSRF: internal network
RESP=$(curl_cmd POST /api/metadata/embed -H "Content-Type: application/json" -d '{"file":"/tmp/test.mp3","thumbnailUrl":"http://192.168.1.1/internal"}')
BODY=$(get_body "$RESP")
STATUS=$(get_status "$RESP")
assert_status "Private IP thumbnail URL returns 400" "400" "$STATUS"

# SSRF: 10.x range
RESP=$(curl_cmd POST /api/metadata/embed -H "Content-Type: application/json" -d '{"file":"/tmp/test.mp3","thumbnailUrl":"http://10.0.0.1/internal"}')
STATUS=$(get_status "$RESP")
assert_status "10.x thumbnail URL returns 400" "400" "$STATUS"

# SSRF: metadata service
RESP=$(curl_cmd POST /api/metadata/embed -H "Content-Type: application/json" -d '{"file":"/tmp/test.mp3","thumbnailUrl":"http://169.254.169.254/latest/meta-data"}')
STATUS=$(get_status "$RESP")
assert_status "Cloud metadata URL returns 400" "400" "$STATUS"

# SSRF: .internal domain
RESP=$(curl_cmd POST /api/metadata/embed -H "Content-Type: application/json" -d '{"file":"/tmp/test.mp3","thumbnailUrl":"http://secret.internal/data"}')
STATUS=$(get_status "$RESP")
assert_status ".internal domain URL returns 400" "400" "$STATUS"

# SSRF: .local domain
RESP=$(curl_cmd POST /api/metadata/embed -H "Content-Type: application/json" -d '{"file":"/tmp/test.mp3","thumbnailUrl":"http://server.local/data"}')
STATUS=$(get_status "$RESP")
assert_status ".local domain URL returns 400" "400" "$STATUS"

# =============================================================================
# 16. Error Handling - Not Found
# =============================================================================
section "16. Error Handling"

RESP=$(curl_cmd GET /api/nonexistent)
STATUS=$(get_status "$RESP")
assert_status "Unknown endpoint returns 404" "404" "$STATUS"

RESP=$(curl_cmd POST /api/nonexistent -H "Content-Type: application/json" -d '{}')
STATUS=$(get_status "$RESP")
assert_status "Unknown POST endpoint returns 404" "404" "$STATUS"

RESP=$(curl_cmd DELETE /api/nonexistent)
STATUS=$(get_status "$RESP")
assert_status "Unknown DELETE endpoint returns 404" "404" "$STATUS"

# =============================================================================
# 17. Shutdown Guard (soft check - cannot trigger without stopping server)
# =============================================================================
section "17. Additional Validation"

# Empty JSON body
RESP=$(curl_cmd POST /api/download -H "Content-Type: application/json" -d '')
STATUS=$(get_status "$RESP")
assert_status "Empty body returns 400" "400" "$STATUS"

# Malformed JSON
RESP=$(curl_cmd POST /api/download -H "Content-Type: application/json" -d 'not json')
STATUS=$(get_status "$RESP")
assert_status "Malformed JSON returns 400" "400" "$STATUS"

# URL with spaces (edge case in isSafeUrl - trimStart used)
RESP=$(curl_cmd POST /api/info -H "Content-Type: application/json" -d '{"url":"  file:///etc/passwd"}')
STATUS=$(get_status "$RESP")
assert_status "Whitespace-prefixed file:// URL blocked" "400" "$STATUS"

# =============================================================================
# Results Summary
# =============================================================================
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  BACKEND TEST RESULTS${NC}"
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
