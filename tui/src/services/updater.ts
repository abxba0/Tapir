/**
 * Auto-update checker for yt-dlp.
 *
 * Compares the locally installed yt-dlp version against the latest
 * GitHub release and offers a one-click upgrade via pip3.
 */

// ============================================================================
// Types
// ============================================================================

export interface UpdateInfo {
  currentVersion: string | null
  latestVersion: string | null
  updateAvailable: boolean
  error?: string
}

// ============================================================================
// Version detection
// ============================================================================

export async function getYtDlpVersion(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["yt-dlp", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    if (exitCode === 0) return stdout.trim()
    return null
  } catch {
    return null
  }
}

export async function getLatestYtDlpVersion(): Promise<string | null> {
  try {
    const resp = await fetch(
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
      { headers: { "User-Agent": "Tapir/5.0" } },
    )
    if (!resp.ok) return null
    const data = (await resp.json()) as any
    return data.tag_name || null
  } catch {
    return null
  }
}

// ============================================================================
// Version comparison
// ============================================================================

export function compareVersions(a: string, b: string): number {
  // yt-dlp uses date-based versions like 2025.01.15
  const aParts = a.replace(/^v/, "").split(".").map(Number)
  const bParts = b.replace(/^v/, "").split(".").map(Number)
  const len = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < len; i++) {
    const av = aParts[i] || 0
    const bv = bParts[i] || 0
    if (av > bv) return 1
    if (av < bv) return -1
  }
  return 0
}

// ============================================================================
// Check for updates
// ============================================================================

export async function checkForUpdates(): Promise<UpdateInfo> {
  const [current, latest] = await Promise.all([
    getYtDlpVersion(),
    getLatestYtDlpVersion(),
  ])

  if (!current) {
    return {
      currentVersion: null,
      latestVersion: latest,
      updateAvailable: false,
      error: "yt-dlp not installed",
    }
  }

  if (!latest) {
    return {
      currentVersion: current,
      latestVersion: null,
      updateAvailable: false,
      error: "Could not check for updates",
    }
  }

  const cleanCurrent = current.replace(/^v/, "")
  const cleanLatest = latest.replace(/^v/, "")
  const updateAvailable =
    cleanCurrent !== cleanLatest && compareVersions(cleanLatest, cleanCurrent) > 0

  return { currentVersion: current, latestVersion: latest, updateAvailable }
}

// ============================================================================
// Perform update
// ============================================================================

export async function updateYtDlp(): Promise<{ success: boolean; output: string }> {
  try {
    const proc = Bun.spawn(["pip3", "install", "-U", "yt-dlp"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode === 0) {
      return { success: true, output: stdout || "Updated successfully" }
    }
    return { success: false, output: stderr || "Update failed" }
  } catch (err: any) {
    return { success: false, output: err.message || "Update failed" }
  }
}
