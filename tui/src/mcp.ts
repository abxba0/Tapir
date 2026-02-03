/**
 * Tapir MCP Server - Model Context Protocol server for AI agent interaction
 *
 * Implements the MCP protocol over stdio so AI agents (Claude, etc.) can:
 *   - Search YouTube
 *   - Download videos/audio
 *   - Convert audio formats
 *   - Transcribe media
 *   - Check job status
 *   - Embed metadata
 *
 * Usage:
 *   bun run src/mcp.ts                   # Start MCP server on stdio
 *   bun run src/index.ts --mcp           # Start from main entry point
 *
 * MCP Protocol:
 *   Communication happens via JSON-RPC 2.0 over stdin/stdout.
 *   Each message is a single line of JSON.
 */

import { VERSION, validateFilePath, isSafeUrl, isSafeFetchUrl } from "./utils"
import {
  getVideoInfo,
  downloadVideo,
  searchYouTube,
  listFormats,
} from "./services/downloader"
import { convertAudioFile } from "./services/converter"
import { textToSpeech, listVoices } from "./services/tts"
import {
  embedMetadata,
  extractMetadata,
  findLatestFile,
} from "./services/metadata"
import {
  runHook,
  ensurePluginDirs,
  getPluginSummary,
} from "./services/plugins"
import type { VideoInfo } from "./types"

// ============================================================================
// JSON-RPC / MCP Types
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: "2.0"
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}

// ============================================================================
// MCP Tool Definitions
// ============================================================================

const MCP_TOOLS: McpTool[] = [
  {
    name: "search_youtube",
    description: "Search YouTube for videos. Returns a list of results with titles, URLs, channels, durations, and view counts.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string" },
        max_results: { type: "number", description: "Maximum number of results (default: 10, max: 25)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_video_info",
    description: "Get detailed information about a video URL including title, channel, duration, available formats, and subtitle availability.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Video URL (YouTube, Vimeo, Instagram, TikTok, etc.)" },
      },
      required: ["url"],
    },
  },
  {
    name: "download_video",
    description: "Download a video or audio from a URL. Supports YouTube, Instagram, TikTok, Vimeo, and 1800+ sites. Optionally embeds metadata and downloads subtitles.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Video URL to download" },
        format: {
          type: "string",
          description: "Format: 'best', 'mp4', 'mp3', 'high', 'bestvideo', 'bestaudio', or a specific format_id",
        },
        output_dir: { type: "string", description: "Output directory (default: youtube_downloads)" },
        download_subs: { type: "boolean", description: "Download subtitles alongside video" },
        sub_langs: { type: "string", description: "Subtitle languages, comma-separated (default: en)" },
        embed_metadata: { type: "boolean", description: "Embed title/artist/thumbnail metadata (default: true)" },
        embed_thumbnail: { type: "boolean", description: "Embed thumbnail as cover art (default: true)" },
      },
      required: ["url"],
    },
  },
  {
    name: "convert_audio",
    description: "Convert an audio file to a different format. Supported formats: mp3, aac, m4a, ogg, wav, flac.",
    inputSchema: {
      type: "object",
      properties: {
        input_file: { type: "string", description: "Path to the input audio file" },
        output_format: { type: "string", description: "Target format: mp3, aac, m4a, ogg, wav, flac" },
        bitrate: { type: "number", description: "Target bitrate in kbps (default depends on format)" },
      },
      required: ["input_file", "output_format"],
    },
  },
  {
    name: "embed_metadata",
    description: "Embed metadata (title, artist, thumbnail) into a media file. Supports MP4, MP3, M4A, MKV.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Path to the media file" },
        title: { type: "string", description: "Track/video title" },
        artist: { type: "string", description: "Artist or channel name" },
        album: { type: "string", description: "Album name" },
        date: { type: "string", description: "Release date (YYYY-MM-DD)" },
        thumbnail_url: { type: "string", description: "URL to thumbnail image to embed as cover art" },
      },
      required: ["file"],
    },
  },
  {
    name: "text_to_speech",
    description: "Convert a document file (PDF, TXT, MD, HTML, etc.) to speech audio using TTS. Supports edge-tts, gtts, and espeak engines with multiple voices and languages.",
    inputSchema: {
      type: "object",
      properties: {
        input_file: { type: "string", description: "Path to the document file (PDF, TXT, MD, HTML, CSV, etc.)" },
        voice: { type: "string", description: "Voice ID (e.g., 'en-US-AriaNeural' for edge-tts, 'en' for gtts/espeak)" },
        output_format: { type: "string", description: "Output audio format: 'mp3' (default) or 'wav'" },
        output_dir: { type: "string", description: "Output directory (default: youtube_downloads)" },
        engine: { type: "string", description: "TTS engine: 'edge-tts', 'gtts', or 'espeak' (auto-detected if omitted)" },
      },
      required: ["input_file"],
    },
  },
  {
    name: "list_plugins",
    description: "List all installed Tapir plugins and their hook points (post-download, post-convert, post-transcribe).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
]

// ============================================================================
// Tool execution
// ============================================================================

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    switch (name) {
      case "search_youtube": {
        const query = args.query as string
        const maxResults = Math.min((args.max_results as number) || 10, 25)
        const results = await searchYouTube(query, maxResults)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  query,
                  count: results.length,
                  results: results.map((r) => ({
                    title: r.title,
                    url: r.url,
                    channel: r.channel,
                    duration_seconds: r.duration,
                    view_count: r.viewCount,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        }
      }

      case "get_video_info": {
        const url = args.url as string
        if (!isSafeUrl(url)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "URL scheme not allowed" }) }] }
        }
        const info = await getVideoInfo(url)

        if (!info) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Failed to fetch video info" }) }],
          }
        }

        const formatList = await listFormats(url)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  title: info.title,
                  channel: info.channel || info.uploader,
                  duration: info.duration,
                  upload_date: info.upload_date,
                  view_count: info.view_count,
                  description: info.description?.slice(0, 500),
                  has_subtitles: !!(info.subtitles && Object.keys(info.subtitles).length > 0),
                  has_auto_captions: !!(info.automatic_captions && Object.keys(info.automatic_captions).length > 0),
                  format_count: formatList
                    ? formatList.combined.length + formatList.videoOnly.length + formatList.audioOnly.length
                    : 0,
                },
                null,
                2,
              ),
            },
          ],
        }
      }

      case "download_video": {
        const url = args.url as string
        if (!isSafeUrl(url)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "URL scheme not allowed" }) }] }
        }
        const format = (args.format as string) || "best"
        const outputDir = (args.output_dir as string) || "youtube_downloads"
        const downloadSubs = args.download_subs as boolean | undefined
        const subLangs = args.sub_langs as string | undefined
        const doEmbedMetadata = args.embed_metadata !== false
        const doEmbedThumbnail = args.embed_thumbnail !== false

        // Fetch info for metadata
        const info = await getVideoInfo(url)

        const result = await downloadVideo({
          url,
          format,
          outputDir,
          downloadSubs,
          subLangs,
        })

        const response: Record<string, unknown> = { ...result }

        const latestFile = (result.success && result.outputDir) ? findLatestFile(result.outputDir) : null

        if (latestFile && doEmbedMetadata && info) {
          const meta = extractMetadata(info, url)
          const embedResult = await embedMetadata(latestFile, meta, {
            embedThumbnail: doEmbedThumbnail,
          })
          response.metadata_embed = embedResult
        }

        // Run post-download plugins
        if (result.success && result.outputDir) {
          const pluginResults = await runHook("post-download", {
            file: latestFile || undefined,
            title: info?.title,
            url,
            format,
            outputDir: result.outputDir,
            success: true,
          })
          if (pluginResults.length > 0) {
            response.plugins = pluginResults
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        }
      }

      case "convert_audio": {
        const inputFile = args.input_file as string
        if (!validateFilePath(inputFile)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid or inaccessible file path" }) }] }
        }
        const outputFormat = args.output_format as string
        const bitrate = args.bitrate as number | undefined

        const messages: string[] = []
        const outputFile = await convertAudioFile(
          { inputFile, outputFormat, bitrate },
          (msg) => messages.push(msg),
        )

        const response: Record<string, unknown> = {
          success: !!outputFile,
          outputFile,
          messages,
        }

        // Run post-convert plugins
        if (outputFile) {
          const pluginResults = await runHook("post-convert", {
            file: outputFile,
            format: outputFormat,
            success: true,
          })
          if (pluginResults.length > 0) {
            response.plugins = pluginResults
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
        }
      }

      case "embed_metadata": {
        const file = args.file as string
        if (!validateFilePath(file)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid or inaccessible file path" }) }] }
        }
        if (args.thumbnail_url && !isSafeFetchUrl(args.thumbnail_url as string)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Thumbnail URL not allowed" }) }] }
        }
        const result = await embedMetadata(
          file,
          {
            title: args.title as string | undefined,
            artist: args.artist as string | undefined,
            album: args.album as string | undefined,
            date: args.date as string | undefined,
            thumbnailUrl: args.thumbnail_url as string | undefined,
          },
          { embedThumbnail: !!args.thumbnail_url },
        )

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        }
      }

      case "text_to_speech": {
        const inputFile = args.input_file as string
        if (!validateFilePath(inputFile)) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "Invalid or inaccessible file path" }) }] }
        }
        const voice = args.voice as string | undefined
        const outputFormat = (args.output_format as "mp3" | "wav") || "mp3"
        const outputDir = (args.output_dir as string) || "youtube_downloads"
        const engine = args.engine as string | undefined

        const messages: string[] = []
        const result = await textToSpeech(
          {
            inputFile,
            voice,
            outputFormat,
            outputDir,
            engine: engine as any,
          },
          (msg) => messages.push(msg),
        )

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...result, log: messages }, null, 2),
            },
          ],
        }
      }

      case "list_plugins": {
        ensurePluginDirs()
        const summary = getPluginSummary()
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  plugins_dir: "~/.config/tapir/plugins/",
                  hooks: summary,
                },
                null,
                2,
              ),
            },
          ],
        }
      }

      default:
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        }
    }
  } catch (err: any) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: err.message || String(err) }),
        },
      ],
    }
  }
}

// ============================================================================
// MCP Protocol Handler
// ============================================================================

function makeResponse(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result }
}

function makeError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

async function handleMessage(msg: JsonRpcRequest): Promise<JsonRpcResponse> {
  switch (msg.method) {
    case "initialize":
      return makeResponse(msg.id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "tapir",
          version: VERSION,
        },
      })

    case "notifications/initialized":
      // Client acknowledgement - no response needed for notifications
      // but we return a response to keep the protocol happy
      return makeResponse(msg.id, {})

    case "tools/list":
      return makeResponse(msg.id, { tools: MCP_TOOLS })

    case "tools/call": {
      const toolName = msg.params?.name as string
      const toolArgs = (msg.params?.arguments || {}) as Record<string, unknown>

      if (!toolName) {
        return makeError(msg.id, -32602, "Missing tool name")
      }

      const tool = MCP_TOOLS.find((t) => t.name === toolName)
      if (!tool) {
        return makeError(msg.id, -32602, `Unknown tool: ${toolName}`)
      }

      const result = await executeTool(toolName, toolArgs)
      return makeResponse(msg.id, result)
    }

    case "ping":
      return makeResponse(msg.id, {})

    default:
      return makeError(msg.id, -32601, `Unknown method: ${msg.method}`)
  }
}

// ============================================================================
// Stdio Transport
// ============================================================================

function send(response: JsonRpcResponse): void {
  const json = JSON.stringify(response)
  process.stdout.write(json + "\n")
}

export async function startMcpServer(): Promise<void> {
  ensurePluginDirs()

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  process.stderr.write(`Tapir MCP Server v${VERSION} started\n`)

  const reader = Bun.stdin.stream().getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete lines
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const raw = JSON.parse(trimmed) as Record<string, unknown>

        // Notifications don't have an id field
        if (!("id" in raw) || raw.id === undefined) {
          // Still process it (e.g. notifications/initialized)
          if (raw.method) {
            await handleMessage({
              jsonrpc: "2.0",
              id: 0,
              method: raw.method as string,
              params: raw.params as Record<string, unknown> | undefined,
            })
          }
          continue
        }

        const msg: JsonRpcRequest = {
          jsonrpc: "2.0",
          id: raw.id as string | number,
          method: raw.method as string,
          params: raw.params as Record<string, unknown> | undefined,
        }

        const response = await handleMessage(msg)
        send(response)
      } catch (err: any) {
        send(makeError(null, -32700, `Parse error: ${err.message}`))
      }
    }
  }
}

// Allow direct execution
if (import.meta.main) {
  startMcpServer().catch((err) => {
    process.stderr.write(`MCP server error: ${err}\n`)
    process.exit(1)
  })
}
