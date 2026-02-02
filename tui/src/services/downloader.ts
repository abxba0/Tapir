/**
 * Video download service - wraps yt-dlp for multi-site video downloading
 *
 * Supports YouTube, Vimeo, SoundCloud, Instagram, TikTok, and 1800+ sites.
 */

import { $ } from "bun"
import { existsSync, readdirSync } from "fs"
import { join } from "path"
import type {
  VideoInfo,
  VideoFormat,
  DownloadOptions,
  DownloadResult,
  FormatSelection,
  DownloadProgress,
  SearchResult,
} from "../types"
import { getDownloadDirectory, SUBPROCESS_TIMEOUT } from "../utils"

// ============================================================================
// Video Info Extraction
// ============================================================================

/**
 * Fetch video/playlist information using yt-dlp (without downloading).
 */
export async function getVideoInfo(
  url: string,
  cookiesFile?: string,
  cookiesFromBrowser?: string,
): Promise<VideoInfo | null> {
  try {
    const args = ["yt-dlp", "--dump-json", "--no-download", "--no-warnings", "--quiet"]

    if (cookiesFile) args.push("--cookies", cookiesFile)
    if (cookiesFromBrowser) args.push("--cookies-from-browser", cookiesFromBrowser)

    args.push(url)

    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    })

    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) return null

    // yt-dlp may output multiple JSON objects for playlists (one per line)
    const lines = stdout.trim().split("\n")

    if (lines.length === 1) {
      return JSON.parse(lines[0]) as VideoInfo
    }

    // Multiple lines means playlist - parse each entry
    const entries: VideoInfo[] = []
    for (const line of lines) {
      if (line.trim()) {
        try {
          entries.push(JSON.parse(line) as VideoInfo)
        } catch {
          // skip malformed lines
        }
      }
    }

    if (entries.length > 0) {
      return {
        title: entries[0].title || "Playlist",
        _type: "playlist",
        entries,
        channel: entries[0].channel,
        uploader: entries[0].uploader,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * List available formats for a video URL.
 */
export async function listFormats(
  url: string,
  cookiesFile?: string,
  cookiesFromBrowser?: string,
): Promise<{ combined: VideoFormat[]; videoOnly: VideoFormat[]; audioOnly: VideoFormat[] } | null> {
  const info = await getVideoInfo(url, cookiesFile, cookiesFromBrowser)
  if (!info || !info.formats) return null

  const combined: VideoFormat[] = []
  const videoOnly: VideoFormat[] = []
  const audioOnly: VideoFormat[] = []

  for (const f of info.formats) {
    if (f.vcodec && f.vcodec !== "none" && f.acodec && f.acodec !== "none") {
      combined.push(f)
    } else if (f.vcodec && f.vcodec !== "none") {
      videoOnly.push(f)
    } else if (f.acodec && f.acodec !== "none") {
      audioOnly.push(f)
    }
  }

  // Sort by quality descending
  const sortByQuality = (a: VideoFormat, b: VideoFormat) => {
    const hDiff = (b.height || 0) - (a.height || 0)
    if (hDiff !== 0) return hDiff
    return (b.tbr || 0) - (a.tbr || 0)
  }

  combined.sort(sortByQuality)
  videoOnly.sort(sortByQuality)
  audioOnly.sort((a, b) => (b.tbr || 0) - (a.tbr || 0))

  return { combined, videoOnly, audioOnly }
}

// ============================================================================
// Download
// ============================================================================

/**
 * Download a video/audio with the specified format selection.
 */
export async function downloadVideo(options: DownloadOptions): Promise<DownloadResult> {
  const { url, format, outputDir, cookiesFile, cookiesFromBrowser, isPlaylist, archiveFile, downloadSubs, subLangs } = options
  const safeDir = getDownloadDirectory(outputDir)

  const outputTemplate = isPlaylist
    ? join(safeDir, "%(playlist_index)03d - %(title)s.%(ext)s")
    : join(safeDir, "%(title)s.%(ext)s")

  const args = ["yt-dlp", "--no-warnings", "-o", outputTemplate]

  // Subtitles
  if (downloadSubs) {
    args.push("--write-subs", "--write-auto-subs", "--sub-format", "srt")
    if (subLangs) {
      args.push("--sub-langs", subLangs)
    } else {
      args.push("--sub-langs", "en.*,en")
    }
  }

  // Cookies
  if (cookiesFile) args.push("--cookies", cookiesFile)
  if (cookiesFromBrowser) args.push("--cookies-from-browser", cookiesFromBrowser)

  // Archive
  if (archiveFile) {
    args.push("--download-archive", archiveFile)
  } else if (isPlaylist) {
    args.push("--download-archive", join(safeDir, ".yt-dlp-archive.txt"))
  }

  // Playlist error handling
  if (isPlaylist) args.push("--ignore-errors")

  // Format handling
  switch (format) {
    case "mp3":
      args.push("-f", "bestaudio/best")
      args.push("-x", "--audio-format", "mp3", "--audio-quality", "192K")
      break
    case "mp4":
      args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best")
      break
    case "high":
      args.push("-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4")
      break
    case "best":
      args.push("-f", "best")
      break
    case "bestvideo":
      args.push("-f", "bestvideo")
      break
    case "bestaudio":
      args.push("-f", "bestaudio")
      break
    default:
      args.push("-f", format)
      break
  }

  args.push(url)

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    })

    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode === 0) {
      return { url, success: true, message: "Download completed successfully", outputDir: safeDir }
    } else {
      return { url, success: false, message: stderr.trim() || "Download failed" }
    }
  } catch (err) {
    return { url, success: false, message: `Download error: ${err}` }
  }
}

/**
 * Download a video with progress reporting via callback.
 */
export async function downloadVideoWithProgress(
  options: DownloadOptions,
  onProgress: (progress: DownloadProgress) => void,
  onRawLine?: (line: string) => void,
): Promise<DownloadResult> {
  const { url, format, outputDir, cookiesFile, cookiesFromBrowser, isPlaylist, archiveFile, downloadSubs, subLangs } = options
  const safeDir = getDownloadDirectory(outputDir)

  const outputTemplate = isPlaylist
    ? join(safeDir, "%(playlist_index)03d - %(title)s.%(ext)s")
    : join(safeDir, "%(title)s.%(ext)s")

  const args = ["yt-dlp", "--newline", "--no-warnings", "-o", outputTemplate]

  // Subtitles
  if (downloadSubs) {
    args.push("--write-subs", "--write-auto-subs", "--sub-format", "srt")
    if (subLangs) {
      args.push("--sub-langs", subLangs)
    } else {
      args.push("--sub-langs", "en.*,en")
    }
  }

  if (cookiesFile) args.push("--cookies", cookiesFile)
  if (cookiesFromBrowser) args.push("--cookies-from-browser", cookiesFromBrowser)

  if (archiveFile) {
    args.push("--download-archive", archiveFile)
  } else if (isPlaylist) {
    args.push("--download-archive", join(safeDir, ".yt-dlp-archive.txt"))
  }

  if (isPlaylist) args.push("--ignore-errors")

  switch (format) {
    case "mp3":
      args.push("-f", "bestaudio/best", "-x", "--audio-format", "mp3", "--audio-quality", "192K")
      break
    case "mp4":
      args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best")
      break
    case "high":
      args.push("-f", "bestvideo+bestaudio/best", "--merge-output-format", "mp4")
      break
    case "best":
      args.push("-f", "best")
      break
    case "bestvideo":
      args.push("-f", "bestvideo")
      break
    case "bestaudio":
      args.push("-f", "bestaudio")
      break
    default:
      args.push("-f", format)
      break
  }

  args.push(url)

  try {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    })

    // Stream stdout line by line
    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.trim()) {
          if (onRawLine) onRawLine(line.trim())
          onProgress(parseProgressLine(line.trim()))
        }
      }
    }

    if (buffer.trim()) {
      if (onRawLine) onRawLine(buffer.trim())
      onProgress(parseProgressLine(buffer.trim()))
    }

    const exitCode = await proc.exited

    if (exitCode === 0) {
      return { url, success: true, message: "Download completed", outputDir: safeDir }
    } else {
      const stderr = await new Response(proc.stderr).text()
      return { url, success: false, message: stderr.trim() || "Download failed" }
    }
  } catch (err) {
    return { url, success: false, message: `Download error: ${err}` }
  }
}

/**
 * Download multiple URLs in parallel.
 */
export async function downloadParallel(
  urls: string[],
  format: FormatSelection,
  outputDir: string,
  maxWorkers: number = 4,
  cookiesFile?: string,
  cookiesFromBrowser?: string,
  archiveFile?: string,
): Promise<DownloadResult[]> {
  const { DEFAULT_MAX_WORKERS } = await import("../utils")
  const workers = Math.min(Math.max(1, maxWorkers), MAX_WORKERS_LIMIT)
  const results: DownloadResult[] = []

  // Process in batches
  for (let i = 0; i < urls.length; i += workers) {
    const batch = urls.slice(i, i + workers)
    const promises = batch.map((url) =>
      downloadVideo({
        url,
        format,
        outputDir,
        cookiesFile,
        cookiesFromBrowser,
        archiveFile,
      }),
    )
    const batchResults = await Promise.all(promises)
    results.push(...batchResults)
  }

  return results
}

const MAX_WORKERS_LIMIT = 10

// ============================================================================
// Progress Parsing
// ============================================================================

/**
 * Parse a yt-dlp output line into structured progress data.
 *
 * yt-dlp progress lines look like:
 *   [download]  45.2% of  120.50MiB at  5.23MiB/s ETA 00:12
 *   [download] 100% of  120.50MiB in 00:23
 *   [download] Destination: /path/to/file.mp4
 *   [Merger] Merging formats into "/path/to/file.mp4"
 */
export function parseProgressLine(line: string): DownloadProgress {
  // Percentage + size + speed + ETA
  const progressMatch = line.match(
    /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\s*\S+)\s+at\s+([\d.]+\s*\S+\/s)\s+ETA\s+(\S+)/,
  )
  if (progressMatch) {
    return {
      phase: "downloading",
      percent: parseFloat(progressMatch[1]),
      totalSize: progressMatch[2].trim(),
      speed: progressMatch[3].trim(),
      eta: progressMatch[4].trim(),
      raw: line,
    }
  }

  // 100% completed line
  const doneMatch = line.match(/\[download\]\s+100%\s+of\s+~?([\d.]+\s*\S+)/)
  if (doneMatch) {
    return {
      phase: "downloading",
      percent: 100,
      totalSize: doneMatch[1].trim(),
      speed: "",
      eta: "00:00",
      raw: line,
    }
  }

  // Destination line
  if (line.includes("[download] Destination:")) {
    return { phase: "downloading", percent: 0, raw: line }
  }

  // Merging
  if (line.includes("[Merger]") || line.includes("Merging formats")) {
    return { phase: "merging", percent: 100, raw: line }
  }

  // Extracting audio
  if (line.includes("[ExtractAudio]") || line.includes("Post-process")) {
    return { phase: "post_processing", percent: 100, raw: line }
  }

  // Writing subtitles
  if (line.includes("[info] Writing video subtitles") || line.includes("[download] Writing video subtitles")) {
    return { phase: "subtitles", percent: 100, raw: line }
  }

  // Already downloaded
  if (line.includes("has already been downloaded")) {
    return { phase: "done", percent: 100, raw: line }
  }

  return { phase: "downloading", percent: -1, raw: line }
}

// ============================================================================
// YouTube Search
// ============================================================================

/**
 * Search YouTube using yt-dlp's ytsearch extractor.
 */
export async function searchYouTube(
  query: string,
  maxResults: number = 10,
): Promise<SearchResult[]> {
  try {
    const args = [
      "yt-dlp",
      "--dump-json",
      "--no-download",
      "--no-warnings",
      "--flat-playlist",
      "--quiet",
      `ytsearch${maxResults}:${query}`,
    ]

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) return []

    const results: SearchResult[] = []
    for (const line of stdout.trim().split("\n")) {
      if (!line.trim()) continue
      try {
        const data = JSON.parse(line)
        results.push({
          id: data.id || "",
          title: data.title || "Unknown",
          url: data.url || data.webpage_url || `https://www.youtube.com/watch?v=${data.id}`,
          channel: data.channel || data.uploader || "Unknown",
          duration: data.duration || 0,
          viewCount: data.view_count || 0,
          description: data.description || "",
        })
      } catch {
        // skip malformed lines
      }
    }

    return results
  } catch {
    return []
  }
}
