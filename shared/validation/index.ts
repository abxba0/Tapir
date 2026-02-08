/**
 * Tapir Shared Validation Utilities
 *
 * Security and validation functions shared across backend and TUI modules.
 */

import { existsSync, statSync, realpathSync } from "fs"
import { homedir, tmpdir } from "os"
import { resolve } from "path"

// ============================================================================
// Path Security
// ============================================================================

const BLOCKED_PATH_RE = /^\/(etc|proc|sys|dev|boot)\//

function isBlockedPath(p: string): boolean {
  if (BLOCKED_PATH_RE.test(p)) return true
  const home = homedir()
  if (p.startsWith(home + "/.ssh") || p.startsWith(home + "/.gnupg")) return true
  return false
}

/**
 * Validate and resolve a file path, blocking sensitive system paths.
 * Follows symlinks to ensure the real target is also safe.
 * Returns the resolved absolute path, or null if blocked/invalid.
 */
export function validateFilePath(filePath: string): string | null {
  const resolved = resolve(filePath)
  if (isBlockedPath(resolved)) return null
  try {
    if (!statSync(resolved).isFile()) return null
    const real = realpathSync(resolved)
    if (isBlockedPath(real)) return null
  } catch {
    return null
  }
  return resolved
}

// ============================================================================
// URL Security
// ============================================================================

/**
 * Reject URLs with dangerous schemes (file://, data://, javascript://).
 * Allows http(s) and scheme-less URLs (passed to yt-dlp as-is).
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false
  const lower = url.toLowerCase().trimStart()
  return !lower.startsWith("file:") && !lower.startsWith("data:") && !lower.startsWith("javascript:")
}

/**
 * Validate a URL for server-side fetching (e.g., thumbnail downloads).
 * Blocks private/internal network addresses to prevent SSRF.
 */
export function isSafeFetchUrl(url: string): boolean {
  if (!isSafeUrl(url)) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === "localhost" || host === "127.0.0.1" ||
        host === "::1" || host === "[::1]" ||
        host === "0.0.0.0" || host === "169.254.169.254" ||
        host.startsWith("10.") || host.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        host.endsWith(".internal") || host.endsWith(".local")) return false
    return true
  } catch {
    return false
  }
}

/**
 * Validate an output directory path. Only allows directories under
 * the user's home, temp dir, or current working directory.
 */
export function validateOutputDir(dir: string): boolean {
  const resolved = resolve(dir)
  if (isBlockedPath(resolved)) return false
  const home = homedir()
  const tmp = tmpdir()
  const cwd = process.cwd()
  return resolved.startsWith(home) || resolved.startsWith(tmp) || resolved.startsWith(cwd)
}
