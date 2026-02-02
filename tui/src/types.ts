/**
 * Type definitions for the Tapir TUI
 */

// ============================================================================
// Video/Download Types
// ============================================================================

export interface SiteInfo {
  name: string
  description: string
  example: string
}

export interface SupportedSites {
  [key: string]: SiteInfo
}

export interface VideoFormat {
  format_id: string
  ext: string
  height?: number
  width?: number
  filesize?: number
  filesize_approx?: number
  tbr?: number
  abr?: number
  vcodec?: string
  acodec?: string
  format_note?: string
}

export interface VideoInfo {
  title: string
  channel?: string
  uploader?: string
  duration?: number
  upload_date?: string
  view_count?: number
  description?: string
  formats?: VideoFormat[]
  _type?: string
  entries?: VideoInfo[]
  subtitles?: Record<string, SubtitleEntry[]>
  automatic_captions?: Record<string, SubtitleEntry[]>
  ext?: string
}

export interface SubtitleEntry {
  ext: string
  url: string
  name?: string
}

export interface DownloadOptions {
  url: string
  format: string
  outputDir: string
  cookiesFile?: string
  cookiesFromBrowser?: string
  isPlaylist?: boolean
  archiveFile?: string
  downloadSubs?: boolean
  subLangs?: string
}

export interface DownloadResult {
  url: string
  success: boolean
  message: string
  outputDir?: string
}

export interface DownloadProgress {
  phase: "downloading" | "merging" | "post_processing" | "subtitles" | "done"
  percent: number
  totalSize?: string
  speed?: string
  eta?: string
  raw: string
}

export interface SearchResult {
  id: string
  title: string
  url: string
  channel: string
  duration: number
  viewCount: number
  description: string
}

export type FormatSelection =
  | "best"
  | "bestvideo"
  | "bestaudio"
  | "high"
  | "mp3"
  | "mp4"
  | string

// ============================================================================
// Audio Conversion Types
// ============================================================================

export interface AudioFormatInfo {
  name: string
  description: string
  defaultBitrate: number
  codec: string
}

export interface AudioFormats {
  [key: string]: AudioFormatInfo
}

export interface AudioMetadata {
  format?: {
    size?: string
    duration?: string
    bit_rate?: string
  }
  streams?: Array<{
    codec_type?: string
    bit_rate?: string
  }>
}

export interface ConversionOptions {
  inputFile: string
  outputFormat: string
  bitrate?: number
}

// ============================================================================
// Transcription Types
// ============================================================================

export type WhisperModelSize = "tiny" | "base" | "small" | "medium" | "large"

export interface WhisperModelInfo {
  name: string
  description: string
  sizeMb: number
}

export interface WhisperModels {
  [key: string]: WhisperModelInfo
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
  language?: string
}

export type TranscriptionFormat = "txt" | "srt" | "vtt"

export interface TranscriptionOptions {
  source: string
  language?: string
  modelSize?: WhisperModelSize
  outputFormat?: TranscriptionFormat
  outputDir?: string
  cookiesFile?: string
  cookiesFromBrowser?: string
}

// ============================================================================
// Application State
// ============================================================================

export type AppScreen =
  | "main_menu"
  | "setup"
  | "search"
  | "download"
  | "download_progress"
  | "audio_convert"
  | "transcribe"
  | "settings"
  | "batch"
  | "playlist_browse"
  | "exit"

export interface AppState {
  currentScreen: AppScreen
  ffmpegInstalled: boolean
  ytDlpInstalled: boolean
  whisperAvailable: boolean
  outputDir: string
  statusMessage: string
  isProcessing: boolean
}
