/**
 * Metadata embedding service - Write video title, artist, thumbnail,
 * and other metadata as ID3 (MP3) or MP4 tags into downloaded files.
 *
 * Uses ffmpeg for all tag writing so no additional dependencies are needed.
 */

import { existsSync, unlinkSync, renameSync, writeFileSync, readdirSync, statSync } from "fs"
import { join, dirname, basename, extname } from "path"
import { tmpdir } from "os"
import type { VideoInfo } from "../types"
import { SUBPROCESS_TIMEOUT, withSubprocessTimeout } from "../utils"

// ============================================================================
// Types
// ============================================================================

export interface MediaMetadata {
  title?: string
  artist?: string
  album?: string
  date?: string
  description?: string
  comment?: string
  url?: string
  thumbnailUrl?: string
}

export interface EmbedResult {
  success: boolean
  message: string
  file: string
}

// ============================================================================
// Extract metadata from VideoInfo
// ============================================================================

/**
 * Build a MediaMetadata object from yt-dlp VideoInfo.
 */
export function extractMetadata(info: VideoInfo, sourceUrl?: string): MediaMetadata {
  return {
    title: info.title,
    artist: info.channel || info.uploader,
    date: info.upload_date
      ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}`
      : undefined,
    description: info.description?.slice(0, 1000),
    comment: info.description?.slice(0, 500),
    url: sourceUrl,
    thumbnailUrl: (info as any).thumbnail,
  }
}

// ============================================================================
// Thumbnail download
// ============================================================================

/**
 * Download a thumbnail image to a temporary file.
 * Returns the path to the temp file, or null on failure.
 */
async function downloadThumbnail(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const contentType = response.headers.get("content-type") || ""
    let ext = ".jpg"
    if (contentType.includes("png")) ext = ".png"
    else if (contentType.includes("webp")) ext = ".webp"

    const tmpPath = join(tmpdir(), `tapir-thumb-${Date.now()}${ext}`)
    const buffer = await response.arrayBuffer()
    writeFileSync(tmpPath, Buffer.from(buffer))

    return tmpPath
  } catch {
    return null
  }
}

/**
 * Convert a webp thumbnail to jpg using ffmpeg (some containers don't support webp).
 */
async function convertThumbnailToJpg(thumbPath: string): Promise<string | null> {
  if (!thumbPath.endsWith(".webp")) return thumbPath

  const jpgPath = thumbPath.replace(".webp", ".jpg")
  try {
    const proc = Bun.spawn(
      ["ffmpeg", "-y", "-i", thumbPath, "-q:v", "2", jpgPath],
      { stdout: "pipe", stderr: "pipe" },
    )
    const exitCode = await withSubprocessTimeout(proc, SUBPROCESS_TIMEOUT)
    if (exitCode === 0) {
      try { unlinkSync(thumbPath) } catch { /* ignore */ }
      return jpgPath
    }
    return null
  } catch {
    return null
  }
}

// ============================================================================
// Metadata embedding
// ============================================================================

/**
 * Build ffmpeg metadata arguments from MediaMetadata.
 */
function buildMetadataArgs(meta: MediaMetadata): string[] {
  const args: string[] = []

  if (meta.title) {
    args.push("-metadata", `title=${meta.title}`)
  }
  if (meta.artist) {
    args.push("-metadata", `artist=${meta.artist}`)
    args.push("-metadata", `album_artist=${meta.artist}`)
  }
  if (meta.album) {
    args.push("-metadata", `album=${meta.album}`)
  }
  if (meta.date) {
    args.push("-metadata", `date=${meta.date}`)
    args.push("-metadata", `year=${meta.date.slice(0, 4)}`)
  }
  if (meta.comment) {
    args.push("-metadata", `comment=${meta.comment}`)
  }
  if (meta.url) {
    args.push("-metadata", `purl=${meta.url}`)
  }

  return args
}

/**
 * Embed metadata (and optionally thumbnail) into a media file.
 *
 * Supported containers: mp4, m4a, mp3, mkv, ogg, flac, webm
 *
 * The operation is done in-place by writing to a temp file then replacing.
 */
export async function embedMetadata(
  filePath: string,
  meta: MediaMetadata,
  options: { embedThumbnail?: boolean } = {},
): Promise<EmbedResult> {
  if (!existsSync(filePath)) {
    return { success: false, message: `File not found: ${filePath}`, file: filePath }
  }

  const ext = extname(filePath).toLowerCase()
  const dir = dirname(filePath)
  const base = basename(filePath)
  const tmpOutput = join(dir, `.tapir-meta-${Date.now()}-${base}`)

  let thumbPath: string | null = null

  try {
    // Download thumbnail if requested
    if (options.embedThumbnail && meta.thumbnailUrl) {
      thumbPath = await downloadThumbnail(meta.thumbnailUrl)
      if (thumbPath) {
        thumbPath = await convertThumbnailToJpg(thumbPath) || thumbPath
      }
    }

    const metaArgs = buildMetadataArgs(meta)

    // No metadata to write
    if (metaArgs.length === 0 && !thumbPath) {
      return { success: true, message: "No metadata to embed", file: filePath }
    }

    // Build ffmpeg command
    const args: string[] = ["ffmpeg", "-y", "-i", filePath]

    // For thumbnail embedding
    if (thumbPath && [".mp4", ".m4a", ".mp3", ".mkv"].includes(ext)) {
      args.push("-i", thumbPath)
    }

    // Copy all existing streams
    args.push("-map", "0")

    // Map thumbnail as cover art
    if (thumbPath && [".mp4", ".m4a", ".mp3", ".mkv"].includes(ext)) {
      args.push("-map", "1")
    }

    // Copy codecs (no re-encoding)
    args.push("-c", "copy")

    // Add metadata args
    args.push(...metaArgs)

    // Thumbnail disposition based on container
    if (thumbPath) {
      if ([".mp4", ".m4a"].includes(ext)) {
        // MP4/M4A: set cover art disposition
        args.push("-disposition:v:0", "attached_pic")
      } else if (ext === ".mp3") {
        // MP3: set as attached picture for ID3
        args.push("-id3v2_version", "3")
        args.push("-disposition:v:0", "attached_pic")
      } else if (ext === ".mkv") {
        args.push("-disposition:v:1", "attached_pic")
      }
    }

    args.push(tmpOutput)

    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    })

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await withSubprocessTimeout(proc, SUBPROCESS_TIMEOUT)

    if (exitCode === 0 && existsSync(tmpOutput)) {
      // Replace original with tagged version
      unlinkSync(filePath)
      renameSync(tmpOutput, filePath)

      const parts: string[] = ["Metadata embedded"]
      if (meta.title) parts.push(`title="${meta.title}"`)
      if (meta.artist) parts.push(`artist="${meta.artist}"`)
      if (thumbPath) parts.push("+ thumbnail")

      return { success: true, message: parts.join(", "), file: filePath }
    } else {
      // Clean up temp file on failure
      try { if (existsSync(tmpOutput)) unlinkSync(tmpOutput) } catch { /* ignore */ }
      return {
        success: false,
        message: `ffmpeg failed: ${stderr.slice(0, 200)}`,
        file: filePath,
      }
    }
  } catch (err: any) {
    // Clean up temp file on error
    try { if (existsSync(tmpOutput)) unlinkSync(tmpOutput) } catch { /* ignore */ }
    return {
      success: false,
      message: `Metadata embedding error: ${err.message || err}`,
      file: filePath,
    }
  } finally {
    // Clean up thumbnail temp file
    if (thumbPath) {
      try { unlinkSync(thumbPath) } catch { /* ignore */ }
    }
  }
}

/**
 * Embed metadata into all files in a directory that match a pattern.
 * Useful for playlist downloads.
 */
export async function embedMetadataInDir(
  dir: string,
  meta: MediaMetadata,
  options: { embedThumbnail?: boolean; extensions?: string[] } = {},
): Promise<EmbedResult[]> {
  const extensions = options.extensions || [".mp4", ".mp3", ".m4a", ".mkv", ".webm", ".ogg", ".flac"]
  const results: EmbedResult[] = []

  try {
    const files = readdirSync(dir)
    for (const file of files) {
      const ext = extname(file).toLowerCase()
      if (!extensions.includes(ext)) continue
      if (file.startsWith(".tapir-meta-")) continue

      const fullPath = join(dir, file)
      const result = await embedMetadata(fullPath, meta, options)
      results.push(result)
    }
  } catch {
    // Directory read error
  }

  return results
}

/**
 * Find the most recently downloaded file in a directory (for post-download embedding).
 */
export function findLatestFile(dir: string, extensions?: string[]): string | null {
  const exts = extensions || [".mp4", ".mp3", ".m4a", ".mkv", ".webm", ".ogg", ".flac", ".wav"]

  try {
    const files = readdirSync(dir) as string[]
    let latestPath: string | null = null
    let latestTime = 0

    for (const file of files) {
      const ext = extname(file).toLowerCase()
      if (!exts.includes(ext)) continue
      if (file.startsWith(".")) continue

      const fullPath = join(dir, file)
      try {
        const stat = statSync(fullPath)
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs
          latestPath = fullPath
        }
      } catch {
        continue
      }
    }

    return latestPath
  } catch {
    return null
  }
}
