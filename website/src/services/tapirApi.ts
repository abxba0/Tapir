/**
 * Tapir API Client
 * 
 * Communication layer with the Tapir backend REST API
 */

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
    const error = await response.json();
    throw new Error(error.error || 'Download request failed');
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
    const error = await response.json();
    throw new Error(error.error || 'Transcription request failed');
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
    const error = await response.json();
    throw new Error(error.error || 'TTS request failed');
  }

  return response.json();
}

/**
 * Get status of a specific job
 */
export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE}/api/jobs/${jobId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get job status');
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
    const error = await response.json();
    throw new Error(error.error || 'Failed to list jobs');
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
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete job');
  }

  return response.json();
}

/**
 * Search YouTube
 */
export async function searchYouTube(query: string, maxResults: number = 10): Promise<any> {
  const response = await fetch(`${API_BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Search failed');
  }

  return response.json();
}

/**
 * Get video info
 */
export async function getVideoInfo(url: string): Promise<any> {
  const response = await fetch(`${API_BASE}/api/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get video info');
  }

  return response.json();
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<any> {
  const response = await fetch(`${API_BASE}/api/health`);

  if (!response.ok) {
    throw new Error('API health check failed');
  }

  return response.json();
}
