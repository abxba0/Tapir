/**
 * Tapir REST API Server / Daemon Mode
 *
 * Run Tapir as a background HTTP service so other tools, web UIs,
 * or scripts can queue downloads, search YouTube, convert audio,
 * and check status via a simple REST API.
 *
 * Usage:
 *   bun run src/server.ts                    # Start on default port 8384
 *   bun run src/server.ts --port 9000        # Custom port
 *   bun run src/index.ts --server            # Start from main entry point
 *   bun run src/index.ts --server --port 9000
 */

import { basename, extname } from "path"
import { validateFilePath, isSafeUrl, isSafeFetchUrl, validateOutputDir } from "../../shared/validation/index"
import type { DownloadProgress, DownloadResult, VideoInfo, QueuedJob } from "../../shared/types/index"
import { VERSION } from "../../tui/src/utils"
import {
  getVideoInfo,
  downloadVideo,
  downloadVideoWithProgress,
  searchYouTube,
} from "../../tui/src/services/downloader"
import { convertAudioFile } from "../../tui/src/services/converter"
import { textToSpeech } from "../../tui/src/services/tts"
import { embedMetadata, extractMetadata, findLatestFile } from "../../tui/src/services/metadata"
import { transcribeFromUrl, transcribeLocalFile, saveTranscription } from "../../tui/src/services/transcriber"
import { runHook, ensurePluginDirs, getPluginSummary } from "../../tui/src/services/plugins"

// ============================================================================
// Job Queue (in-memory)
// ============================================================================

const jobs = new Map<string, QueuedJob>()
let jobCounter = 0
const MAX_JOBS = 1000

// Pre-computed job lists cache
let jobsListCache: { data: any; timestamp: number } | null = null
const JOBS_LIST_CACHE_TTL = 500 // 0.5 seconds

function invalidateJobsCache() {
  jobsListCache = null
}

// ============================================================================
// Enterprise Configuration (via environment variables)
// ============================================================================

const API_KEY = process.env.TAPIR_API_KEY || ""
const CORS_ORIGIN = process.env.TAPIR_CORS_ORIGIN || "*"
const RATE_LIMIT = parseInt(process.env.TAPIR_RATE_LIMIT || "60")
const RATE_WINDOW_MS = 60_000
const DISABLE_RATE_LIMIT = process.env.TAPIR_DISABLE_RATE_LIMIT === "true"
let shuttingDown = false

// ============================================================================
// Rate Limiting (per-IP sliding window)
// ============================================================================

const rateLimitMap = new Map<string, number[]>()

// Whitelist of IPs that bypass rate limiting (localhost/testing)
const RATE_LIMIT_WHITELIST = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "localhost",
  "unknown"
])

function checkRateLimit(ip: string): boolean {
  // Allow disabling rate limiting via env var for testing
  if (DISABLE_RATE_LIMIT) return true
  
  // Whitelist localhost connections for testing
  if (RATE_LIMIT_WHITELIST.has(ip)) return true
  
  const now = Date.now()
  const cutoff = now - RATE_WINDOW_MS
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => t > cutoff)
  if (timestamps.length >= RATE_LIMIT) {
    rateLimitMap.set(ip, timestamps)
    return false
  }
  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return true
}

// ============================================================================
// Auth
// ============================================================================

function checkAuth(req: Request): boolean {
  if (!API_KEY) return true
  const auth = req.headers.get("authorization")
  return auth === `Bearer ${API_KEY}`
}

// ============================================================================
// Enum Validation
// ============================================================================

const VALID_AUDIO_FORMATS = new Set(["mp3", "aac", "m4a", "ogg", "wav", "flac"])
const VALID_TTS_ENGINES = new Set(["edge-tts", "gtts", "espeak"])
const VALID_TTS_FORMATS = new Set(["mp3", "wav"])
const VALID_TRANSCRIPTION_FORMATS = new Set(["txt", "srt", "vtt"])
const VALID_WHISPER_MODELS = new Set(["tiny", "base", "small", "medium", "large"])

function generateJobId(): string {
  jobCounter++
  return `job_${Date.now()}_${jobCounter}`
}

function cleanOldJobs(): void {
  const MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours
  const now = Date.now()
  let deletedAny = false
  for (const [id, job] of jobs) {
    if (job.completedAt && now - job.completedAt > MAX_AGE) {
      jobs.delete(id)
      deletedAny = true
    }
  }
  if (deletedAny) invalidateJobsCache()
}

// ============================================================================
// Job processing
// ============================================================================

async function processDownloadJob(job: QueuedJob): Promise<void> {
  job.status = "running"
  job.startedAt = Date.now()

  const req = job.request as {
    url: string
    format?: string
    outputDir?: string
    downloadSubs?: boolean
    subLangs?: string
    embedMetadata?: boolean
    embedThumbnail?: boolean
  }

  try {
    // Fetch video info first
    const info = await getVideoInfo(req.url)

    const result = await downloadVideoWithProgress(
      {
        url: req.url,
        format: req.format || "best",
        outputDir: req.outputDir || "youtube_downloads",
        downloadSubs: req.downloadSubs,
        subLangs: req.subLangs,
      },
      (progress) => {
        job.progress = progress
      },
    )

    job.result = { ...result } as unknown as Record<string, unknown>

    const latestFile = (result.success && result.outputDir) ? findLatestFile(result.outputDir) : null
    if (latestFile) {
      ;(job.result as any).filePath = latestFile
    }

    if (latestFile && req.embedMetadata !== false && info) {
      const meta = extractMetadata(info, req.url)
      const embedResult = await embedMetadata(latestFile, meta, {
        embedThumbnail: req.embedThumbnail !== false,
      })
      ;(job.result as any).metadataEmbed = embedResult
    }

    if (result.success && result.outputDir) {
      const pluginResults = await runHook("post-download", {
        file: latestFile || undefined,
        title: info?.title,
        url: req.url,
        format: req.format || "best",
        outputDir: result.outputDir,
        success: true,
      })
      if (pluginResults.length > 0) {
        ;(job.result as any).plugins = pluginResults
      }
    }

    job.status = result.success ? "completed" : "failed"
    if (!result.success) job.error = result.message
  } catch (err: any) {
    job.status = "failed"
    job.error = err.message || String(err)
  }

  job.completedAt = Date.now()
  invalidateJobsCache()
}

async function processConvertJob(job: QueuedJob): Promise<void> {
  job.status = "running"
  job.startedAt = Date.now()

  const req = job.request as {
    inputFile: string
    outputFormat: string
    bitrate?: number
  }

  try {
    const outputFile = await convertAudioFile(req)

    if (outputFile) {
      job.result = { success: true, outputFile }
      job.status = "completed"

      // Post-convert plugins
      const pluginResults = await runHook("post-convert", {
        file: outputFile,
        format: req.outputFormat,
        success: true,
      })
      if (pluginResults.length > 0) {
        ;(job.result as any).plugins = pluginResults
      }
    } else {
      job.status = "failed"
      job.error = "Conversion failed"
      job.result = { success: false }
    }
  } catch (err: any) {
    job.status = "failed"
    job.error = err.message || String(err)
  }

  job.completedAt = Date.now()
  invalidateJobsCache()
}

async function processTtsJob(job: QueuedJob): Promise<void> {
  job.status = "running"
  job.startedAt = Date.now()

  const req = job.request as {
    inputFile: string
    voice?: string
    outputFormat?: string
    outputDir?: string
    engine?: string
  }

  try {
    const result = await textToSpeech({
      inputFile: req.inputFile,
      voice: req.voice,
      outputFormat: (req.outputFormat as "mp3" | "wav") || "mp3",
      outputDir: req.outputDir || "youtube_downloads",
      engine: req.engine as any,
    })

    job.result = { ...result } as unknown as Record<string, unknown>
    job.status = result.success ? "completed" : "failed"
    if (!result.success) job.error = result.message
  } catch (err: any) {
    job.status = "failed"
    job.error = err.message || String(err)
  }

  job.completedAt = Date.now()
  invalidateJobsCache()
}

async function processTranscribeJob(job: QueuedJob): Promise<void> {
  job.status = "running"
  job.startedAt = Date.now()

  const req = job.request as {
    url?: string
    filePath?: string
    modelSize?: string
    language?: string
    outputFormat?: string
    outputDir?: string
    cookiesFile?: string
    cookiesFromBrowser?: string
  }

  try {
    let transcriptionResult = null

    if (req.url) {
      // Transcribe from URL
      transcriptionResult = await transcribeFromUrl(
        {
          source: req.url,
          modelSize: (req.modelSize as any) || "base",
          language: req.language,
          outputDir: req.outputDir || "youtube_downloads",
          cookiesFile: req.cookiesFile,
          cookiesFromBrowser: req.cookiesFromBrowser,
        },
        (message) => {
          // Store progress messages
          if (!job.progress) {
            (job as any).progressMessages = []
          }
          (job as any).progressMessages = [(job as any).progressMessages || [], message].flat()
        },
      )
    } else if (req.filePath) {
      // Transcribe local file
      if (!validateFilePath(req.filePath)) {
        throw new Error("Invalid or inaccessible file path")
      }
      transcriptionResult = await transcribeLocalFile(
        req.filePath,
        (req.modelSize as any) || "base",
        req.language,
        req.outputDir || "youtube_downloads",
        (message) => {
          if (!job.progress) {
            (job as any).progressMessages = []
          }
          (job as any).progressMessages = [(job as any).progressMessages || [], message].flat()
        },
      )
    } else {
      throw new Error("Either 'url' or 'filePath' must be provided")
    }

    if (transcriptionResult) {
      const outputFormat = (req.outputFormat || "txt") as any
      const outputDir = req.outputDir || "youtube_downloads"
      const baseName = "transcription"
      const outputPath = `${outputDir}/${baseName}`

      const savedPath = saveTranscription(
        transcriptionResult.text,
        transcriptionResult.segments || null,
        outputPath,
        outputFormat,
      )

      job.result = {
        success: true,
        text: transcriptionResult.text,
        language: transcriptionResult.language,
        outputFile: savedPath,
        segmentCount: transcriptionResult.segments?.length || 0,
      }
      job.status = "completed"
    } else {
      job.status = "failed"
      job.error = "Transcription failed"
      job.result = { success: false }
    }
  } catch (err: any) {
    job.status = "failed"
    job.error = err.message || String(err)
  }

  job.completedAt = Date.now()
  invalidateJobsCache()
}

// ============================================================================
// Route helpers
// ============================================================================

// Cache for frequently accessed data
let healthCache: { data: any; timestamp: number } | null = null
const HEALTH_CACHE_TTL = 1000 // 1 second

function jsonResponse(data: unknown, status: number = 200, cacheControl?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Connection": "keep-alive",
    "Keep-Alive": "timeout=5",
  }
  
  if (cacheControl) {
    headers["Cache-Control"] = cacheControl
  }
  
  return new Response(JSON.stringify(data), { status, headers })
}

function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ error: message }, status)
}

const MAX_BODY_BYTES = 1_048_576 // 1 MB

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const len = req.headers.get("content-length")
    if (len && parseInt(len) > MAX_BODY_BYTES) return {}
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function canCreateJob(): boolean {
  if (jobs.size < MAX_JOBS) return true
  cleanOldJobs()
  return jobs.size < MAX_JOBS
}

// ============================================================================
// Route handlers
// ============================================================================

async function handleRequest(req: Request, server: any): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method
  const ip = server?.requestIP?.(req)?.address || "unknown"

  // Request logging
  console.log(`${new Date().toISOString()} ${method} ${path} [${ip}]`)

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  // Shutdown guard
  if (shuttingDown) {
    return jsonResponse({ error: "Server is shutting down" }, 503)
  }

  // Auth check
  if (!checkAuth(req)) {
    return errorResponse("Unauthorized", 401)
  }

  // Rate limiting
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }

  // Health check
  if (path === "/api/health" && method === "GET") {
    const now = Date.now()
    
    // Use cached response if available and fresh
    if (healthCache && (now - healthCache.timestamp < HEALTH_CACHE_TTL)) {
      return jsonResponse(healthCache.data, 200, "public, max-age=1")
    }
    
    const counts = { queued: 0, running: 0, completed: 0, failed: 0 }
    for (const job of jobs.values()) {
      counts[job.status]++
    }

    const healthData = {
      status: "ok",
      version: VERSION,
      uptime: process.uptime(),
      jobs: { total: jobs.size, ...counts },
    }
    
    healthCache = { data: healthData, timestamp: now }
    return jsonResponse(healthData, 200, "public, max-age=1")
  }

  // YouTube search
  if (path === "/api/search" && method === "POST") {
    const body = await parseBody(req)
    const query = body.query as string
    const maxResults = Math.min((body.maxResults as number) || 10, 25)

    if (!query) return errorResponse("Missing 'query' field")

    const results = await searchYouTube(query, maxResults)
    return jsonResponse({ results, count: results.length })
  }

  // Video info
  if (path === "/api/info" && method === "POST") {
    const body = await parseBody(req)
    const videoUrl = body.url as string

    if (!videoUrl) return errorResponse("Missing 'url' field")
    if (!isSafeUrl(videoUrl)) return errorResponse("URL scheme not allowed")

    const info = await getVideoInfo(videoUrl)
    if (!info) return errorResponse("Failed to fetch video info", 404)

    return jsonResponse({ info })
  }

  // Queue download
  if (path === "/api/download" && method === "POST") {
    const body = await parseBody(req)
    const videoUrl = body.url as string

    if (!videoUrl) return errorResponse("Missing 'url' field")
    if (!isSafeUrl(videoUrl)) return errorResponse("URL scheme not allowed")
    if (body.outputDir && !validateOutputDir(body.outputDir as string)) {
      return errorResponse("Output directory not allowed")
    }
    if (!canCreateJob()) return errorResponse("Job queue full", 429)

    const job: QueuedJob = {
      id: generateJobId(),
      type: "download",
      status: "queued",
      createdAt: Date.now(),
      request: body,
    }

    jobs.set(job.id, job)
    invalidateJobsCache()

    // Start processing in background
    processDownloadJob(job).catch(() => {
      job.status = "failed"
      job.completedAt = Date.now()
      invalidateJobsCache()
    })

    return jsonResponse({ jobId: job.id, status: "queued" }, 202)
  }

  // Queue conversion
  if (path === "/api/convert" && method === "POST") {
    const body = await parseBody(req)
    const inputFile = body.inputFile as string
    const outputFormat = body.outputFormat as string

    if (!inputFile || !outputFormat) {
      return errorResponse("Missing 'inputFile' or 'outputFormat' field")
    }
    if (!VALID_AUDIO_FORMATS.has(outputFormat.toLowerCase())) {
      return errorResponse("Unsupported output format")
    }
    if (!validateFilePath(inputFile)) return errorResponse("Invalid or inaccessible file path")
    if (!canCreateJob()) return errorResponse("Job queue full", 429)

    const job: QueuedJob = {
      id: generateJobId(),
      type: "convert",
      status: "queued",
      createdAt: Date.now(),
      request: body,
    }

    jobs.set(job.id, job)
    invalidateJobsCache()

    processConvertJob(job).catch(() => {
      job.status = "failed"
      job.completedAt = Date.now()
      invalidateJobsCache()
    })

    return jsonResponse({ jobId: job.id, status: "queued" }, 202)
  }

  // Queue text-to-speech
  if (path === "/api/tts" && method === "POST") {
    const body = await parseBody(req)
    const inputFile = body.inputFile as string

    if (!inputFile) {
      return errorResponse("Missing 'inputFile' field")
    }
    if (body.engine && !VALID_TTS_ENGINES.has(body.engine as string)) {
      return errorResponse("Unsupported TTS engine")
    }
    if (body.outputFormat && !VALID_TTS_FORMATS.has((body.outputFormat as string).toLowerCase())) {
      return errorResponse("Unsupported TTS output format")
    }
    if (body.outputDir && !validateOutputDir(body.outputDir as string)) {
      return errorResponse("Output directory not allowed")
    }
    if (!validateFilePath(inputFile)) return errorResponse("Invalid or inaccessible file path")
    if (!canCreateJob()) return errorResponse("Job queue full", 429)

    const job: QueuedJob = {
      id: generateJobId(),
      type: "tts",
      status: "queued",
      createdAt: Date.now(),
      request: body,
    }

    jobs.set(job.id, job)
    invalidateJobsCache()

    processTtsJob(job).catch(() => {
      job.status = "failed"
      job.completedAt = Date.now()
      invalidateJobsCache()
    })

    return jsonResponse({ jobId: job.id, status: "queued" }, 202)
  }

  // Queue transcription
  if (path === "/api/transcribe" && method === "POST") {
    const body = await parseBody(req)
    const url = body.url as string
    const filePath = body.filePath as string

    if (!url && !filePath) {
      return errorResponse("Missing 'url' or 'filePath' field")
    }
    if (url && !isSafeUrl(url)) return errorResponse("URL scheme not allowed")
    if (filePath && !validateFilePath(filePath)) return errorResponse("Invalid or inaccessible file path")
    if (body.modelSize && !VALID_WHISPER_MODELS.has(body.modelSize as string)) {
      return errorResponse("Unsupported Whisper model")
    }
    if (body.outputFormat && !VALID_TRANSCRIPTION_FORMATS.has((body.outputFormat as string).toLowerCase())) {
      return errorResponse("Unsupported transcription output format")
    }
    if (body.outputDir && !validateOutputDir(body.outputDir as string)) {
      return errorResponse("Output directory not allowed")
    }
    if (!canCreateJob()) return errorResponse("Job queue full", 429)

    const job: QueuedJob = {
      id: generateJobId(),
      type: "transcribe",
      status: "queued",
      createdAt: Date.now(),
      request: body,
    }

    jobs.set(job.id, job)
    invalidateJobsCache()

    processTranscribeJob(job).catch(() => {
      job.status = "failed"
      job.completedAt = Date.now()
      invalidateJobsCache()
    })

    return jsonResponse({ jobId: job.id, status: "queued" }, 202)
  }

  // List all jobs
  if (path === "/api/jobs" && method === "GET") {
    cleanOldJobs()

    const statusFilter = url.searchParams.get("status")
    const typeFilter = url.searchParams.get("type")

    let jobList = [...jobs.values()]
    if (statusFilter) jobList = jobList.filter((j) => j.status === statusFilter)
    if (typeFilter) jobList = jobList.filter((j) => j.type === typeFilter)

    // Sort newest first
    jobList.sort((a, b) => b.createdAt - a.createdAt)

    return jsonResponse({ jobs: jobList, count: jobList.length }, 200, "no-cache, max-age=0")
  }

  // Download file from completed job
  const downloadMatch = path.match(/^\/api\/jobs\/(.+)\/download$/)
  if (downloadMatch && method === "GET") {
    const jobId = downloadMatch[1]
    const job = jobs.get(jobId)
    if (!job) return errorResponse("Job not found", 404)
    if (job.status !== "completed") return errorResponse("Job not completed yet", 409)

    const filePath = ((job.result as any)?.filePath || (job.result as any)?.outputFile) as string | undefined
    if (!filePath) return errorResponse("No file available for this job", 404)

    const validated = validateFilePath(filePath)
    if (!validated) return errorResponse("File not accessible", 404)

    const file = Bun.file(validated)
    const exists = await file.exists()
    if (!exists) return errorResponse("File no longer exists", 404)

    const filename = basename(validated)
    const ext = extname(validated).toLowerCase()

    const mimeTypes: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      ".wav": "audio/wav",
      ".txt": "text/plain",
      ".srt": "text/plain",
      ".vtt": "text/vtt",
    }
    const contentType = mimeTypes[ext] || "application/octet-stream"

    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(file.size),
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    })
  }

  // Get single job
  const jobMatch = path.match(/^\/api\/jobs\/(.+)$/)
  if (jobMatch && method === "GET") {
    const jobId = jobMatch[1]
    const job = jobs.get(jobId)
    if (!job) return errorResponse("Job not found", 404)
    return jsonResponse(job)
  }

  // Delete/cancel a job
  if (jobMatch && method === "DELETE") {
    const jobId = jobMatch[1]
    const job = jobs.get(jobId)
    if (!job) return errorResponse("Job not found", 404)
    if (job.status === "running") {
      return errorResponse("Cannot delete a running job", 409)
    }
    jobs.delete(jobId)
    invalidateJobsCache()
    return jsonResponse({ deleted: true })
  }

  // Plugins info
  if (path === "/api/plugins" && method === "GET") {
    ensurePluginDirs()
    return jsonResponse({ plugins: getPluginSummary() })
  }

  // Embed metadata manually
  if (path === "/api/metadata/embed" && method === "POST") {
    const body = await parseBody(req)
    const file = body.file as string
    const title = body.title as string | undefined
    const artist = body.artist as string | undefined
    const thumbnailUrl = body.thumbnailUrl as string | undefined

    if (!file) return errorResponse("Missing 'file' field")
    if (!validateFilePath(file)) return errorResponse("Invalid or inaccessible file path")
    if (thumbnailUrl && !isSafeFetchUrl(thumbnailUrl)) return errorResponse("Thumbnail URL not allowed")

    const result = await embedMetadata(file, {
      title,
      artist,
      thumbnailUrl,
    }, {
      embedThumbnail: !!thumbnailUrl,
    })

    return jsonResponse(result)
  }

  return errorResponse("Not found", 404)
}

// ============================================================================
// Server startup
// ============================================================================

export function startServer(port: number = 8384, host: string = "127.0.0.1"): void {
  ensurePluginDirs()

  const server = Bun.serve({
    port,
    hostname: host,
    fetch: handleRequest,
  })

  // Graceful shutdown
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log("\nShutting down gracefully...")
    server.stop()
    const check = () => {
      const hasRunning = [...jobs.values()].some(j => j.status === "running")
      if (!hasRunning) process.exit(0)
    }
    check()
    const interval = setInterval(check, 1000)
    setTimeout(() => { clearInterval(interval); process.exit(0) }, 30_000)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  const authStatus = API_KEY ? "enabled" : "disabled"
  const rateStatus = `${RATE_LIMIT} req/min`

  console.log(`
┌──────────────────────────────────────────────────┐
│  Tapir REST API Server v${VERSION}                  │
│──────────────────────────────────────────────────│
│                                                  │
│  Listening on: http://${host}:${String(server.port).padEnd(5)}          │
│  Auth: ${authStatus.padEnd(10)}  Rate limit: ${rateStatus.padEnd(12)}  │
│  CORS origin: ${CORS_ORIGIN.slice(0, 33).padEnd(33)} │
│                                                  │
│  Endpoints:                                      │
│    GET  /api/health          Health check        │
│    POST /api/search          YouTube search      │
│    POST /api/info            Video info          │
│    POST /api/download        Queue download      │
│    POST /api/convert         Queue conversion    │
│    POST /api/tts             Queue text-to-speech│
│    POST /api/transcribe      Queue transcription │
│    GET  /api/jobs            List all jobs       │
│    GET  /api/jobs/:id        Get job status      │
│    GET  /api/jobs/:id/download  Download file    │
│    DELETE /api/jobs/:id      Delete a job        │
│    GET  /api/plugins         List plugins        │
│    POST /api/metadata/embed  Embed metadata      │
│                                                  │
│  Press Ctrl+C to stop                            │
└──────────────────────────────────────────────────┘
`)
}

// Allow direct execution: bun run src/server.ts [--port N] [--host ADDR]
if (import.meta.main) {
  const args = process.argv.slice(2)
  const portIdx = args.indexOf("--port")
  const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1]) : 8384
  const hostIdx = args.indexOf("--host")
  const host = hostIdx !== -1 && args[hostIdx + 1] ? args[hostIdx + 1] : "127.0.0.1"

  startServer(port, host)
}
