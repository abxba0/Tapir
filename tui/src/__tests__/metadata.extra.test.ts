/**
 * Additional tests for services/metadata.ts - mocked embedMetadata paths
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { writeFileSync, rmSync, existsSync, renameSync, mkdirSync } from "fs"
import { join, extname } from "path"
import { tmpdir } from "os"

import { embedMetadata, extractMetadata } from "../services/metadata"

let originalSpawn: typeof Bun.spawn

beforeEach(() => {
  originalSpawn = Bun.spawn
})

afterEach(() => {
  Bun.spawn = originalSpawn
})

describe("embedMetadata with mocked ffmpeg", () => {
  test("embeds title and artist successfully", async () => {
    const tmpFile = join(tmpdir(), `tapir_emb_${Date.now()}.mp4`)
    const tmpOutput = join(tmpdir(), `.tapir-meta-${Date.now()}-tapir_emb_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video content")

    // Mock Bun.spawn to simulate successful ffmpeg
    Bun.spawn = ((args: string[], opts?: any) => {
      // Simulate ffmpeg creating the output file
      const outFile = args[args.length - 1]
      if (typeof outFile === "string" && outFile.includes(".tapir-meta-")) {
        writeFileSync(outFile, "processed video content")
      }
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    const result = await embedMetadata(tmpFile, {
      title: "Test Title",
      artist: "Test Artist",
      date: "2024-01-15",
      comment: "A test comment",
      url: "https://youtube.com/watch?v=test",
    })

    expect(result.success).toBe(true)
    expect(result.message).toContain("Metadata embedded")
    expect(result.message).toContain("Test Title")
    expect(result.message).toContain("Test Artist")

    // Clean up
    try { rmSync(tmpFile, { force: true }) } catch {}
  })

  test("handles ffmpeg failure gracefully", async () => {
    const tmpFile = join(tmpdir(), `tapir_emb_fail_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video content")

    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ffmpeg error: invalid input"))
          c.close()
        },
      }),
      exited: Promise.resolve(1),
    })) as any

    const result = await embedMetadata(tmpFile, { title: "Test" })
    expect(result.success).toBe(false)
    expect(result.message).toContain("ffmpeg failed")

    // Original file should still exist
    expect(existsSync(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("handles Bun.spawn exception", async () => {
    const tmpFile = join(tmpdir(), `tapir_emb_exc_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video content")

    Bun.spawn = (() => { throw new Error("spawn crashed") }) as any

    const result = await embedMetadata(tmpFile, { title: "Test" })
    expect(result.success).toBe(false)
    expect(result.message).toContain("Metadata embedding error")

    rmSync(tmpFile, { force: true })
  })

  test("embeds metadata with thumbnail on mp4", async () => {
    const tmpFile = join(tmpdir(), `tapir_emb_thumb_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video")

    // Mock fetch for thumbnail download
    const origFetch = globalThis.fetch
    globalThis.fetch = (async (url: string | Request | URL) => ({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => new ArrayBuffer(100),
    })) as any

    // Mock Bun.spawn
    Bun.spawn = ((args: string[], opts?: any) => {
      const outFile = args[args.length - 1]
      if (typeof outFile === "string" && outFile.includes(".tapir-meta-")) {
        writeFileSync(outFile, "output with thumb")
      }
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    const result = await embedMetadata(
      tmpFile,
      {
        title: "Thumb Test",
        artist: "Artist",
        thumbnailUrl: "https://example.com/thumb.jpg",
      },
      { embedThumbnail: true },
    )

    expect(result.success).toBe(true)
    expect(result.message).toContain("thumbnail")

    globalThis.fetch = origFetch
    try { rmSync(tmpFile, { force: true }) } catch {}
  })

  test("embeds metadata into mp3 file with ID3 version", async () => {
    const tmpFile = join(tmpdir(), `tapir_emb_mp3_${Date.now()}.mp3`)
    writeFileSync(tmpFile, "fake audio")

    const origFetch = globalThis.fetch
    globalThis.fetch = (async () => ({
      ok: true,
      headers: new Headers({ "content-type": "image/jpeg" }),
      arrayBuffer: async () => new ArrayBuffer(50),
    })) as any

    let capturedArgs: string[] = []
    Bun.spawn = ((args: string[], opts?: any) => {
      capturedArgs = args
      const outFile = args[args.length - 1]
      if (typeof outFile === "string" && outFile.includes(".tapir-meta-")) {
        writeFileSync(outFile, "tagged mp3")
      }
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    await embedMetadata(
      tmpFile,
      { title: "MP3 Song", thumbnailUrl: "https://example.com/t.jpg" },
      { embedThumbnail: true },
    )

    expect(capturedArgs).toContain("-id3v2_version")
    expect(capturedArgs).toContain("3")

    globalThis.fetch = origFetch
    try { rmSync(tmpFile, { force: true }) } catch {}
  })

  test("embeds metadata into mkv file", async () => {
    const tmpFile = join(tmpdir(), `tapir_emb_mkv_${Date.now()}.mkv`)
    writeFileSync(tmpFile, "fake mkv")

    const origFetch = globalThis.fetch
    globalThis.fetch = (async () => ({
      ok: true,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => new ArrayBuffer(50),
    })) as any

    Bun.spawn = ((args: string[], opts?: any) => {
      const outFile = args[args.length - 1]
      if (typeof outFile === "string" && outFile.includes(".tapir-meta-")) {
        writeFileSync(outFile, "tagged mkv")
      }
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    const result = await embedMetadata(
      tmpFile,
      { title: "MKV Video", thumbnailUrl: "https://example.com/t.png" },
      { embedThumbnail: true },
    )

    expect(result.success).toBe(true)

    globalThis.fetch = origFetch
    try { rmSync(tmpFile, { force: true }) } catch {}
  })

  test("handles webp thumbnail conversion", async () => {
    const tmpFile = join(tmpdir(), `tapir_emb_webp_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video")

    const origFetch = globalThis.fetch
    globalThis.fetch = (async () => ({
      ok: true,
      headers: new Headers({ "content-type": "image/webp" }),
      arrayBuffer: async () => new ArrayBuffer(50),
    })) as any

    let spawnCalls: string[][] = []
    Bun.spawn = ((args: string[], opts?: any) => {
      spawnCalls.push(args)
      const outFile = args[args.length - 1]
      if (typeof outFile === "string") {
        // Create the output file
        if (outFile.endsWith(".jpg") || outFile.includes(".tapir-meta-")) {
          writeFileSync(outFile, "converted/tagged")
        }
      }
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    const result = await embedMetadata(
      tmpFile,
      { title: "WebP Test", thumbnailUrl: "https://example.com/t.webp" },
      { embedThumbnail: true },
    )

    // Should have called ffmpeg for webp->jpg conversion and for metadata embedding
    expect(spawnCalls.length).toBeGreaterThanOrEqual(1)

    globalThis.fetch = origFetch
    try { rmSync(tmpFile, { force: true }) } catch {}
  })

  test("handles thumbnail download failure", async () => {
    const tmpFile = join(tmpdir(), `tapir_emb_nothumb_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video")

    const origFetch = globalThis.fetch
    globalThis.fetch = (async () => ({
      ok: false,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as any

    Bun.spawn = ((args: string[], opts?: any) => {
      const outFile = args[args.length - 1]
      if (typeof outFile === "string" && outFile.includes(".tapir-meta-")) {
        writeFileSync(outFile, "output")
      }
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    const result = await embedMetadata(
      tmpFile,
      { title: "No Thumb", thumbnailUrl: "https://example.com/404.jpg" },
      { embedThumbnail: true },
    )

    // Should still succeed with metadata, just no thumbnail
    expect(result.success).toBe(true)
    expect(result.message).not.toContain("thumbnail")

    globalThis.fetch = origFetch
    try { rmSync(tmpFile, { force: true }) } catch {}
  })
})

describe("extractMetadata edge cases", () => {
  test("handles album field", () => {
    const info = { title: "Song", channel: "Artist" } as any
    const meta = extractMetadata(info)
    // album is not set from VideoInfo, but title and artist should be
    expect(meta.title).toBe("Song")
    expect(meta.album).toBeUndefined()
  })
})
