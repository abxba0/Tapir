/**
 * Utility functions for the YT Video Downloader TUI
 */

import { $ } from "bun"
import { existsSync, mkdirSync, accessSync, constants, statSync, readdirSync, unlinkSync } from "fs"
import { homedir, tmpdir, platform } from "os"
import { join, isAbsolute, extname, basename } from "path"
import type { SupportedSites, AudioFormats, WhisperModels } from "./types"

// ============================================================================
// Constants
// ============================================================================

export const VERSION = "5.0.0"
export const VERSION_DATE = "2026-01-31"
export const SUBPROCESS_TIMEOUT = 120_000 // ms
export const DEFAULT_MAX_WORKERS = 3
export const MAX_WORKERS_LIMIT = 10

export const SUPPORTED_MEDIA_EXTENSIONS = {
  audio: [".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac", ".wma", ".opus"],
  video: [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v", ".ts"],
} as const

export const TRANSCRIPTION_FORMATS = ["txt", "srt", "vtt"] as const

// ============================================================================
// Site Detection
// ============================================================================

export function getSupportedSites(): SupportedSites {
  return {
    youtube: {
      name: "YouTube",
      description: "YouTube videos, playlists, and channels",
      example: "https://youtube.com/watch?v=VIDEO_ID",
    },
    vimeo: {
      name: "Vimeo",
      description: "Vimeo videos",
      example: "https://vimeo.com/VIDEO_ID",
    },
    soundcloud: {
      name: "SoundCloud",
      description: "SoundCloud tracks and playlists",
      example: "https://soundcloud.com/artist/track",
    },
    dailymotion: {
      name: "Dailymotion",
      description: "Dailymotion videos",
      example: "https://dailymotion.com/video/VIDEO_ID",
    },
    twitch: {
      name: "Twitch",
      description: "Twitch videos and clips",
      example: "https://twitch.tv/videos/VIDEO_ID",
    },
    bandcamp: {
      name: "Bandcamp",
      description: "Bandcamp tracks and albums",
      example: "https://artist.bandcamp.com/track/track-name",
    },
    tiktok: {
      name: "TikTok",
      description: "TikTok videos",
      example: "https://tiktok.com/@user/video/VIDEO_ID",
    },
    instagram: {
      name: "Instagram",
      description: "Instagram reels and videos",
      example: "https://instagram.com/reel/REEL_ID",
    },
    other: {
      name: "Other/Direct URL",
      description: "Any URL supported by yt-dlp (1800+ sites)",
      example: "https://example.com/video",
    },
  }
}

export function detectSite(url: string): string {
  try {
    const parsed = new URL(url.toLowerCase().startsWith("http") ? url.toLowerCase() : `https://${url.toLowerCase()}`)
    let hostname = parsed.hostname
    if (hostname.startsWith("www.")) hostname = hostname.slice(4)

    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be")
      return "youtube"
    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com"))
      return "vimeo"
    if (hostname === "soundcloud.com" || hostname.endsWith(".soundcloud.com"))
      return "soundcloud"
    if (hostname === "dailymotion.com" || hostname.endsWith(".dailymotion.com"))
      return "dailymotion"
    if (hostname === "twitch.tv" || hostname.endsWith(".twitch.tv"))
      return "twitch"
    if (hostname.endsWith(".bandcamp.com") || hostname === "bandcamp.com")
      return "bandcamp"
    if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com"))
      return "tiktok"
    if (hostname === "instagram.com" || hostname.endsWith(".instagram.com"))
      return "instagram"
    return "other"
  } catch {
    return "other"
  }
}

// ============================================================================
// URL Validation
// ============================================================================

export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("www.")) {
    if (!url.includes(".")) return false
  }
  return true
}

export function isValidYoutubeUrl(url: string): boolean {
  const patterns = [
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
    /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]{11}/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]{11}/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/(playlist\?list=|watch\?.*&list=)/,
    /^(https?:\/\/)?(www\.)?youtube\.com\/(channel\/|c\/|user\/|@)/,
  ]
  return patterns.some((p) => p.test(url))
}

// ============================================================================
// Formatting
// ============================================================================

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "Unknown"
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

export function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return "0B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(2)} ${units[i]}`
}

export function formatCount(count: number | undefined): string {
  if (!count) return "Unknown"
  return count.toLocaleString()
}

export function formatTimestampSrt(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`
}

export function formatTimestampVtt(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`
}

// ============================================================================
// File System Helpers
// ============================================================================

export function getDownloadDirectory(specifiedDir: string = "youtube_downloads"): string {
  const candidates: string[] = []

  if (isAbsolute(specifiedDir)) {
    candidates.push(specifiedDir)
  } else {
    candidates.push(join(homedir(), specifiedDir))
    candidates.push(join(process.cwd(), specifiedDir))
    candidates.push(join(tmpdir(), specifiedDir))
  }

  for (const dir of candidates) {
    try {
      mkdirSync(dir, { recursive: true })
      accessSync(dir, constants.W_OK)
      return dir
    } catch {
      continue
    }
  }

  const fallback = join(tmpdir(), "youtube_downloads")
  mkdirSync(fallback, { recursive: true })
  return fallback
}

export function isLocalMediaFile(path: string): boolean {
  try {
    if (!existsSync(path)) return false
    const ext = extname(path).toLowerCase()
    const allExts = [...SUPPORTED_MEDIA_EXTENSIONS.audio, ...SUPPORTED_MEDIA_EXTENSIONS.video]
    return allExts.includes(ext as any)
  } catch {
    return false
  }
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_")
}

// ============================================================================
// Dependency Checks
// ============================================================================

export async function checkYtDlp(): Promise<boolean> {
  try {
    const result = await $`yt-dlp --version`.quiet()
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function checkFfmpeg(): Promise<boolean> {
  try {
    const result = await $`ffmpeg -version`.quiet()
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function checkWhisper(): Promise<boolean> {
  try {
    const result = await $`whisper --help`.quiet()
    return result.exitCode === 0
  } catch {
    // Also check if the Python module is importable
    try {
      const result = await $`python3 -c "import whisper; print('ok')"`.quiet()
      return result.exitCode === 0
    } catch {
      return false
    }
  }
}

// ============================================================================
// Audio Format Definitions
// ============================================================================

export function getSupportedAudioFormats(): AudioFormats {
  return {
    mp3: { name: "MP3", description: "MPEG Audio Layer 3 (Lossy)", defaultBitrate: 192, codec: "libmp3lame" },
    aac: { name: "AAC", description: "Advanced Audio Coding (Lossy)", defaultBitrate: 192, codec: "aac" },
    m4a: { name: "M4A", description: "MPEG-4 Audio (AAC in M4A container)", defaultBitrate: 192, codec: "aac" },
    ogg: { name: "OGG", description: "Ogg Vorbis (Lossy)", defaultBitrate: 192, codec: "libvorbis" },
    wav: { name: "WAV", description: "Waveform Audio (Lossless)", defaultBitrate: 1411, codec: "pcm_s16le" },
    flac: { name: "FLAC", description: "Free Lossless Audio Codec", defaultBitrate: 1000, codec: "flac" },
  }
}

// ============================================================================
// Whisper Model Definitions
// ============================================================================

export function getWhisperModels(): WhisperModels {
  return {
    tiny: { name: "Tiny", description: "Fastest, lowest accuracy (~1GB VRAM)", sizeMb: 75 },
    base: { name: "Base", description: "Fast with decent accuracy (~1GB VRAM)", sizeMb: 142 },
    small: { name: "Small", description: "Good balance of speed and accuracy (~2GB VRAM)", sizeMb: 466 },
    medium: { name: "Medium", description: "High accuracy, slower (~5GB VRAM)", sizeMb: 1500 },
    large: { name: "Large", description: "Best accuracy, slowest (~10GB VRAM)", sizeMb: 2900 },
  }
}

// ============================================================================
// Subtitle Parsing
// ============================================================================

export function parseSubtitleToText(subtitleContent: string): string {
  const lines = subtitleContent.split("\n")
  const textLines: string[] = []

  for (let line of lines) {
    line = line.trim()
    if (!line) continue
    if (/^\d+$/.test(line)) continue
    if (line.startsWith("WEBVTT") || line.startsWith("Kind:") || line.startsWith("Language:")) continue
    if (line.includes("-->")) continue
    if (line.startsWith("NOTE") || line.startsWith("STYLE")) continue

    let cleaned = line.replace(/<[^>]+>/g, "")
    cleaned = cleaned.replace(/\{[^}]+\}/g, "")
    cleaned = cleaned.trim()

    if (cleaned) textLines.push(cleaned)
  }

  // Deduplicate consecutive lines
  const deduplicated: string[] = []
  for (const line of textLines) {
    if (deduplicated.length === 0 || line !== deduplicated[deduplicated.length - 1]) {
      deduplicated.push(line)
    }
  }

  return deduplicated.join(" ")
}
