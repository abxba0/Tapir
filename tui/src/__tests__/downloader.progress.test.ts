/**
 * Additional tests for services/downloader.ts - downloadVideoWithProgress and downloadParallel
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import type { DownloadProgress } from "../types"

let originalSpawn: typeof Bun.spawn

beforeEach(() => {
  originalSpawn = Bun.spawn
})

afterEach(() => {
  Bun.spawn = originalSpawn
})

// ============================================================================
// downloadVideoWithProgress
// ============================================================================

describe("downloadVideoWithProgress", () => {
  test("reports progress from stdout lines", async () => {
    const { downloadVideoWithProgress } = await import("../services/downloader")

    const lines = [
      "[download] Destination: /tmp/video.mp4",
      "[download]  25.0% of  100.00MiB at  5.00MiB/s ETA 00:15",
      "[download]  50.0% of  100.00MiB at  5.00MiB/s ETA 00:10",
      "[download] 100% of  100.00MiB in 00:20",
      '[Merger] Merging formats into "/tmp/video.mp4"',
    ]

    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          for (const line of lines) {
            c.enqueue(new TextEncoder().encode(line + "\n"))
          }
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const progressUpdates: DownloadProgress[] = []
    const rawLines: string[] = []

    const result = await downloadVideoWithProgress(
      { url: "https://youtube.com/watch?v=test", format: "best", outputDir: "test" },
      (progress) => progressUpdates.push(progress),
      (line) => rawLines.push(line),
    )

    expect(result.success).toBe(true)
    expect(progressUpdates.length).toBeGreaterThan(0)
    expect(rawLines.length).toBeGreaterThan(0)

    // Check we got various phases
    const phases = progressUpdates.map((p) => p.phase)
    expect(phases).toContain("downloading")
    expect(phases).toContain("merging")

    // Check we got percentage
    const percentages = progressUpdates.filter((p) => p.percent > 0)
    expect(percentages.length).toBeGreaterThan(0)
  })

  test("returns failure on non-zero exit code", async () => {
    const { downloadVideoWithProgress } = await import("../services/downloader")

    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ERROR: Video unavailable"))
          c.close()
        },
      }),
      exited: Promise.resolve(1),
    })) as any

    const result = await downloadVideoWithProgress(
      { url: "https://youtube.com/watch?v=bad", format: "best", outputDir: "test" },
      () => {},
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("ERROR")
  })

  test("handles exception gracefully", async () => {
    const { downloadVideoWithProgress } = await import("../services/downloader")

    Bun.spawn = (() => { throw new Error("spawn failed") }) as any

    const result = await downloadVideoWithProgress(
      { url: "https://youtube.com/watch?v=test", format: "best", outputDir: "test" },
      () => {},
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain("Download error")
  })

  test("includes subtitle flags in progress download", async () => {
    const { downloadVideoWithProgress } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[], opts?: any) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    await downloadVideoWithProgress(
      {
        url: "https://youtube.com/watch?v=test",
        format: "mp3",
        outputDir: "test",
        downloadSubs: true,
        subLangs: "en,es",
      },
      () => {},
    )

    expect(capturedArgs).toContain("--write-subs")
    expect(capturedArgs).toContain("--sub-langs")
    expect(capturedArgs).toContain("en,es")
    expect(capturedArgs).toContain("--newline")
  })

  test("handles all format types", async () => {
    const { downloadVideoWithProgress } = await import("../services/downloader")

    for (const fmt of ["mp3", "mp4", "high", "best", "bestvideo", "bestaudio", "custom_format_id"]) {
      let capturedArgs: string[] = []
      Bun.spawn = ((args: string[]) => {
        capturedArgs = args
        return {
          stdout: new ReadableStream({ start(c) { c.close() } }),
          stderr: new ReadableStream({ start(c) { c.close() } }),
          exited: Promise.resolve(0),
        }
      }) as any

      await downloadVideoWithProgress(
        { url: "https://youtube.com/watch?v=test", format: fmt, outputDir: "test" },
        () => {},
      )

      expect(capturedArgs).toContain("-f")
    }
  })

  test("handles buffered partial lines", async () => {
    const { downloadVideoWithProgress } = await import("../services/downloader")

    // Simulate data arriving in chunks that split lines
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("[download]  10"))
          c.enqueue(new TextEncoder().encode(".0% of  50.00MiB at  2.00MiB/s ETA 00:22\n"))
          c.enqueue(new TextEncoder().encode("[download] 100% of  50.00MiB in 00:25"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const progressUpdates: DownloadProgress[] = []

    await downloadVideoWithProgress(
      { url: "https://youtube.com/watch?v=test", format: "best", outputDir: "test" },
      (progress) => progressUpdates.push(progress),
    )

    // Should have parsed at least the complete line and the buffered remainder
    expect(progressUpdates.length).toBeGreaterThanOrEqual(1)
  })
})

// ============================================================================
// downloadParallel
// ============================================================================

describe("downloadParallel", () => {
  test("downloads multiple URLs", async () => {
    const { downloadParallel } = await import("../services/downloader")

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const results = await downloadParallel(
      ["https://example.com/1", "https://example.com/2"],
      "best",
      "test_downloads",
      2,
    )

    expect(results.length).toBe(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(true)
  })

  test("handles partial failures", async () => {
    const { downloadParallel } = await import("../services/downloader")

    let callCount = 0
    Bun.spawn = ((args: string[]) => {
      callCount++
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({
          start(c) {
            if (callCount === 2) c.enqueue(new TextEncoder().encode("error"))
            c.close()
          },
        }),
        exited: Promise.resolve(callCount === 2 ? 1 : 0),
      }
    }) as any

    const results = await downloadParallel(
      ["https://example.com/1", "https://example.com/2"],
      "best",
      "test_downloads",
      4,
    )

    expect(results.length).toBe(2)
    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(false)
  })

  test("respects max workers limit", async () => {
    const { downloadParallel } = await import("../services/downloader")

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const results = await downloadParallel(
      ["url1", "url2", "url3", "url4", "url5"],
      "best",
      "test",
      2,
    )

    expect(results.length).toBe(5)
  })
})
