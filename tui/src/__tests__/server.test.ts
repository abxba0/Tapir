/**
 * Tests for server.ts - REST API endpoints
 *
 * Starts a test server on a random high port and sends real HTTP requests.
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test"

// We'll test the handler directly by importing the server module
// and calling fetch against a live Bun.serve instance.

let server: ReturnType<typeof Bun.serve> | null = null
let baseUrl: string = ""
let originalSpawn: typeof Bun.spawn

beforeAll(async () => {
  originalSpawn = Bun.spawn

  // Import server module to get the request handler
  // Start the server on a random port
  const { startServer } = await import("../server")

  // We need to capture the server. startServer prints and calls Bun.serve.
  // Instead, let's import the module and create our own test server.
  // Since the module uses Bun.serve internally, we'll just test via the exported startServer
  // But startServer doesn't return the server. Let's intercept Bun.serve.

  // Alternative: use the server module's handleRequest by re-exporting it.
  // For testing, let's just start a server on a test port.
  const originalServe = Bun.serve
  let capturedServer: any = null

  // Monkey-patch console.log to suppress server startup message
  const origLog = console.log
  console.log = () => {}

  Bun.serve = ((opts: any) => {
    capturedServer = originalServe({ ...opts, port: 0 })
    return capturedServer
  }) as any

  startServer(0)

  Bun.serve = originalServe
  console.log = origLog

  if (capturedServer) {
    server = capturedServer
    baseUrl = `http://localhost:${(server as any).port}`
  }
})

afterAll(() => {
  if (server) {
    (server as any).stop?.()
  }
  Bun.spawn = originalSpawn
})

// ============================================================================
// Health check
// ============================================================================

describe("GET /api/health", () => {
  test("returns 200 with status ok", async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.status).toBe("ok")
    expect(data.version).toBeTruthy()
    expect(data.jobs).toBeDefined()
    expect(typeof data.jobs.total).toBe("number")
  })
})

// ============================================================================
// 404 Not Found
// ============================================================================

describe("Unknown routes", () => {
  test("returns 404 for unknown path", async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`)
    expect(res.status).toBe(404)
    const data = await res.json() as any
    expect(data.error).toBe("Not found")
  })
})

// ============================================================================
// CORS
// ============================================================================

describe("CORS", () => {
  test("OPTIONS request returns CORS headers", async () => {
    const res = await fetch(`${baseUrl}/api/health`, { method: "OPTIONS" })
    expect(res.status).toBe(200)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET")
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST")
  })

  test("responses include CORS header", async () => {
    const res = await fetch(`${baseUrl}/api/health`)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
  })
})

// ============================================================================
// POST /api/search
// ============================================================================

describe("POST /api/search", () => {
  test("returns error when query is missing", async () => {
    const res = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toContain("query")
  })

  test("accepts valid search request", async () => {
    // Mock Bun.spawn for yt-dlp search
    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(
            JSON.stringify({
              id: "test123",
              title: "Test Result",
              channel: "TestChannel",
              duration: 60,
              view_count: 100,
            }) + "\n",
          ))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const res = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test video", maxResults: 5 }),
    })

    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.results).toBeDefined()
    expect(data.count).toBeDefined()
  })
})

// ============================================================================
// POST /api/info
// ============================================================================

describe("POST /api/info", () => {
  test("returns error when url is missing", async () => {
    const res = await fetch(`${baseUrl}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toContain("url")
  })

  test("returns 404 when video info fetch fails", async () => {
    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(1),
    })) as any

    const res = await fetch(`${baseUrl}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://youtube.com/watch?v=bad" }),
    })

    expect(res.status).toBe(404)
  })

  test("returns info for valid video", async () => {
    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(
            JSON.stringify({ title: "Test Video", channel: "Ch", duration: 120 }) + "\n",
          ))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const res = await fetch(`${baseUrl}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://youtube.com/watch?v=test" }),
    })

    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.info.title).toBe("Test Video")
  })
})

// ============================================================================
// POST /api/download
// ============================================================================

describe("POST /api/download", () => {
  test("returns error when url is missing", async () => {
    const res = await fetch(`${baseUrl}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toContain("url")
  })

  test("queues a download and returns job ID", async () => {
    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("[download] 100% of 10.00MiB in 00:02\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const res = await fetch(`${baseUrl}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://youtube.com/watch?v=test", format: "best" }),
    })

    expect(res.status).toBe(202)
    const data = await res.json() as any
    expect(data.jobId).toBeTruthy()
    expect(data.status).toBe("queued")
  })
})

// ============================================================================
// POST /api/convert
// ============================================================================

describe("POST /api/convert", () => {
  test("returns error when fields missing", async () => {
    const res = await fetch(`${baseUrl}/api/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputFile: "/tmp/test.mp3" }),
    })
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toContain("outputFormat")
  })

  test("queues a conversion", async () => {
    const res = await fetch(`${baseUrl}/api/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputFile: "/tmp/test.mp3", outputFormat: "wav" }),
    })
    expect(res.status).toBe(202)
    const data = await res.json() as any
    expect(data.jobId).toBeTruthy()
  })
})

// ============================================================================
// GET /api/jobs
// ============================================================================

describe("GET /api/jobs", () => {
  test("returns job list", async () => {
    const res = await fetch(`${baseUrl}/api/jobs`)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.jobs).toBeDefined()
    expect(Array.isArray(data.jobs)).toBe(true)
    expect(typeof data.count).toBe("number")
  })

  test("supports status filter", async () => {
    const res = await fetch(`${baseUrl}/api/jobs?status=completed`)
    expect(res.status).toBe(200)
  })

  test("supports type filter", async () => {
    const res = await fetch(`${baseUrl}/api/jobs?type=download`)
    expect(res.status).toBe(200)
  })
})

// ============================================================================
// GET /api/jobs/:id
// ============================================================================

describe("GET /api/jobs/:id", () => {
  test("returns 404 for non-existent job", async () => {
    const res = await fetch(`${baseUrl}/api/jobs/nonexistent_job`)
    expect(res.status).toBe(404)
    const data = await res.json() as any
    expect(data.error).toContain("not found")
  })

  test("returns job details for existing job", async () => {
    // First create a job
    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const createRes = await fetch(`${baseUrl}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://youtube.com/watch?v=jobtest" }),
    })
    const createData = await createRes.json() as any

    // Wait a bit for processing to start
    await Bun.sleep(50)

    const res = await fetch(`${baseUrl}/api/jobs/${createData.jobId}`)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.id).toBe(createData.jobId)
    expect(data.type).toBe("download")
  })
})

// ============================================================================
// DELETE /api/jobs/:id
// ============================================================================

describe("DELETE /api/jobs/:id", () => {
  test("returns 404 for non-existent job", async () => {
    const res = await fetch(`${baseUrl}/api/jobs/nonexistent`, { method: "DELETE" })
    expect(res.status).toBe(404)
  })
})

// ============================================================================
// GET /api/plugins
// ============================================================================

describe("GET /api/plugins", () => {
  test("returns plugin list", async () => {
    const res = await fetch(`${baseUrl}/api/plugins`)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.plugins).toBeDefined()
    expect(Array.isArray(data.plugins)).toBe(true)
  })
})

// ============================================================================
// POST /api/metadata/embed
// ============================================================================

describe("POST /api/metadata/embed", () => {
  test("returns error when file is missing", async () => {
    const res = await fetch(`${baseUrl}/api/metadata/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    })
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toContain("file")
  })

  test("attempts to embed metadata for given file", async () => {
    const res = await fetch(`${baseUrl}/api/metadata/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: "/tmp/nonexistent.mp4", title: "Test" }),
    })
    expect(res.status).toBe(200)
    const data = await res.json() as any
    // Will fail because file doesn't exist, but should not crash
    expect(typeof data.success).toBe("boolean")
  })
})

// ============================================================================
// Body parsing edge cases
// ============================================================================

describe("Request body edge cases", () => {
  test("handles invalid JSON body gracefully", async () => {
    const res = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    })
    // Should return 400 for missing query, not crash
    expect(res.status).toBe(400)
  })
})
