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

import { VERSION } from "./utils"
import {
  getVideoInfo,
  downloadVideo,
  downloadVideoWithProgress,
  searchYouTube,
} from "./services/downloader"
import { convertAudioFile } from "./services/converter"
import { textToSpeech } from "./services/tts"
import { embedMetadata, extractMetadata, findLatestFile } from "./services/metadata"
import { runHook, ensurePluginDirs, getPluginSummary } from "./services/plugins"
import type { DownloadProgress, DownloadResult, VideoInfo } from "./types"

// ============================================================================
// Types
// ============================================================================

interface QueuedJob {
  id: string
  type: "download" | "convert" | "transcribe" | "tts"
  status: "queued" | "running" | "completed" | "failed"
  createdAt: number
  startedAt?: number
  completedAt?: number
  request: Record<string, unknown>
  result?: Record<string, unknown>
  progress?: DownloadProgress
  error?: string
}

// ============================================================================
// Job Queue (in-memory)
// ============================================================================

const jobs = new Map<string, QueuedJob>()
let jobCounter = 0

function generateJobId(): string {
  jobCounter++
  return `job_${Date.now()}_${jobCounter}`
}

function cleanOldJobs(): void {
  const MAX_AGE = 24 * 60 * 60 * 1000 // 24 hours
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (job.completedAt && now - job.completedAt > MAX_AGE) {
      jobs.delete(id)
    }
  }
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

    // Post-download: metadata embedding + plugins
    const latestFile = (result.success && result.outputDir) ? findLatestFile(result.outputDir) : null

    if (result.success && result.outputDir && (req.embedMetadata !== false) && info) {
      const meta = extractMetadata(info, req.url)
      if (latestFile) {
        const embedResult = await embedMetadata(latestFile, meta, {
          embedThumbnail: req.embedThumbnail !== false,
        })
        ;(job.result as any).metadataEmbed = embedResult
      }
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
}

// ============================================================================
// Route helpers
// ============================================================================

function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ error: message }, status)
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

// ============================================================================
// Route handlers
// ============================================================================

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  }

  // Health check
  if (path === "/api/health" && method === "GET") {
    // Single pass over jobs to count statuses
    let queued = 0, running = 0, completed = 0, failed = 0
    for (const job of jobs.values()) {
      switch (job.status) {
        case "queued": queued++; break
        case "running": running++; break
        case "completed": completed++; break
        case "failed": failed++; break
      }
    }

    return jsonResponse({
      status: "ok",
      version: VERSION,
      uptime: process.uptime(),
      jobs: { total: jobs.size, queued, running, completed, failed },
    })
  }

  // YouTube search
  if (path === "/api/search" && method === "POST") {
    const body = await parseBody(req)
    const query = body.query as string
    const maxResults = (body.maxResults as number) || 10

    if (!query) return errorResponse("Missing 'query' field")

    const results = await searchYouTube(query, maxResults)
    return jsonResponse({ results, count: results.length })
  }

  // Video info
  if (path === "/api/info" && method === "POST") {
    const body = await parseBody(req)
    const videoUrl = body.url as string

    if (!videoUrl) return errorResponse("Missing 'url' field")

    const info = await getVideoInfo(videoUrl)
    if (!info) return errorResponse("Failed to fetch video info", 404)

    return jsonResponse({ info })
  }

  // Queue download
  if (path === "/api/download" && method === "POST") {
    const body = await parseBody(req)
    const videoUrl = body.url as string

    if (!videoUrl) return errorResponse("Missing 'url' field")

    const job: QueuedJob = {
      id: generateJobId(),
      type: "download",
      status: "queued",
      createdAt: Date.now(),
      request: body,
    }

    jobs.set(job.id, job)

    // Start processing in background
    processDownloadJob(job).catch(() => {
      job.status = "failed"
      job.completedAt = Date.now()
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

    const job: QueuedJob = {
      id: generateJobId(),
      type: "convert",
      status: "queued",
      createdAt: Date.now(),
      request: body,
    }

    jobs.set(job.id, job)

    processConvertJob(job).catch(() => {
      job.status = "failed"
      job.completedAt = Date.now()
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

    const job: QueuedJob = {
      id: generateJobId(),
      type: "tts",
      status: "queued",
      createdAt: Date.now(),
      request: body,
    }

    jobs.set(job.id, job)

    processTtsJob(job).catch(() => {
      job.status = "failed"
      job.completedAt = Date.now()
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

    return jsonResponse({ jobs: jobList, count: jobList.length })
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

export function startServer(port: number = 8384): void {
  ensurePluginDirs()

  const server = Bun.serve({
    port,
    fetch: handleRequest,
  })

  console.log(`
┌──────────────────────────────────────────────────┐
│  Tapir REST API Server v${VERSION}                  │
│──────────────────────────────────────────────────│
│                                                  │
│  Listening on: http://localhost:${String(server.port).padEnd(5)}            │
│                                                  │
│  Endpoints:                                      │
│    GET  /api/health          Health check        │
│    POST /api/search          YouTube search      │
│    POST /api/info            Video info          │
│    POST /api/download        Queue download      │
│    POST /api/convert         Queue conversion    │
│    POST /api/tts             Queue text-to-speech│
│    GET  /api/jobs            List all jobs       │
│    GET  /api/jobs/:id        Get job status      │
│    DELETE /api/jobs/:id      Delete a job        │
│    GET  /api/plugins         List plugins        │
│    POST /api/metadata/embed  Embed metadata      │
│                                                  │
│  Press Ctrl+C to stop                            │
└──────────────────────────────────────────────────┘
`)
}

// Allow direct execution: bun run src/server.ts [--port N]
if (import.meta.main) {
  const args = process.argv.slice(2)
  const portIdx = args.indexOf("--port")
  const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1]) : 8384

  startServer(port)
}
