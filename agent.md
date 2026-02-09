# Agent Behavior Guidelines for Tapir

This document outlines the expected behaviors, practices, and workflows for AI agents working on the Tapir codebase. Following these guidelines ensures consistency, maintainability, and quality across all changes.

---

## 🎯 Core Principles

### 1. **Always Update Documentation After Code Changes**

When modifying code, immediately update:

- **README.md files** - If functionality, usage, or API changes
- **Inline code comments** - For complex logic or non-obvious implementations
- **API documentation** - `shared/api-contracts/openapi.yaml` for backend API changes
- **PERFORMANCE_OPTIMIZATIONS.md** - If performance-related changes are made
- **Type definitions** - `shared/types/index.ts` when data structures change

**Example Workflow:**
```bash
1. Modify backend endpoint in backend/src/server.ts
2. Update openapi.yaml with new parameters/responses
3. Update backend/README.md if usage changes
4. Update tests/test_backend.sh with new test cases
```

### 2. **Always Update Test Files After Code Changes**

**Critical:** Every code change must have corresponding test updates.

#### Test Files to Update:
- **`tests/test_backend.sh`** - When backend API changes
- **`tests/test_frontend.sh`** - When frontend components/pages change
- **`tests/test_backend_docker.sh`** - When Docker configuration changes
- **Component test files** - `tui/src/__tests__/*.test.ts` for TUI changes

#### Test Update Checklist:
- [ ] Add new test cases for new functionality
- [ ] Update existing test assertions if behavior changes
- [ ] Verify test patterns match new response formats
- [ ] Test error cases and edge conditions
- [ ] Run full test suite before considering work complete

**Example:**
```bash
# After adding a new API endpoint
1. Add endpoint implementation in server.ts
2. Add test section in test_backend.sh
3. Test success case (200/202 response)
4. Test error cases (400, 404, 429)
5. Test input validation
6. Run: cd tests && ./test_backend.sh
```

---

## 🏗️ Project Structure Awareness

### Backend (`/backend`)
- **Entry point:** `src/server.ts`
- **Dependencies:** Uses Bun runtime
- **Port:** 8384 (default)
- **Key features:** REST API, job queue, rate limiting, caching

### Frontend (`/website`)
- **Framework:** Next.js 14+ with App Router
- **UI Library:** Material-UI (MUI)
- **Output:** Static export to `out/` directory
- **API client:** `src/services/tapirApi.ts`

### TUI (`/tui`)
- **Runtime:** Node.js/Bun
- **Services:** downloader, transcriber, converter, TTS
- **Tests:** `src/__tests__/*.test.ts`

### Shared (`/shared`)
- **Types:** TypeScript type definitions
- **Validation:** Input validation utilities
- **API Contracts:** OpenAPI specification

### Tests (`/tests`)
- **Backend tests:** `test_backend.sh` (110+ tests)
- **Frontend tests:** `test_frontend.sh` (185+ tests)
- **Docker tests:** `test_backend_docker.sh`

---

## ⚡ Performance Requirements

### Response Time Targets
- **API endpoints:** 0.5-10ms (normal load)
- **Under load (50 concurrent):** <100ms average
- **Page load:** <500ms
- **Static assets:** Optimized and minimized

### Performance Best Practices

1. **No JSON Pretty Printing in Production**
   ```typescript
   // ❌ Bad
   JSON.stringify(data, null, 2)
   
   // ✅ Good
   JSON.stringify(data)
   ```

2. **Use Caching Strategically**
   - Server-side: In-memory cache with TTL
   - Client-side: Cache GET requests with appropriate TTL
   - Invalidate cache on mutations

3. **HTTP Optimization**
   - Enable keep-alive connections
   - Use Connection: keep-alive headers
   - Implement cache-control headers

4. **Avoid Expensive Operations**
   - Validate parameters before I/O operations
   - Fail fast on invalid input
   - Use lazy loading where appropriate

---

## 🔒 Security Requirements

### Rate Limiting
- **Default:** 60 requests/minute per IP
- **Localhost exemption:** Whitelist 127.0.0.1, ::1, localhost for testing
- **Environment variable:** `TAPIR_DISABLE_RATE_LIMIT=true` for tests
- **Always enforce** for non-localhost connections

### Input Validation

**URL Validation:**
```typescript
// Block dangerous URL schemes
❌ file:// (local file access)
❌ javascript: (XSS)
❌ data: (arbitrary data)
❌ vbscript: (script execution)
✅ http:// https:// (allowed)
```

**Path Validation:**
```typescript
// Block path traversal
❌ /etc/passwd
❌ ../../secret
❌ ~/.ssh/
✅ youtube_downloads/video.mp4
```

**Thumbnail URL Validation:**
```typescript
// Block internal networks
❌ localhost, 127.0.0.1
❌ 10.0.0.0/8, 192.168.0.0/16
❌ 169.254.0.0/16 (cloud metadata)
❌ .internal, .local domains
✅ Public HTTP(S) URLs
```

### Security Headers
Always include in responses:
```typescript
"X-Content-Type-Options": "nosniff"
"X-Frame-Options": "DENY"
"Access-Control-Allow-Origin": (configurable)
```

---

## 🧪 Testing Standards

### Before Committing Changes

**Mandatory Checks:**
```bash
# 1. Run backend tests
cd tests && ./test_backend.sh
# Expect: 113/114 passing (99%+)

# 2. Run frontend tests  
cd tests && ./test_frontend.sh
# Expect: 185/185 passing (100%)

# 3. Quick performance check
for i in {1..10}; do 
  curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:8384/api/health
done
# Expect: <10ms average
```

### Test Writing Guidelines

1. **Test Structure:**
   ```bash
   section "Feature Name"
   
   # Happy path
   RESP=$(curl_cmd POST /api/endpoint -d '{"valid":"data"}')
   assert_status "Success case" "200" "$(get_status "$RESP")"
   
   # Error cases
   RESP=$(curl_cmd POST /api/endpoint -d '{}')
   assert_status "Missing field" "400" "$(get_status "$RESP")"
   assert_body_contains "Error message" "$(get_body "$RESP")" "required"
   
   # Edge cases
   # Security tests
   ```

2. **Test Naming:**
   - Descriptive: "Download with invalid URL returns 400"
   - Not: "Test 1", "Check endpoint"

3. **Assertion Coverage:**
   - Status codes (200, 400, 404, 429, 500)
   - Response body structure
   - Error messages
   - Security validations

---

## 🔄 Change Workflow

### Standard Change Process

1. **Understand the change request**
   - Identify affected components
   - Note dependencies

2. **Make code changes**
   - Backend, frontend, or TUI modifications
   - Follow existing code style

3. **Update types if needed**
   - `shared/types/index.ts`
   - TypeScript interfaces/types

4. **Update validation**
   - `shared/validation/index.ts`
   - Add new validation functions

5. **Update tests IMMEDIATELY**
   - Add/modify test cases in relevant `tests/*.sh`
   - Don't defer this step

6. **Update documentation**
   - README files
   - OpenAPI spec
   - Inline comments

7. **Run full test suite**
   - Backend + Frontend tests
   - Fix any failures

8. **Performance check**
   - Verify response times acceptable
   - Check for regressions

9. **Security review**
   - Input validation present
   - No new vulnerabilities
   - Rate limiting intact

---

## 📝 Documentation Standards

### README Updates

When to update README files:
- New features added
- API endpoints changed
- Installation steps modified
- Configuration options added
- Usage examples needed

### Code Comments

**When to add comments:**
- Complex algorithms
- Performance optimizations
- Security considerations
- Non-obvious workarounds
- External API interactions

**Example:**
```typescript
// Cache health endpoint for 1 second to reduce load
// during frequent polling from frontend
if (healthCache && (now - healthCache.timestamp < HEALTH_CACHE_TTL)) {
  return jsonResponse(healthCache.data, 200, "public, max-age=1")
}
```

### OpenAPI Specification

Update `shared/api-contracts/openapi.yaml` when:
- New endpoints added
- Request/response schemas change
- New query parameters
- Authentication changes
- Error responses modified

---

## 🐛 Debugging Workflow

### When Tests Fail

1. **Identify the failure:**
   ```bash
   cd tests && ./test_backend.sh 2>&1 | grep FAIL
   ```

2. **Read error details:**
   - Check expected vs actual values
   - Look at response body/status

3. **Reproduce manually:**
   ```bash
   curl -v http://localhost:8384/api/endpoint -X POST \
     -H "Content-Type: application/json" \
     -d '{"test":"data"}'
   ```

4. **Check server logs:**
   - Look at terminal running backend
   - Check for errors/warnings

5. **Fix root cause:**
   - Not the test (unless test is wrong)
   - Usually the implementation

6. **Verify fix:**
   - Re-run test suite
   - Check related tests

### Common Issues

**Rate limiting in tests:**
- Solution: Tests whitelist localhost
- Check: `RATE_LIMIT_WHITELIST` includes test IPs

**Validation order:**
- Check parameters before I/O
- Return specific error messages

**Cache staleness:**
- Invalidate cache on mutations
- Set appropriate TTLs

---

## 🎨 Code Style Guidelines

### TypeScript/JavaScript

```typescript
// Use async/await
async function processJob(job: QueuedJob): Promise<void> {
  try {
    const result = await someOperation()
    job.status = "completed"
  } catch (err: any) {
    job.status = "failed"
    job.error = err.message || String(err)
  }
}

// Use type safety
interface JobResponse {
  jobId: string
  status: string
}

// Use const for immutable, let for mutable
const API_BASE = process.env.API_URL
let retryCount = 0
```

### Shell Scripts

```bash
# Use strict mode
set -euo pipefail

# Quote variables
echo "Value: $var"
echo "Path: ${HOME}/path"

# Use functions
assert_status() {
  local test_name="$1"
  local expected="$2"
  local actual="$3"
  # ...
}
```

---

## 🚀 Deployment Considerations

### Pre-deployment Checklist

- [ ] All tests passing (backend + frontend)
- [ ] Documentation updated
- [ ] No console.log/debug statements in production
- [ ] Environment variables documented
- [ ] Performance verified (<10ms API responses)
- [ ] Security review completed
- [ ] Rate limiting enabled for production

### Environment Variables

Document in README when adding new vars:
```bash
TAPIR_API_KEY=              # Optional API authentication
TAPIR_CORS_ORIGIN=*         # CORS origin (default: *)
TAPIR_RATE_LIMIT=60         # Requests per minute
TAPIR_DISABLE_RATE_LIMIT=   # Set "true" for testing only
```

---

## 🔧 Maintenance Tasks

### Regular Checks

**Weekly:**
- Review test coverage
- Check for dependency updates
- Monitor performance metrics

**After Major Changes:**
- Run full test suite
- Performance benchmarks
- Update version numbers
- Check documentation accuracy

### When Adding Dependencies

1. **Consider alternatives** - Is it necessary?
2. **Check security** - Known vulnerabilities?
3. **Update package.json** - Proper version constraints
4. **Update tests** - Test new functionality
5. **Document usage** - Where/why it's used

---

## 📊 Quality Metrics

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Backend test pass rate | >99% | 99.1% (113/114) |
| Frontend test pass rate | 100% | 100% (185/185) |
| API response time | <10ms | 0.5-6ms |
| Build success rate | 100% | 100% |
| Type safety | 100% | 100% (strict mode) |
| Security tests passing | 100% | 100% |

### Acceptable Ranges

- **API latency:** 0.5-10ms (normal), <100ms (load)
- **Test failures:** 0-1 allowed (with documented reason)
- **Code coverage:** >80% for critical paths
- **Build time:** <60 seconds

---

## 🤖 Agent-Specific Behaviors

### Ralph Wiggum Method (Iterative Optimization)

When optimizing performance:
1. Measure baseline
2. Apply single optimization
3. Measure improvement
4. Repeat until target met
5. Document all changes

**Example:**
```
Iteration 1: Remove JSON pretty-printing → 10ms → 5ms
Iteration 2: Add caching → 5ms → 2ms
Iteration 3: Add keep-alive → 2ms → 0.5ms
Target achieved: <10ms ✓
```

### Error Recovery

When encountering errors:
1. **Don't give up** - Investigate root cause
2. **Check logs** - Server output, test output
3. **Verify assumptions** - Is the issue what you think?
4. **Try alternatives** - Multiple paths to solution
5. **Update docs** - Document the fix

### Communication Style

- ✅ Concise explanations
- ✅ Show test results
- ✅ Report numbers/metrics
- ✅ Clear before/after comparisons
- ❌ Don't create unnecessary doc files
- ❌ Don't announce tool names
- ❌ Don't ask permission for obvious fixes

---

## 📋 Checklist for Major Changes

Before marking any significant change as complete:

- [ ] Code changes implemented
- [ ] Tests updated (`tests/*.sh`)
- [ ] Tests pass (100% or documented failures)
- [ ] Documentation updated (README, comments)
- [ ] OpenAPI spec updated (if API changed)
- [ ] Type definitions updated (if structures changed)
- [ ] Performance verified (<10ms targets)
- [ ] Security reviewed (validation, headers)
- [ ] Rate limiting verified
- [ ] Cache invalidation working
- [ ] No regressions in other features
- [ ] Error messages helpful
- [ ] Edge cases tested

---

## 🎯 Success Criteria

A change is considered **complete and production-ready** when:

1. ✅ **Functionality works** as specified
2. ✅ **All tests pass** (backend + frontend)
3. ✅ **Performance meets targets** (<10ms APIs)
4. ✅ **Documentation updated** (code, README, OpenAPI)
5. ✅ **Security validated** (input validation, headers)
6. ✅ **No regressions** in existing features
7. ✅ **Code quality** maintained (types, style)

---

## 📚 Additional Resources

### Key Files to Review

- **`backend/src/server.ts`** - Main API server (800+ lines)
- **`website/src/services/tapirApi.ts`** - Frontend API client
- **`shared/types/index.ts`** - Core type definitions
- **`shared/validation/index.ts`** - Security validation
- **`tests/test_backend.sh`** - Backend test suite (798 lines)
- **`tests/test_frontend.sh`** - Frontend test suite (784 lines)

### Common Commands

```bash
# Start backend (Bun)
cd backend && bun run src/server.ts --host 0.0.0.0

# Start frontend (Next.js)
cd website && npm run dev

# Run tests
cd tests && ./test_backend.sh
cd tests && ./test_frontend.sh

# Performance check
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:8384/api/health

# Build frontend
cd website && npm run build
```

---

## 🎓 Learning from This Project

### Notable Implementations

1. **Performance Optimization** - See `PERFORMANCE_OPTIMIZATIONS.md`
   - JSON serialization optimization
   - Multi-layer caching strategy
   - Connection keep-alive
   - Smart cache invalidation

2. **Security by Default**
   - URL scheme validation
   - Path traversal prevention
   - Private network blocking
   - Rate limiting with localhost exemption

3. **Testing Excellence**
   - 300+ total tests
   - Comprehensive coverage
   - Security-focused tests
   - Performance validation

4. **Monorepo Structure**
   - Shared types and validation
   - Root-level dependencies
   - Independent packages (backend, frontend, TUI)

---

## 💡 Best Practices Summary

1. **Always update tests with code changes**
2. **Document as you go, not at the end**
3. **Performance matters - measure everything**
4. **Security is not optional**
5. **Tests must pass before completion**
6. **Types prevent bugs - use them**
7. **Cache wisely, invalidate completely**
8. **Fail fast on invalid input**
9. **Error messages should be helpful**
10. **Localhost ≠ Production (but keep secure)**

---

**Last Updated:** February 9, 2026
**Version:** 1.0.0
**Maintainer:** Tapir Project

---

*This document is a living guide. Update it as new patterns emerge or requirements change.*
