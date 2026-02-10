/**
 * Tapir API Client
 *
 * Communication layer with the Tapir backend REST API.
 * Uses the Error Reporting Layer for structured error handling.
 */

import {
  reportApiError,
  reportBackendError,
  logError,
  type ErrorReport,
} from './errorReporter';

const API_BASE = process.env.NEXT_PUBLIC_TAPIR_API_URL || 'http://localhost:8384';

// ============================================================================
// Types
// ============================================================================

export interface DownloadOptions {
  url: string;
  format?: string;
  quality?: string;
  outputDir?: string;
  downloadSubs?: boolean;
  subLangs?: string;
  embedMetadata?: boolean;
  embedThumbnail?: boolean;
}

export interface TranscribeOptions {
  url?: string;
  filePath?: string;
  modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  outputFormat?: 'txt' | 'srt' | 'vtt';
  outputDir?: string;
  cookiesFile?: string;
  cookiesFromBrowser?: string;
}

export interface TtsOptions {
  inputFile: string;
  voice?: string;
  outputFormat?: 'mp3' | 'wav';
  outputDir?: string;
  engine?: 'edge-tts' | 'gtts' | 'espeak';
}

export interface JobStatus {
  id: string;
  type: 'download' | 'convert' | 'transcribe' | 'tts';
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  request: Record<string, unknown>;
  result?: Record<string, unknown>;
  progress?: {
    percent?: number;
    speed?: string;
    eta?: string;
  };
  error?: string;
}

export interface JobResponse {
  jobId: string;
  status: string;
}

export interface JobListResponse {
  jobs: JobStatus[];
  count: number;
}

export interface YouTubeSearchResult {
  results: Array<{
    id: string;
    title: string;
    channel: string;
    duration: string;
    views: string;
    url: string;
  }>;
  count: number;
}

export interface VideoInfo {
  info: {
    title?: string;
    channel?: string;
    duration?: number;
    description?: string;
    thumbnail?: string;
    formats?: Array<{
      format_id: string;
      ext: string;
      resolution?: string;
      filesize?: number;
    }>;
  };
}

export interface HealthCheckResponse {
  status: string;
  version: string;
  uptime: number;
  jobs: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
}

// ============================================================================
// Internal: structured error from API response
// ============================================================================

async function handleApiError(response: Response, endpoint: string, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await response.json();
    message = body.error || fallback;
  } catch {
    // Response body was not JSON
  }
  const report = reportBackendError(response.status, message, endpoint);
  logError(report);
  throw Object.assign(new Error(message), { errorReport: report });
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Download media from a URL
 */
export async function downloadMedia(options: DownloadOptions): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/api/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    await handleApiError(response, '/api/download', 'Download request failed');
  }

  return response.json();
}

/**
 * Transcribe video/audio from URL or file
 */
export async function transcribeMedia(options: TranscribeOptions): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/api/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    await handleApiError(response, '/api/transcribe', 'Transcription request failed');
  }

  return response.json();
}

/**
 * Convert text to speech
 */
export async function textToSpeech(options: TtsOptions): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    await handleApiError(response, '/api/tts', 'TTS request failed');
  }

  return response.json();
}

/**
 * Get status of a specific job
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE}/api/jobs/${jobId}`);

  if (!response.ok) {
    await handleApiError(response, `/api/jobs/${jobId}`, 'Failed to get job status');
  }

  return response.json();
}

/**
 * List all jobs with optional filters
 */
export async function listJobs(filters?: {
  status?: string;
  type?: string;
}): Promise<JobListResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.type) params.append('type', filters.type);

  const url = `${API_BASE}/api/jobs${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    await handleApiError(response, '/api/jobs', 'Failed to list jobs');
  }

  return response.json();
}

/**
 * Delete a job
 */
export async function deleteJob(jobId: string): Promise<{ deleted: boolean }> {
  const response = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    await handleApiError(response, `/api/jobs/${jobId}`, 'Failed to delete job');
  }

  return response.json();
}

/**
 * Search YouTube
 */
export async function searchYouTube(query: string, maxResults: number = 10): Promise<YouTubeSearchResult> {
  const response = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults }),
  });

  if (!response.ok) {
    await handleApiError(response, '/api/search', 'Search failed');
  }

  return response.json();
}

/**
 * Get video info
 */
export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const response = await fetch(`${API_BASE}/api/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    await handleApiError(response, '/api/info', 'Failed to get video info');
  }

  return response.json();
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<HealthCheckResponse> {
  const response = await fetch(`${API_BASE}/api/health`);

  if (!response.ok) {
    await handleApiError(response, '/api/health', 'API health check failed');
  }

  return response.json();
}
