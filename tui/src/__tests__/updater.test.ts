/**
 * Tests for services/updater.ts
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"

import {
  getYtDlpVersion,
  getLatestYtDlpVersion,
  checkForUpdates,
  updateYtDlp,
  compareVersions,
} from "../services/updater"

let originalSpawn: typeof Bun.spawn
let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalSpawn = Bun.spawn
  originalFetch = globalThis.fetch
})

afterEach(() => {
  Bun.spawn = originalSpawn
  globalThis.fetch = originalFetch
})

// ============================================================================
// compareVersions
// ============================================================================

describe("compareVersions", () => {
  test("returns 0 for equal versions", () => {
    expect(compareVersions("2025.01.15", "2025.01.15")).toBe(0)
  })

  test("returns 1 when first is newer", () => {
    expect(compareVersions("2025.02.01", "2025.01.15")).toBe(1)
  })

  test("returns -1 when first is older", () => {
    expect(compareVersions("2024.12.01", "2025.01.15")).toBe(-1)
  })

  test("handles v prefix", () => {
    expect(compareVersions("v2025.01.15", "v2025.01.15")).toBe(0)
    expect(compareVersions("v2025.02.01", "2025.01.15")).toBe(1)
  })

  test("handles different length versions", () => {
    expect(compareVersions("2025.01", "2025.01.0")).toBe(0)
    expect(compareVersions("2025.01.1", "2025.01")).toBe(1)
  })
})

// ============================================================================
// getYtDlpVersion
// ============================================================================

describe("getYtDlpVersion", () => {
  test("returns version string on success", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("2025.01.15\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const version = await getYtDlpVersion()
    expect(version).toBe("2025.01.15")
  })

  test("returns null on failure", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(1),
    })) as any

    const version = await getYtDlpVersion()
    expect(version).toBeNull()
  })

  test("returns null on exception", async () => {
    Bun.spawn = (() => { throw new Error("not found") }) as any
    const version = await getYtDlpVersion()
    expect(version).toBeNull()
  })
})

// ============================================================================
// getLatestYtDlpVersion
// ============================================================================

describe("getLatestYtDlpVersion", () => {
  test("returns tag_name from GitHub API", async () => {
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ tag_name: "2025.02.01" }),
    })) as any

    const version = await getLatestYtDlpVersion()
    expect(version).toBe("2025.02.01")
  })

  test("returns null on HTTP error", async () => {
    globalThis.fetch = (async () => ({ ok: false })) as any
    const version = await getLatestYtDlpVersion()
    expect(version).toBeNull()
  })

  test("returns null on fetch exception", async () => {
    globalThis.fetch = (() => { throw new Error("network") }) as any
    const version = await getLatestYtDlpVersion()
    expect(version).toBeNull()
  })
})

// ============================================================================
// checkForUpdates
// ============================================================================

describe("checkForUpdates", () => {
  test("detects update available", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("2025.01.01\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ tag_name: "2025.02.01" }),
    })) as any

    const info = await checkForUpdates()
    expect(info.updateAvailable).toBe(true)
    expect(info.currentVersion).toBe("2025.01.01")
    expect(info.latestVersion).toBe("2025.02.01")
  })

  test("detects no update needed", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("2025.02.01\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ tag_name: "2025.02.01" }),
    })) as any

    const info = await checkForUpdates()
    expect(info.updateAvailable).toBe(false)
  })

  test("handles yt-dlp not installed", async () => {
    Bun.spawn = (() => { throw new Error("not found") }) as any
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ tag_name: "2025.02.01" }),
    })) as any

    const info = await checkForUpdates()
    expect(info.currentVersion).toBeNull()
    expect(info.updateAvailable).toBe(false)
    expect(info.error).toBe("yt-dlp not installed")
  })

  test("handles GitHub API failure", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("2025.01.01\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    globalThis.fetch = (async () => ({ ok: false })) as any

    const info = await checkForUpdates()
    expect(info.latestVersion).toBeNull()
    expect(info.updateAvailable).toBe(false)
    expect(info.error).toBe("Could not check for updates")
  })
})

// ============================================================================
// updateYtDlp
// ============================================================================

describe("updateYtDlp", () => {
  test("returns success on exit code 0", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("Successfully installed yt-dlp"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await updateYtDlp()
    expect(result.success).toBe(true)
    expect(result.output).toContain("installed")
  })

  test("returns failure on non-zero exit", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("Permission denied"))
          c.close()
        },
      }),
      exited: Promise.resolve(1),
    })) as any

    const result = await updateYtDlp()
    expect(result.success).toBe(false)
    expect(result.output).toContain("Permission denied")
  })

  test("handles spawn exception", async () => {
    Bun.spawn = (() => { throw new Error("pip not found") }) as any
    const result = await updateYtDlp()
    expect(result.success).toBe(false)
    expect(result.output).toContain("pip not found")
  })
})
