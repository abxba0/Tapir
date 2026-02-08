/**
 * Type definitions for the Tapir TUI
 *
 * Re-exports all shared types from the shared module.
 * This maintains backward compatibility for all existing TUI imports.
 */

export type {
  SiteInfo,
  SupportedSites,
  VideoFormat,
  VideoInfo,
  SubtitleEntry,
  DownloadOptions,
  DownloadResult,
  DownloadProgress,
  SearchResult,
  FormatSelection,
  AudioFormatInfo,
  AudioFormats,
  AudioMetadata,
  ConversionOptions,
  WhisperModelSize,
  WhisperModelInfo,
  WhisperModels,
  TranscriptionSegment,
  TranscriptionResult,
  TranscriptionFormat,
  TranscriptionOptions,
  TTSEngine,
  TTSVoice,
  TTSOutputFormat,
  TTSOptions,
  TTSResult,
  AppScreen,
  AppState,
  QueuedJob,
  HealthResponse,
  JobResponse,
  JobListResponse,
} from "../../shared/types/index"
