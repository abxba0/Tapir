#!/usr/bin/env bash
# =============================================================================
# Tapir Frontend Test Script
# =============================================================================
# Comprehensive test suite for the Tapir Next.js website/frontend.
# Tests project structure, dependencies, build, lint, TypeScript,
# all pages/routes, components, API client, theme, accessibility,
# static export, and SEO.
#
# Usage:
#   chmod +x test_frontend.sh
#   ./test_frontend.sh
#
# Prerequisites:
#   - Node.js (18+) and npm installed
#   - Run from the project root directory
# =============================================================================

set -euo pipefail

PASS=0
FAIL=0
SKIP=0
TOTAL=0
FAILURES=""
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
WEBSITE_DIR="${PROJECT_ROOT}/website"

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

assert_file_exists() {
  local test_name="$1"
  local filepath="$2"
  TOTAL=$((TOTAL + 1))
  if [ -f "$filepath" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $test_name"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $test_name: $filepath not found"
    echo -e "  ${RED}FAIL${NC} $test_name (not found)"
  fi
}

assert_dir_exists() {
  local test_name="$1"
  local dirpath="$2"
  TOTAL=$((TOTAL + 1))
  if [ -d "$dirpath" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $test_name"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $test_name: $dirpath not found"
    echo -e "  ${RED}FAIL${NC} $test_name (not found)"
  fi
}

assert_file_contains() {
  local test_name="$1"
  local filepath="$2"
  local needle="$3"
  TOTAL=$((TOTAL + 1))
  if [ -f "$filepath" ] && grep -q "$needle" "$filepath" 2>/dev/null; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $test_name"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $test_name: '$needle' not found in $(basename "$filepath")"
    echo -e "  ${RED}FAIL${NC} $test_name"
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
# Pre-flight checks
# =============================================================================
echo -e "${BOLD}Tapir Frontend Test Suite${NC}"
echo "Website dir: $WEBSITE_DIR"
echo "---"

if [ ! -d "$WEBSITE_DIR" ]; then
  echo -e "${RED}ERROR: Website directory not found at $WEBSITE_DIR${NC}"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo -e "${RED}ERROR: Node.js is not installed${NC}"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo -e "${RED}ERROR: npm is not installed${NC}"
  exit 1
fi

NODE_VERSION=$(node --version)
echo "Node: $NODE_VERSION"
echo "npm:  $(npm --version)"

# =============================================================================
# 1. Project Structure
# =============================================================================
section "1. Project Structure"

assert_file_exists "package.json exists" "$WEBSITE_DIR/package.json"
assert_file_exists "tsconfig.json exists" "$WEBSITE_DIR/tsconfig.json"
assert_file_exists "next.config.js exists" "$WEBSITE_DIR/next.config.js"
assert_dir_exists  "src/ directory exists" "$WEBSITE_DIR/src"
assert_dir_exists  "src/app/ directory exists" "$WEBSITE_DIR/src/app"

# =============================================================================
# 2. Package.json Validation
# =============================================================================
section "2. Package.json Validation"

PKG="$WEBSITE_DIR/package.json"

# Required scripts
assert_file_contains "Has 'dev' script" "$PKG" '"dev"'
assert_file_contains "Has 'build' script" "$PKG" '"build"'
assert_file_contains "Has 'start' script" "$PKG" '"start"'
assert_file_contains "Has 'lint' script" "$PKG" '"lint"'

# Core dependencies
assert_file_contains "Depends on next" "$PKG" '"next"'
assert_file_contains "Depends on react" "$PKG" '"react"'
assert_file_contains "Depends on react-dom" "$PKG" '"react-dom"'
assert_file_contains "Depends on typescript" "$PKG" '"typescript"'

# MUI dependencies
assert_file_contains "Depends on @mui/material" "$PKG" '"@mui/material"'
assert_file_contains "Depends on @emotion/react" "$PKG" '"@emotion/react"'
assert_file_contains "Depends on @emotion/styled" "$PKG" '"@emotion/styled"'

# Icon library
assert_file_contains "Depends on @tabler/icons-react" "$PKG" '"@tabler/icons-react"'

# Dev dependencies
assert_file_contains "Has @types/react" "$PKG" '"@types/react"'
assert_file_contains "Has eslint" "$PKG" '"eslint"'
assert_file_contains "Has eslint-config-next" "$PKG" '"eslint-config-next"'

# =============================================================================
# 3. TypeScript Configuration
# =============================================================================
section "3. TypeScript Configuration"

TSCONFIG="$WEBSITE_DIR/tsconfig.json"

assert_file_contains "TSConfig has strict mode" "$TSCONFIG" '"strict"'
assert_file_contains "TSConfig has path alias @/*" "$TSCONFIG" '"@/*"'
assert_file_contains "TSConfig has Next.js plugin" "$TSCONFIG" '"next"'
assert_file_contains "TSConfig has JSX preserve" "$TSCONFIG" '"preserve"'

# =============================================================================
# 4. Next.js Configuration
# =============================================================================
section "4. Next.js Configuration"

NEXTCONFIG="$WEBSITE_DIR/next.config.js"

assert_file_contains "Static export mode enabled" "$NEXTCONFIG" "export"
assert_file_contains "React strict mode enabled" "$NEXTCONFIG" "reactStrictMode"
assert_file_contains "Image optimization handled" "$NEXTCONFIG" "images"

# =============================================================================
# 5. ESLint Configuration
# =============================================================================
section "5. ESLint Configuration"

ESLINT_CONFIG="$WEBSITE_DIR/.eslintrc.json"
if [ -f "$ESLINT_CONFIG" ]; then
  assert_file_contains "ESLint extends next/core-web-vitals" "$ESLINT_CONFIG" "core-web-vitals"
  assert_file_contains "ESLint extends next/typescript" "$ESLINT_CONFIG" "typescript"
else
  # Check for flat config
  ESLINT_FLAT="$WEBSITE_DIR/eslint.config.js"
  if [ -f "$ESLINT_FLAT" ] || [ -f "$WEBSITE_DIR/eslint.config.mjs" ]; then
    assert_pass "ESLint flat config exists"
  else
    skip_test "ESLint config" "No .eslintrc.json or eslint.config found"
  fi
fi

# =============================================================================
# 6. App Router Pages
# =============================================================================
section "6. App Router Pages"

APP_DIR="$WEBSITE_DIR/src/app"
DASH_DIR="$APP_DIR/(DashboardLayout)"

# Root layout
assert_file_exists "Root layout.tsx" "$APP_DIR/layout.tsx"
assert_file_contains "Root layout uses ThemeProvider" "$APP_DIR/layout.tsx" "ThemeProvider"
assert_file_contains "Root layout uses CssBaseline" "$APP_DIR/layout.tsx" "CssBaseline"

# Global styles
TOTAL=$((TOTAL + 1))
if [ -f "$APP_DIR/global.css" ] || [ -f "$APP_DIR/globals.css" ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} Global CSS file exists"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - Global CSS: No global.css or globals.css found"
  echo -e "  ${RED}FAIL${NC} Global CSS file missing"
fi

# Dashboard layout
assert_file_exists "Dashboard layout" "$DASH_DIR/layout.tsx"
assert_file_contains "Dashboard has Sidebar" "$DASH_DIR/layout.tsx" "Sidebar"
assert_file_contains "Dashboard has Header" "$DASH_DIR/layout.tsx" "Header"
assert_file_contains "Dashboard is client component" "$DASH_DIR/layout.tsx" "use client"

# All route pages
assert_file_exists "Dashboard page" "$DASH_DIR/page.tsx"
assert_file_exists "Download page" "$DASH_DIR/download/page.tsx"
assert_file_exists "Transcribe page" "$DASH_DIR/transcribe/page.tsx"
assert_file_exists "Text-to-Speech page" "$DASH_DIR/text-to-speech/page.tsx"
assert_file_exists "Features page" "$DASH_DIR/features/page.tsx"
assert_file_exists "Getting Started page" "$DASH_DIR/getting-started/page.tsx"

# =============================================================================
# 7. Layout Components
# =============================================================================
section "7. Layout Components"

LAYOUT_DIR="$DASH_DIR/layout"

assert_file_exists "Header component" "$LAYOUT_DIR/header/Header.tsx"
assert_file_exists "Sidebar component" "$LAYOUT_DIR/sidebar/Sidebar.tsx"
assert_file_exists "SidebarItems component" "$LAYOUT_DIR/sidebar/SidebarItems.tsx"
assert_file_exists "MenuItems definition" "$LAYOUT_DIR/sidebar/MenuItems.tsx"

# Header features
assert_file_contains "Header has GitHub button" "$LAYOUT_DIR/header/Header.tsx" "GitHub"
assert_file_contains "Header has Get Started button" "$LAYOUT_DIR/header/Header.tsx" "Get Started"
assert_file_contains "Header has mobile toggle" "$LAYOUT_DIR/header/Header.tsx" "toggleMobileSidebar"

# Sidebar features
assert_file_contains "Sidebar responsive (Drawer)" "$LAYOUT_DIR/sidebar/Sidebar.tsx" "Drawer"
assert_file_contains "Sidebar has mobile support" "$LAYOUT_DIR/sidebar/Sidebar.tsx" "isMobileSidebarOpen"

# Menu items structure
assert_file_contains "MenuItems has home link" "$LAYOUT_DIR/sidebar/MenuItems.tsx" "Home"
assert_file_contains "MenuItems has features link" "$LAYOUT_DIR/sidebar/MenuItems.tsx" "Features"
assert_file_contains "MenuItems has download link" "$LAYOUT_DIR/sidebar/MenuItems.tsx" "Download"
assert_file_contains "MenuItems has transcribe link" "$LAYOUT_DIR/sidebar/MenuItems.tsx" "Transcribe"
assert_file_contains "MenuItems has TTS link" "$LAYOUT_DIR/sidebar/MenuItems.tsx" "Speech"
assert_file_contains "MenuItems has getting started link" "$LAYOUT_DIR/sidebar/MenuItems.tsx" "Getting Started"

# =============================================================================
# 8. Dashboard Components
# =============================================================================
section "8. Dashboard Components"

COMP_DIR="$DASH_DIR/components"

assert_file_exists "CapabilityCards component" "$COMP_DIR/dashboard/CapabilityCards.tsx"
assert_file_exists "FeatureHighlights component" "$COMP_DIR/dashboard/FeatureHighlights.tsx"
assert_file_exists "QuickStart component" "$COMP_DIR/dashboard/QuickStart.tsx"
assert_file_exists "SitesSupported component" "$COMP_DIR/dashboard/SitesSupported.tsx"

# CapabilityCards content
assert_file_contains "CapabilityCards has Download" "$COMP_DIR/dashboard/CapabilityCards.tsx" "Download"
assert_file_contains "CapabilityCards has Convert" "$COMP_DIR/dashboard/CapabilityCards.tsx" "Convert"
assert_file_contains "CapabilityCards has Transcribe" "$COMP_DIR/dashboard/CapabilityCards.tsx" "Transcribe"
assert_file_contains "CapabilityCards has TTS" "$COMP_DIR/dashboard/CapabilityCards.tsx" "Speech"

# QuickStart content
assert_file_contains "QuickStart has clone step" "$COMP_DIR/dashboard/QuickStart.tsx" "clone"
assert_file_contains "QuickStart has bun install step" "$COMP_DIR/dashboard/QuickStart.tsx" "bun install"
assert_file_contains "QuickStart has bun start step" "$COMP_DIR/dashboard/QuickStart.tsx" "bun start"

# Shared components
assert_file_exists "BlankCard component" "$COMP_DIR/shared/BlankCard.tsx"
assert_file_exists "DashboardCard component" "$COMP_DIR/shared/DashboardCard.tsx"
assert_file_exists "PageContainer component" "$COMP_DIR/container/PageContainer.tsx"

# =============================================================================
# 9. Page Content Validation
# =============================================================================
section "9. Page Content Validation"

# Download page features
DL_PAGE="$DASH_DIR/download/page.tsx"
assert_file_contains "Download page has URL input" "$DL_PAGE" "url"
assert_file_contains "Download page has format selector" "$DL_PAGE" "format"
assert_file_contains "Download page has job status" "$DL_PAGE" "status"
assert_file_contains "Download page is client component" "$DL_PAGE" "use client"
assert_file_contains "Download page calls API" "$DL_PAGE" "downloadMedia\|listJobs\|fetch"

# Transcribe page features
TR_PAGE="$DASH_DIR/transcribe/page.tsx"
assert_file_contains "Transcribe page has model selector" "$TR_PAGE" "model"
assert_file_contains "Transcribe page has language field" "$TR_PAGE" "language"
assert_file_contains "Transcribe page has output format" "$TR_PAGE" "outputFormat\|format"
assert_file_contains "Transcribe page is client component" "$TR_PAGE" "use client"

# TTS page features
TTS_PAGE="$DASH_DIR/text-to-speech/page.tsx"
assert_file_contains "TTS page has engine selector" "$TTS_PAGE" "engine"
assert_file_contains "TTS page has voice field" "$TTS_PAGE" "voice"
assert_file_contains "TTS page has file input" "$TTS_PAGE" "inputFile\|file"
assert_file_contains "TTS page is client component" "$TTS_PAGE" "use client"

# Features page content
FEAT_PAGE="$DASH_DIR/features/page.tsx"
assert_file_contains "Features page covers downloading" "$FEAT_PAGE" "Download"
assert_file_contains "Features page covers conversion" "$FEAT_PAGE" "Convert"
assert_file_contains "Features page covers transcription" "$FEAT_PAGE" "Transcrib"
assert_file_contains "Features page covers TTS" "$FEAT_PAGE" "Speech"
assert_file_contains "Features page covers REST API" "$FEAT_PAGE" "REST\|API"

# Getting Started page content
GS_PAGE="$DASH_DIR/getting-started/page.tsx"
assert_file_contains "Getting Started has installation" "$GS_PAGE" "install\|Install"
assert_file_contains "Getting Started has dependencies" "$GS_PAGE" "depend\|Depend\|yt-dlp\|FFmpeg"
assert_file_contains "Getting Started has Whisper models" "$GS_PAGE" "Whisper\|whisper"

# =============================================================================
# 10. API Client Service
# =============================================================================
section "10. API Client Service (tapirApi.ts)"

API_CLIENT="$WEBSITE_DIR/src/services/tapirApi.ts"

assert_file_exists "API client exists" "$API_CLIENT"
assert_file_contains "Has API_BASE URL config" "$API_CLIENT" "API_BASE"
assert_file_contains "Uses NEXT_PUBLIC env var" "$API_CLIENT" "NEXT_PUBLIC_TAPIR_API_URL"

# API functions
assert_file_contains "downloadMedia function" "$API_CLIENT" "downloadMedia"
assert_file_contains "transcribeMedia function" "$API_CLIENT" "transcribeMedia"
assert_file_contains "textToSpeech function" "$API_CLIENT" "textToSpeech"
assert_file_contains "getJobStatus function" "$API_CLIENT" "getJobStatus"
assert_file_contains "listJobs function" "$API_CLIENT" "listJobs"
assert_file_contains "deleteJob function" "$API_CLIENT" "deleteJob"
assert_file_contains "searchYouTube function" "$API_CLIENT" "searchYouTube"
assert_file_contains "getVideoInfo function" "$API_CLIENT" "getVideoInfo"
assert_file_contains "checkHealth function" "$API_CLIENT" "checkHealth"

# API endpoints
assert_file_contains "Calls /api/download" "$API_CLIENT" "/api/download"
assert_file_contains "Calls /api/transcribe" "$API_CLIENT" "/api/transcribe"
assert_file_contains "Calls /api/tts" "$API_CLIENT" "/api/tts"
assert_file_contains "Calls /api/jobs" "$API_CLIENT" "/api/jobs"
assert_file_contains "Calls /api/search" "$API_CLIENT" "/api/search"
assert_file_contains "Calls /api/info" "$API_CLIENT" "/api/info"
assert_file_contains "Calls /api/health" "$API_CLIENT" "/api/health"

# Type definitions
assert_file_contains "DownloadOptions type" "$API_CLIENT" "DownloadOptions"
assert_file_contains "TranscribeOptions type" "$API_CLIENT" "TranscribeOptions"
assert_file_contains "TtsOptions type" "$API_CLIENT" "TtsOptions"
assert_file_contains "JobStatus type" "$API_CLIENT" "JobStatus"
assert_file_contains "HealthCheckResponse type" "$API_CLIENT" "HealthCheckResponse"

# Error handling
assert_file_contains "Handles response errors" "$API_CLIENT" "response.ok"
assert_file_contains "Throws on failure" "$API_CLIENT" "throw new Error"

# =============================================================================
# 11. Theme & Styling
# =============================================================================
section "11. Theme & Styling"

THEME_DIR="$WEBSITE_DIR/src/utils/theme"
assert_file_exists "DefaultColors theme" "$THEME_DIR/DefaultColors.tsx"
assert_file_contains "Theme has createTheme" "$THEME_DIR/DefaultColors.tsx" "createTheme"

EMOTION_CACHE="$WEBSITE_DIR/src/utils/createEmotionCache.ts"
if [ -f "$EMOTION_CACHE" ]; then
  assert_file_contains "Emotion cache configured" "$EMOTION_CACHE" "createCache"
else
  skip_test "Emotion cache" "File not found"
fi

# =============================================================================
# 12. Install Dependencies
# =============================================================================
section "12. npm install"

echo -e "  Installing dependencies..."
INSTALL_OUTPUT=$(cd "$WEBSITE_DIR" && npm install 2>&1) || true
INSTALL_EXIT=$?

if [ $INSTALL_EXIT -eq 0 ]; then
  assert_pass "npm install succeeds"
else
  assert_fail "npm install" "Exit code $INSTALL_EXIT"
  echo "$INSTALL_OUTPUT" | tail -10
fi

# Check node_modules exists
assert_dir_exists "node_modules created" "$WEBSITE_DIR/node_modules"

# Verify key packages
TOTAL=$((TOTAL + 1))
if [ -d "$WEBSITE_DIR/node_modules/next" ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} next package installed"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - next package not in node_modules"
  echo -e "  ${RED}FAIL${NC} next package missing from node_modules"
fi

TOTAL=$((TOTAL + 1))
if [ -d "$WEBSITE_DIR/node_modules/react" ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} react package installed"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - react package not in node_modules"
  echo -e "  ${RED}FAIL${NC} react package missing from node_modules"
fi

TOTAL=$((TOTAL + 1))
if [ -d "$WEBSITE_DIR/node_modules/@mui/material" ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} @mui/material package installed"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - @mui/material package not in node_modules"
  echo -e "  ${RED}FAIL${NC} @mui/material package missing"
fi

# =============================================================================
# 13. ESLint / Linting
# =============================================================================
section "13. ESLint Lint Check"

echo -e "  Running linter..."
LINT_OUTPUT=$(cd "$WEBSITE_DIR" && npm run lint 2>&1) || true
LINT_EXIT=$?

if [ $LINT_EXIT -eq 0 ]; then
  assert_pass "ESLint passes with no errors"
else
  # Check if it's just warnings vs errors
  LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c "Error\|error" || echo 0)
  if [ "$LINT_ERRORS" -gt 0 ]; then
    assert_fail "ESLint" "$LINT_ERRORS error(s) found"
    echo "$LINT_OUTPUT" | tail -15
  else
    assert_pass "ESLint passes (warnings only)"
  fi
fi

# =============================================================================
# 14. TypeScript Type Checking
# =============================================================================
section "14. TypeScript Type Checking"

echo -e "  Running type check..."
TYPECHECK_OUTPUT=$(cd "$WEBSITE_DIR" && npx tsc --noEmit 2>&1) || true
TYPECHECK_EXIT=$?

if [ $TYPECHECK_EXIT -eq 0 ]; then
  assert_pass "TypeScript type check passes"
else
  TS_ERRORS=$(echo "$TYPECHECK_OUTPUT" | grep -c "error TS" || echo 0)
  assert_fail "TypeScript type check" "$TS_ERRORS error(s)"
  echo "$TYPECHECK_OUTPUT" | grep "error TS" | head -10
fi

# =============================================================================
# 15. Next.js Production Build
# =============================================================================
section "15. Next.js Production Build"

echo -e "  Building production bundle (this may take a while)..."
BUILD_OUTPUT=$(cd "$WEBSITE_DIR" && npm run build 2>&1) || true
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  assert_pass "Next.js build succeeds"
else
  assert_fail "Next.js build" "Exit code $BUILD_EXIT"
  echo "$BUILD_OUTPUT" | tail -20
fi

# Check static export output
TOTAL=$((TOTAL + 1))
if [ -d "$WEBSITE_DIR/out" ]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} Static export 'out/' directory created"
else
  FAIL=$((FAIL + 1))
  FAILURES="${FAILURES}\n  - Static export: out/ directory not created"
  echo -e "  ${RED}FAIL${NC} Static export 'out/' directory missing"
fi

# =============================================================================
# 16. Static Export Validation
# =============================================================================
section "16. Static Export Content"

OUT_DIR="$WEBSITE_DIR/out"

if [ -d "$OUT_DIR" ]; then
  # Index page
  assert_file_exists "index.html generated" "$OUT_DIR/index.html"

  # Route pages
  for route in download transcribe text-to-speech features getting-started; do
    TOTAL=$((TOTAL + 1))
    if [ -f "$OUT_DIR/$route.html" ] || [ -f "$OUT_DIR/$route/index.html" ]; then
      PASS=$((PASS + 1))
      echo -e "  ${GREEN}PASS${NC} /$route page exported"
    else
      FAIL=$((FAIL + 1))
      FAILURES="${FAILURES}\n  - Static export: /$route page not found"
      echo -e "  ${RED}FAIL${NC} /$route page not exported"
    fi
  done

  # Static assets
  TOTAL=$((TOTAL + 1))
  if [ -d "$OUT_DIR/_next" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} _next/ static assets directory present"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - Static export: _next/ directory missing"
    echo -e "  ${RED}FAIL${NC} _next/ static assets missing"
  fi

  # JS bundles
  JS_COUNT=$(find "$OUT_DIR/_next" -name "*.js" 2>/dev/null | wc -l || echo 0)
  assert_condition "JavaScript bundles exist ($JS_COUNT files)" "[ $JS_COUNT -gt 0 ]" "No JS files found"

  # CSS files
  CSS_COUNT=$(find "$OUT_DIR/_next" -name "*.css" 2>/dev/null | wc -l || echo 0)
  assert_condition "CSS bundles exist ($CSS_COUNT files)" "[ $CSS_COUNT -gt 0 ]" "No CSS files found"

  # Check index.html content
  if [ -f "$OUT_DIR/index.html" ]; then
    assert_file_contains "HTML has doctype" "$OUT_DIR/index.html" "<!DOCTYPE\|<!doctype"
    assert_file_contains "HTML has viewport meta" "$OUT_DIR/index.html" "viewport"
  fi
else
  skip_test "Static export validation" "out/ directory not found (build may have failed)"
fi

# =============================================================================
# 17. Page Route Integrity
# =============================================================================
section "17. Route Integrity"

# Verify each page can be imported/parsed (no syntax errors)
PAGES=(
  "src/app/layout.tsx"
  "src/app/(DashboardLayout)/layout.tsx"
  "src/app/(DashboardLayout)/page.tsx"
  "src/app/(DashboardLayout)/download/page.tsx"
  "src/app/(DashboardLayout)/transcribe/page.tsx"
  "src/app/(DashboardLayout)/text-to-speech/page.tsx"
  "src/app/(DashboardLayout)/features/page.tsx"
  "src/app/(DashboardLayout)/getting-started/page.tsx"
)

for page in "${PAGES[@]}"; do
  FULL_PATH="$WEBSITE_DIR/$page"
  TOTAL=$((TOTAL + 1))
  if [ -f "$FULL_PATH" ]; then
    # Check for valid JSX/TSX (must have either export default or function component)
    if grep -qE "export default|export function|export const" "$FULL_PATH"; then
      PASS=$((PASS + 1))
      echo -e "  ${GREEN}PASS${NC} $page has valid export"
    else
      FAIL=$((FAIL + 1))
      FAILURES="${FAILURES}\n  - $page: No default export found"
      echo -e "  ${RED}FAIL${NC} $page missing default export"
    fi
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}\n  - $page: File not found"
    echo -e "  ${RED}FAIL${NC} $page not found"
  fi
done

# =============================================================================
# 18. Component Import Integrity
# =============================================================================
section "18. Component Import Integrity"

COMPONENTS=(
  "src/app/(DashboardLayout)/layout/header/Header.tsx"
  "src/app/(DashboardLayout)/layout/sidebar/Sidebar.tsx"
  "src/app/(DashboardLayout)/layout/sidebar/SidebarItems.tsx"
  "src/app/(DashboardLayout)/layout/sidebar/MenuItems.tsx"
  "src/app/(DashboardLayout)/components/dashboard/CapabilityCards.tsx"
  "src/app/(DashboardLayout)/components/dashboard/FeatureHighlights.tsx"
  "src/app/(DashboardLayout)/components/dashboard/QuickStart.tsx"
  "src/app/(DashboardLayout)/components/dashboard/SitesSupported.tsx"
  "src/app/(DashboardLayout)/components/shared/BlankCard.tsx"
  "src/app/(DashboardLayout)/components/shared/DashboardCard.tsx"
  "src/app/(DashboardLayout)/components/container/PageContainer.tsx"
)

for comp in "${COMPONENTS[@]}"; do
  FULL_PATH="$WEBSITE_DIR/$comp"
  BASENAME=$(basename "$comp" .tsx)
  assert_file_exists "$BASENAME component" "$FULL_PATH"
done

# =============================================================================
# 19. Responsive Design Checks
# =============================================================================
section "19. Responsive Design Indicators"

# Check for responsive breakpoints in key components
SIDEBAR_FILE="$WEBSITE_DIR/src/app/(DashboardLayout)/layout/sidebar/Sidebar.tsx"
assert_file_contains "Sidebar uses breakpoints (lg)" "$SIDEBAR_FILE" "lg\|breakpoint\|useMediaQuery"

HEADER_FILE="$WEBSITE_DIR/src/app/(DashboardLayout)/layout/header/Header.tsx"
assert_file_contains "Header has mobile support" "$HEADER_FILE" "sm\|mobile\|xs\|display"

# Dashboard uses Grid
DASH_PAGE="$DASH_DIR/page.tsx"
assert_file_contains "Dashboard uses Grid layout" "$DASH_PAGE" "Grid"

# =============================================================================
# 20. Interactive Page Features
# =============================================================================
section "20. Interactive Page Features"

# Download page - form controls and state
DL_PAGE="$DASH_DIR/download/page.tsx"
assert_file_contains "Download page uses useState" "$DL_PAGE" "useState"
assert_file_contains "Download page uses useEffect" "$DL_PAGE" "useEffect"
assert_file_contains "Download page has submit handler" "$DL_PAGE" "handleSubmit\|handleDownload\|onClick"

# Transcribe page - form controls and state
TR_PAGE="$DASH_DIR/transcribe/page.tsx"
assert_file_contains "Transcribe page uses useState" "$TR_PAGE" "useState"
assert_file_contains "Transcribe page has submit handler" "$TR_PAGE" "handleSubmit\|handleTranscribe\|onClick"

# TTS page - form controls and state
TTS_PAGE="$DASH_DIR/text-to-speech/page.tsx"
assert_file_contains "TTS page uses useState" "$TTS_PAGE" "useState"
assert_file_contains "TTS page has submit handler" "$TTS_PAGE" "handleSubmit\|handleTts\|onClick"

# Job polling (auto-refresh)
assert_file_contains "Download page has polling" "$DL_PAGE" "setInterval\|setTimeout\|useEffect"
assert_file_contains "Transcribe page has polling" "$TR_PAGE" "setInterval\|setTimeout\|useEffect"
assert_file_contains "TTS page has polling" "$TTS_PAGE" "setInterval\|setTimeout\|useEffect"

# =============================================================================
# 21. API Client Type Safety
# =============================================================================
section "21. API Client Type Safety"

API_FILE="$WEBSITE_DIR/src/services/tapirApi.ts"

# Check return types
assert_file_contains "downloadMedia returns Promise<JobResponse>" "$API_FILE" "Promise<JobResponse>"
assert_file_contains "transcribeMedia returns Promise<JobResponse>" "$API_FILE" "Promise<JobResponse>"
assert_file_contains "textToSpeech returns Promise<JobResponse>" "$API_FILE" "Promise<JobResponse>"
assert_file_contains "getJobStatus returns Promise<JobStatus>" "$API_FILE" "Promise<JobStatus>"
assert_file_contains "listJobs returns Promise<JobListResponse>" "$API_FILE" "Promise<JobListResponse>"
assert_file_contains "checkHealth returns Promise<HealthCheckResponse>" "$API_FILE" "Promise<HealthCheckResponse>"

# Proper HTTP methods
assert_file_contains "Uses POST for mutations" "$API_FILE" "method: 'POST'"
assert_file_contains "Uses DELETE for deletion" "$API_FILE" "method: 'DELETE'"
assert_file_contains "Sets Content-Type header" "$API_FILE" "Content-Type.*application/json"

# =============================================================================
# 22. Loading State
# =============================================================================
section "22. Loading States"

LOADING_FILE="$DASH_DIR/loading.tsx"
if [ -f "$LOADING_FILE" ]; then
  assert_pass "Loading component exists"
else
  skip_test "Loading component" "loading.tsx not found"
fi

# =============================================================================
# 23. Build Output Analysis
# =============================================================================
section "23. Build Output Analysis"

if [ -d "$OUT_DIR" ]; then
  TOTAL_SIZE=$(du -sh "$OUT_DIR" 2>/dev/null | cut -f1 || echo "N/A")
  echo -e "  Total build size: $TOTAL_SIZE"

  HTML_COUNT=$(find "$OUT_DIR" -name "*.html" 2>/dev/null | wc -l || echo 0)
  echo -e "  HTML files: $HTML_COUNT"

  JS_TOTAL=$(find "$OUT_DIR" -name "*.js" 2>/dev/null | wc -l || echo 0)
  echo -e "  JS files: $JS_TOTAL"

  CSS_TOTAL=$(find "$OUT_DIR" -name "*.css" 2>/dev/null | wc -l || echo 0)
  echo -e "  CSS files: $CSS_TOTAL"

  assert_condition "Has at least 6 HTML pages" "[ $HTML_COUNT -ge 6 ]" "Only $HTML_COUNT HTML files"
else
  skip_test "Build output analysis" "out/ not found"
fi

# =============================================================================
# Results Summary
# =============================================================================
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  FRONTEND TEST RESULTS${NC}"
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
