/**
 * Tapir Error Reporting Layer
 *
 * Surfaces errors differently depending on the runtime environment:
 *   - User mode: minimal, friendly messages with error codes only
 *   - Developer mode: detailed diagnostics with location, reason, and context
 *
 * Error Code Format: APP-<LAYER>-<CATEGORY>-<NUMBER>
 *   Layers:    FE (frontend), BE (backend), NET (network), SYS (system)
 *   Categories: AUTH, API, CONFIG, DATA, UI, NET, SYS
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorLayer = "FE" | "BE" | "NET" | "SYS"

export type ErrorCategory = "AUTH" | "API" | "CONFIG" | "DATA" | "UI" | "NET" | "SYS"

export interface ErrorReport {
  /** Stable error code, e.g. APP-BE-AUTH-401 */
  code: string
  /** HTTP status code or application-level status */
  status: number
  /** Minimal message safe for end users */
  userMessage: string
  /** Optional user-facing hint (non-technical) */
  userHint?: string
  /** Detailed reason (developer only) */
  reason: string
  /** Bullet-point details (developer only) */
  details: string[]
  /** Where the error occurred (developer only) */
  location: {
    service: string
    endpoint?: string
    layer: ErrorLayer
  }
  /** ISO timestamp */
  timestamp: string
}

export type ErrorMode = "user" | "developer"

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Detect the runtime mode from environment flags.
 * Defaults to "user" if unknown (never leak developer info).
 */
export function detectMode(): ErrorMode {
  const env = typeof process !== "undefined" ? process.env : {}
  if (env.NODE_ENV === "development") return "developer"
  if (env.DEV_MODE === "true" || env.DEV_MODE === "1") return "developer"
  if (env.DEBUG === "true" || env.DEBUG === "1") return "developer"
  if (env.TAPIR_DEBUG === "true" || env.TAPIR_DEBUG === "1") return "developer"
  return "user"
}

// ============================================================================
// Error Code Generation
// ============================================================================

/**
 * Generate a stable, readable error code.
 * Format: APP-<LAYER>-<CATEGORY>-<NUMBER>
 */
export function generateErrorCode(
  layer: ErrorLayer,
  category: ErrorCategory,
  status: number,
): string {
  return `APP-${layer}-${category}-${String(status).padStart(3, "0")}`
}

// ============================================================================
// Category Classification
// ============================================================================

/**
 * Classify an error into a category based on its HTTP status and context.
 */
export function classifyError(
  status: number,
  message: string,
): ErrorCategory {
  // Auth errors
  if (status === 401 || status === 403) return "AUTH"

  // Rate limiting / queue full
  if (status === 429) return "API"

  // Timeout / connectivity
  if (status === 408 || status === 504 || status === 0) return "NET"
  if (/timeout|ECONNREFUSED|ENOTFOUND|fetch failed|network/i.test(message)) return "NET"

  // Config issues
  if (/env|config|key|missing.*variable|setup/i.test(message)) return "CONFIG"

  // Data / validation
  if (status === 400 || status === 422) return "DATA"
  if (/invalid|validation|parse|missing.*field|unsupported/i.test(message)) return "DATA"

  // Not found (API routing)
  if (status === 404) return "API"

  // Conflict (e.g. cannot delete running job)
  if (status === 409) return "API"

  // Server errors
  if (status >= 500) return "SYS"

  return "SYS"
}

// ============================================================================
// User-Friendly Hints
// ============================================================================

const USER_HINTS: Record<ErrorCategory, string> = {
  AUTH: "Please check your credentials and try again.",
  API: "The service could not process your request. Please try again.",
  CONFIG: "There may be a configuration issue. Please contact support.",
  DATA: "Please check your input and try again.",
  UI: "Something went wrong with the display. Please refresh the page.",
  NET: "This may be a temporary connectivity issue. Please try again later.",
  SYS: "This may be a temporary issue. Please try again later.",
}

// ============================================================================
// Error Report Builder
// ============================================================================

/**
 * Build a complete ErrorReport from raw error data.
 * This is the core function -- all other helpers delegate here.
 */
export function buildErrorReport(opts: {
  status: number
  message: string
  layer: ErrorLayer
  service: string
  endpoint?: string
  details?: string[]
}): ErrorReport {
  const category = classifyError(opts.status, opts.message)
  const code = generateErrorCode(opts.layer, category, opts.status)

  return {
    code,
    status: opts.status,
    userMessage: "Something went wrong.",
    userHint: USER_HINTS[category],
    reason: opts.message,
    details: opts.details || [opts.message],
    location: {
      service: opts.service,
      endpoint: opts.endpoint,
      layer: opts.layer,
    },
    timestamp: new Date().toISOString(),
  }
}

// ============================================================================
// Output Formatters
// ============================================================================

/**
 * Format an ErrorReport for user mode (production).
 * Returns a minimal, safe JSON object.
 */
export function formatUserOutput(report: ErrorReport): Record<string, unknown> {
  return {
    error: report.userMessage,
    code: report.code,
    hint: report.userHint,
  }
}

/**
 * Format an ErrorReport for developer mode (development/debug).
 * Returns detailed diagnostics.
 */
export function formatDeveloperOutput(report: ErrorReport): Record<string, unknown> {
  return {
    error: report.reason,
    code: report.code,
    status: report.status,
    details: report.details,
    location: report.location,
    timestamp: report.timestamp,
  }
}

/**
 * Format an ErrorReport based on the current environment mode.
 */
export function formatErrorOutput(
  report: ErrorReport,
  mode?: ErrorMode,
): Record<string, unknown> {
  const resolved = mode ?? detectMode()
  return resolved === "developer"
    ? formatDeveloperOutput(report)
    : formatUserOutput(report)
}

// ============================================================================
// Silent Failure Detection
// ============================================================================

/**
 * Generate a silent failure report for operations that fail without
 * throwing an error. Call this when a function returns null/undefined
 * unexpectedly instead of a result.
 */
export function reportSilentFailure(
  service: string,
  endpoint?: string,
  context?: string,
): ErrorReport {
  return buildErrorReport({
    status: 0,
    message: context || "Operation completed without result or error",
    layer: "SYS",
    service,
    endpoint,
    details: [
      "Operation failed without throwing an error",
      "No result was returned",
      context || "Unknown context",
    ],
  })
}

// ============================================================================
// Convenience: Backend Error Reporter
// ============================================================================

/**
 * Create an error report for a backend API error.
 */
export function reportBackendError(
  status: number,
  message: string,
  endpoint: string,
  details?: string[],
): ErrorReport {
  return buildErrorReport({
    status,
    message,
    layer: "BE",
    service: "TapirAPI",
    endpoint,
    details,
  })
}

/**
 * Create an error report for a frontend/client-side error.
 */
export function reportFrontendError(
  status: number,
  message: string,
  service: string,
  endpoint?: string,
  details?: string[],
): ErrorReport {
  return buildErrorReport({
    status,
    message,
    layer: "FE",
    service,
    endpoint,
    details,
  })
}

/**
 * Create an error report for a network/connectivity error.
 */
export function reportNetworkError(
  message: string,
  endpoint: string,
  details?: string[],
): ErrorReport {
  return buildErrorReport({
    status: 0,
    message,
    layer: "NET",
    service: "Network",
    endpoint,
    details: details || [
      message,
      "Could not reach the backend service",
      "Check that the server is running and accessible",
    ],
  })
}
