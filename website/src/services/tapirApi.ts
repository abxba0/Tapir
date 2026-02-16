/**
 * Tapir API Client
 *
 * Communication layer with the Tapir backend REST API.
 * Uses the Error Reporting Layer for structured error handling.
 */

import { reportBackendError, logError } from './errorReporter';

// Determine API base URL - works in both local dev and Codespace environments
let API_BASE = process.env.NEXT_PUBLIC_TAPIR_API_URL;

if (!API_BASE) {
  if (typeof window !== 'undefined') {
    // Browser context - try to connect to backend on same host/origin, different port
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    API_BASE = `${protocol}//${hostname}:8384`;
  } else {
    // Server-side context (fallback)
    API_BASE = 'http://localhost:8384';
  }
}

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

// Simple cache for GET requests
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2000; // 2 seconds

/**
 * Cached fetch wrapper for GET requests
 */
async function cachedFetch(url: string, ttl: number = CACHE_TTL): Promise<any> {
  const now = Date.now();
  const cached = apiCache.get(url);
  
  if (cached && (now - cached.timestamp < ttl)) {
    return cached.data;
  }
  
  const response = await fetch(url, {
    keepalive: true,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }
  
  const data = await response.json();
  apiCache.set(url, { data, timestamp: now });
  
  return data;
}

/**
 * Download media from a URL
 */
export async function downloadMedia(options: DownloadOptions): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/api/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
    keepalive: true,
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
    keepalive: true,
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
    keepalive: true,
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
  return cachedFetch(`${API_BASE}/api/jobs/${jobId}`, 500);
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
  return cachedFetch(url, 1000);
}

/**
 * Delete a job
 */
export async function deleteJob(jobId: string): Promise<{ deleted: boolean }> {
  // Clear cache for this job
  apiCache.delete(`${API_BASE}/api/jobs/${jobId}`);
  
  const response = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
    method: 'DELETE',
    keepalive: true,
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
    keepalive: true,
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
    keepalive: true,
  });

  if (!response.ok) {
    await handleApiError(response, '/api/info', 'Failed to get video info');
  }

  return response.json();
}

/**
 * Get the URL to download a completed job's file
 */
export function getFileDownloadUrl(jobId: string): string {
  return `${API_BASE}/api/jobs/${jobId}/download`;
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<HealthCheckResponse> {
  return cachedFetch(`${API_BASE}/api/health`, 2000);
}
