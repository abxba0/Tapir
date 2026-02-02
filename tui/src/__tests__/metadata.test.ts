/**
 * Tests for services/metadata.ts - metadata extraction and embedding
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import {
  extractMetadata,
  embedMetadata,
  findLatestFile,
  embedMetadataInDir,
  type MediaMetadata,
} from "../services/metadata"
import type { VideoInfo } from "../types"

// ============================================================================
// extractMetadata - pure function
// ============================================================================

describe("extractMetadata", () => {
  test("extracts basic fields from VideoInfo", () => {
    const info: VideoInfo = {
      title: "Test Video",
      channel: "Test Channel",
      upload_date: "20240115",
      description: "A test video description",
    }

    const meta = extractMetadata(info, "https://youtube.com/watch?v=test")
    expect(meta.title).toBe("Test Video")
    expect(meta.artist).toBe("Test Channel")
    expect(meta.date).toBe("2024-01-15")
    expect(meta.url).toBe("https://youtube.com/watch?v=test")
    expect(meta.description).toContain("A test video description")
    expect(meta.comment).toContain("A test video description")
  })

  test("uses uploader when channel is not available", () => {
    const info: VideoInfo = {
      title: "Test",
      uploader: "UploaderName",
    }

    const meta = extractMetadata(info)
    expect(meta.artist).toBe("UploaderName")
  })

  test("handles missing optional fields", () => {
    const info: VideoInfo = { title: "Minimal" }
    const meta = extractMetadata(info)
    expect(meta.title).toBe("Minimal")
    expect(meta.artist).toBeUndefined()
    expect(meta.date).toBeUndefined()
    expect(meta.description).toBeUndefined()
    expect(meta.url).toBeUndefined()
  })

  test("truncates long descriptions", () => {
    const longDesc = "A".repeat(2000)
    const info: VideoInfo = {
      title: "Test",
      description: longDesc,
    }

    const meta = extractMetadata(info)
    expect(meta.description!.length).toBeLessThanOrEqual(1000)
    expect(meta.comment!.length).toBeLessThanOrEqual(500)
  })

  test("extracts thumbnail URL", () => {
    const info = {
      title: "Test",
      thumbnail: "https://i.ytimg.com/vi/abc/maxresdefault.jpg",
    } as any

    const meta = extractMetadata(info)
    expect(meta.thumbnailUrl).toBe("https://i.ytimg.com/vi/abc/maxresdefault.jpg")
  })
})

// ============================================================================
// embedMetadata
// ============================================================================

describe("embedMetadata", () => {
  test("returns failure for non-existent file", async () => {
    const result = await embedMetadata("/nonexistent/file.mp4", { title: "Test" })
    expect(result.success).toBe(false)
    expect(result.message).toContain("File not found")
  })

  test("returns success with 'No metadata to embed' when meta is empty", async () => {
    const tmpFile = join(tmpdir(), `tapir_test_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video data")

    try {
      const result = await embedMetadata(tmpFile, {})
      expect(result.success).toBe(true)
      expect(result.message).toBe("No metadata to embed")
    } finally {
      rmSync(tmpFile, { force: true })
    }
  })

  test("attempts ffmpeg on real file with metadata", async () => {
    const tmpFile = join(tmpdir(), `tapir_meta_test_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video content for metadata test")

    try {
      const result = await embedMetadata(tmpFile, {
        title: "Test Title",
        artist: "Test Artist",
      })
      // ffmpeg will fail on a fake file, but should not throw
      expect(typeof result.success).toBe("boolean")
      expect(typeof result.message).toBe("string")
    } finally {
      rmSync(tmpFile, { force: true })
    }
  })

  test("handles embedThumbnail option", async () => {
    const tmpFile = join(tmpdir(), `tapir_thumb_test_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "fake video")

    try {
      const result = await embedMetadata(
        tmpFile,
        {
          title: "Thumb Test",
          thumbnailUrl: "https://httpbin.org/status/404", // Will fail to download
        },
        { embedThumbnail: true },
      )
      // Should still attempt, may fail on the fake file
      expect(typeof result.success).toBe("boolean")
    } finally {
      rmSync(tmpFile, { force: true })
    }
  })
})

// ============================================================================
// findLatestFile
// ============================================================================

describe("findLatestFile", () => {
  const testDir = join(tmpdir(), `tapir_find_${Date.now()}`)

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test("finds the most recently modified file", async () => {
    writeFileSync(join(testDir, "old.mp4"), "old")
    // Ensure different timestamps
    await Bun.sleep(50)
    writeFileSync(join(testDir, "new.mp4"), "new")

    const result = findLatestFile(testDir)
    expect(result).not.toBeNull()
    expect(result!).toContain("new.mp4")
  })

  test("only matches specified extensions", () => {
    writeFileSync(join(testDir, "file.txt"), "text")
    writeFileSync(join(testDir, "file.json"), "json")

    const result = findLatestFile(testDir)
    expect(result).toBeNull()
  })

  test("matches audio files", async () => {
    writeFileSync(join(testDir, "song.mp3"), "audio")

    const result = findLatestFile(testDir)
    expect(result).not.toBeNull()
    expect(result!).toContain("song.mp3")
  })

  test("returns null for empty directory", () => {
    const result = findLatestFile(testDir)
    expect(result).toBeNull()
  })

  test("returns null for non-existent directory", () => {
    const result = findLatestFile("/nonexistent/dir")
    expect(result).toBeNull()
  })

  test("skips hidden files", () => {
    writeFileSync(join(testDir, ".hidden.mp4"), "hidden")
    const result = findLatestFile(testDir)
    expect(result).toBeNull()
  })

  test("accepts custom extensions", async () => {
    writeFileSync(join(testDir, "custom.xyz"), "data")

    const result = findLatestFile(testDir, [".xyz"])
    expect(result).not.toBeNull()
    expect(result!).toContain("custom.xyz")
  })
})

// ============================================================================
// embedMetadataInDir
// ============================================================================

describe("embedMetadataInDir", () => {
  const testDir = join(tmpdir(), `tapir_embed_dir_${Date.now()}`)

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test("returns empty array for empty directory", async () => {
    const results = await embedMetadataInDir(testDir, { title: "Test" })
    expect(results).toEqual([])
  })

  test("processes matching files in directory", async () => {
    writeFileSync(join(testDir, "video.mp4"), "fake video")
    writeFileSync(join(testDir, "readme.txt"), "not a media file")

    const results = await embedMetadataInDir(testDir, { title: "Batch Test" })
    // Should attempt to process the mp4 but not the txt
    expect(results.length).toBe(1)
  })

  test("skips temp files", async () => {
    writeFileSync(join(testDir, ".tapir-meta-123-video.mp4"), "temp")
    writeFileSync(join(testDir, "real.mp4"), "real")

    const results = await embedMetadataInDir(testDir, { title: "Test" })
    expect(results.length).toBe(1)
  })

  test("respects custom extensions option", async () => {
    writeFileSync(join(testDir, "file.mp4"), "vid")
    writeFileSync(join(testDir, "file.flac"), "audio")

    const results = await embedMetadataInDir(testDir, { title: "Test" }, {
      extensions: [".flac"],
    })
    expect(results.length).toBe(1)
  })
})

function mkdirSync(path: string, opts?: any) {
  require("fs").mkdirSync(path, opts)
}
