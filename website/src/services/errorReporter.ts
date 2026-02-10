/**
 * Tapir Frontend Error Reporting Layer
 *
 * Surfaces errors differently based on runtime environment:
 *   - User mode (production): minimal message + error code only
 *   - Developer mode (development): detailed diagnostics
 *
 * Error Code Format: APP-<LAYER>-<CATEGORY>-<NUMBER>
 */

// ============================================================================
// Types
// ============================================================================

type ErrorLayer = "FE" | "BE" | "NET" | "SYS"
type ErrorCategory = "AUTH" | "API" | "CONFIG" | "DATA" | "UI" | "NET" | "SYS"
type ErrorMode = "user" | "developer"

export interface ErrorReport {
  code: string;
  status: number;
  userMessage: string;
  userHint?: string;
  reason: string;
  details: string[];
  location: {
    service: string;
    endpoint?: string;
    layer: ErrorLayer;
  };
  timestamp: string;
}

/** User-mode output (production) */
export interface UserErrorOutput {
  error: string;
  code: string;
  hint?: string;
}

/** Developer-mode output (development) */
export interface DeveloperErrorOutput {
  error: string;
  code: string;
  status: number;
  details: string[];
  location: {
    service: string;
    endpoint?: string;
    layer: ErrorLayer;
  };
  timestamp: string;
}

// ============================================================================
// Environment Detection
// ============================================================================

function detectMode(): ErrorMode {
  if (process.env.NODE_ENV === "development") return "developer";
  if (process.env.NEXT_PUBLIC_DEBUG === "true") return "developer";
  return "user";
}

// ============================================================================
// Error Code Generation
// ============================================================================

function generateErrorCode(
  layer: ErrorLayer,
  category: ErrorCategory,
  status: number,
): string {
  return `APP-${layer}-${category}-${String(status).padStart(3, "0")}`;
}

// ============================================================================
// Category Classification
// ============================================================================

function classifyError(status: number, message: string): ErrorCategory {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429) return "API";
  if (status === 408 || status === 504 || status === 0) return "NET";
  if (/timeout|ECONNREFUSED|ENOTFOUND|fetch failed|network|Failed to fetch/i.test(message)) return "NET";
  if (/env|config|key|missing.*variable|setup/i.test(message)) return "CONFIG";
  if (status === 400 || status === 422) return "DATA";
  if (/invalid|validation|parse|missing.*field|unsupported/i.test(message)) return "DATA";
  if (status === 404) return "API";
  if (status === 409) return "API";
  if (status >= 500) return "SYS";
  return "SYS";
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
};

// ============================================================================
// Error Report Builder
// ============================================================================

function buildReport(opts: {
  status: number;
  message: string;
  layer: ErrorLayer;
  service: string;
  endpoint?: string;
  details?: string[];
}): ErrorReport {
  const category = classifyError(opts.status, opts.message);
  const code = generateErrorCode(opts.layer, category, opts.status);

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
  };
}

// ============================================================================
// Output Formatters
// ============================================================================

function formatUserOutput(report: ErrorReport): UserErrorOutput {
  return {
    error: report.userMessage,
    code: report.code,
    hint: report.userHint,
  };
}

function formatDeveloperOutput(report: ErrorReport): DeveloperErrorOutput {
  return {
    error: report.reason,
    code: report.code,
    status: report.status,
    details: report.details,
    location: report.location,
    timestamp: report.timestamp,
  };
}

/**
 * Format an error report based on the current environment.
 */
export function formatError(
  report: ErrorReport,
  mode?: ErrorMode,
): UserErrorOutput | DeveloperErrorOutput {
  const resolved = mode ?? detectMode();
  return resolved === "developer"
    ? formatDeveloperOutput(report)
    : formatUserOutput(report);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Report an API call error.
 * Use this in catch blocks when calling tapirApi functions.
 *
 * @example
 * ```ts
 * try {
 *   await downloadMedia(options);
 * } catch (err) {
 *   const report = reportApiError(err, '/api/download');
 *   console.error(report.code, report.reason);
 *   setError(formatError(report));
 * }
 * ```
 */
export function reportApiError(
  error: unknown,
  endpoint: string,
  details?: string[],
): ErrorReport {
  const message = error instanceof Error ? error.message : String(error);

  // Try to extract HTTP status from error message patterns
  let status = 0;
  const statusMatch = message.match(/(\d{3})/);
  if (statusMatch) {
    const parsed = parseInt(statusMatch[1]);
    if (parsed >= 400 && parsed < 600) status = parsed;
  }

  // Detect network errors
  if (/Failed to fetch|fetch failed|ECONNREFUSED|NetworkError/i.test(message)) {
    return buildReport({
      status: 0,
      message,
      layer: "NET",
      service: "TapirApiClient",
      endpoint,
      details: details || [
        message,
        "Could not reach the Tapir backend API",
        "Ensure the backend server is running",
      ],
    });
  }

  return buildReport({
    status: status || 400,
    message,
    layer: "FE",
    service: "TapirApiClient",
    endpoint,
    details,
  });
}

/**
 * Report a UI rendering or state error.
 *
 * @example
 * ```ts
 * const report = reportUiError('DownloadPage', 'Failed to parse job status');
 * ```
 */
export function reportUiError(
  component: string,
  message: string,
  details?: string[],
): ErrorReport {
  return buildReport({
    status: 0,
    message,
    layer: "FE",
    service: component,
    details: details || [message, `Component: ${component}`],
  });
}

/**
 * Report a silent failure -- an operation that returned no result
 * and threw no error.
 *
 * @example
 * ```ts
 * const result = await someOperation();
 * if (!result) {
 *   const report = reportSilentFailure('TranscribePage', '/api/transcribe');
 *   console.warn(report.code);
 * }
 * ```
 */
export function reportSilentFailure(
  component: string,
  endpoint?: string,
  context?: string,
): ErrorReport {
  return buildReport({
    status: 0,
    message: context || "Operation completed without result or error",
    layer: "SYS",
    service: component,
    endpoint,
    details: [
      "Operation failed without throwing an error",
      "No result was returned",
      context || "Unknown context",
    ],
  });
}

/**
 * Report a backend error received from the API response.
 * Use when you have the HTTP status code from the response.
 *
 * @example
 * ```ts
 * if (!response.ok) {
 *   const body = await response.json();
 *   const report = reportBackendError(response.status, body.error, '/api/download');
 *   setError(formatError(report));
 * }
 * ```
 */
export function reportBackendError(
  status: number,
  message: string,
  endpoint: string,
  details?: string[],
): ErrorReport {
  return buildReport({
    status,
    message,
    layer: "BE",
    service: "TapirAPI",
    endpoint,
    details,
  });
}

/**
 * Log an error report to the console in the appropriate format.
 * In developer mode, logs full details. In user mode, logs only the code.
 */
export function logError(report: ErrorReport): void {
  const mode = detectMode();
  if (mode === "developer") {
    console.error(
      `[${report.code}] ${report.reason}\n` +
      `  Service: ${report.location.service}\n` +
      `  Endpoint: ${report.location.endpoint || "N/A"}\n` +
      `  Layer: ${report.location.layer}\n` +
      `  Details:\n${report.details.map(d => `    - ${d}`).join("\n")}`,
    );
  } else {
    console.error(`Error: ${report.code}`);
  }
}
