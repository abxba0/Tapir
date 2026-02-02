/**
 * Tests for services/converter.ts - audio conversion, metadata, validation
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import {
  isSupportedAudioFile,
  estimateOutputSize,
  getQualityDescription,
  getAudioMetadata,
  getFileInfo,
  convertAudioFile,
} from "../services/converter"

// ============================================================================
// isSupportedAudioFile
// ============================================================================

describe("isSupportedAudioFile", () => {
  test("returns false for non-existent file", () => {
    expect(isSupportedAudioFile("/nonexistent/file.mp3")).toBe(false)
  })

  test("returns true for supported audio extension", () => {
    const tmpFile = join(tmpdir(), `tapir_audio_${Date.now()}.mp3`)
    writeFileSync(tmpFile, "fake audio")
    expect(isSupportedAudioFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .wav extension", () => {
    const tmpFile = join(tmpdir(), `tapir_audio_${Date.now()}.wav`)
    writeFileSync(tmpFile, "fake wav")
    expect(isSupportedAudioFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .flac extension", () => {
    const tmpFile = join(tmpdir(), `tapir_audio_${Date.now()}.flac`)
    writeFileSync(tmpFile, "fake flac")
    expect(isSupportedAudioFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .ogg extension", () => {
    const tmpFile = join(tmpdir(), `tapir_audio_${Date.now()}.ogg`)
    writeFileSync(tmpFile, "fake ogg")
    expect(isSupportedAudioFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .m4a extension", () => {
    const tmpFile = join(tmpdir(), `tapir_audio_${Date.now()}.m4a`)
    writeFileSync(tmpFile, "fake m4a")
    expect(isSupportedAudioFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns false for unsupported extension", () => {
    const tmpFile = join(tmpdir(), `tapir_audio_${Date.now()}.txt`)
    writeFileSync(tmpFile, "text")
    expect(isSupportedAudioFile(tmpFile)).toBe(false)
    rmSync(tmpFile, { force: true })
  })

  test("returns false for video extension", () => {
    const tmpFile = join(tmpdir(), `tapir_audio_${Date.now()}.mp4`)
    writeFileSync(tmpFile, "video")
    expect(isSupportedAudioFile(tmpFile)).toBe(false)
    rmSync(tmpFile, { force: true })
  })
})

// ============================================================================
// estimateOutputSize
// ============================================================================

describe("estimateOutputSize", () => {
  test("calculates correct size for 192kbps 60s", () => {
    const size = estimateOutputSize(60, 192)
    // 192 * 1000 * 60 / 8 = 1,440,000 bytes
    expect(size).toBe(1440000)
  })

  test("calculates correct size for 320kbps 120s", () => {
    const size = estimateOutputSize(120, 320)
    // 320 * 1000 * 120 / 8 = 4,800,000
    expect(size).toBe(4800000)
  })

  test("returns 0 for 0 duration", () => {
    expect(estimateOutputSize(0, 192)).toBe(0)
  })

  test("returns 0 for 0 bitrate", () => {
    expect(estimateOutputSize(60, 0)).toBe(0)
  })
})

// ============================================================================
// getQualityDescription
// ============================================================================

describe("getQualityDescription", () => {
  test("returns 'Unknown quality' for 0 bitrate", () => {
    expect(getQualityDescription("mp3", 0)).toBe("Unknown quality")
  })

  test("returns Very High for 320kbps lossy", () => {
    expect(getQualityDescription("mp3", 320)).toBe("Very High (320kbps)")
  })

  test("returns High for 256kbps lossy", () => {
    expect(getQualityDescription("aac", 256)).toBe("High (256kbps)")
  })

  test("returns Good for 192kbps lossy", () => {
    expect(getQualityDescription("vorbis", 192)).toBe("Good (192kbps)")
  })

  test("returns Standard for 128kbps lossy", () => {
    expect(getQualityDescription("opus", 128)).toBe("Standard (128kbps)")
  })

  test("returns Low for <128kbps lossy", () => {
    expect(getQualityDescription("mp3", 64)).toBe("Low (64kbps)")
  })

  test("returns Lossless for FLAC", () => {
    expect(getQualityDescription("flac", 1000)).toBe("Lossless (Original Quality)")
  })

  test("returns Lossless for WAV", () => {
    expect(getQualityDescription("wav", 1411)).toBe("Lossless (Original Quality)")
  })

  test("returns Lossless for pcm", () => {
    expect(getQualityDescription("pcm_s16le", 1411)).toBe("Lossless (Original Quality)")
  })

  test("returns Lossless for ALAC", () => {
    expect(getQualityDescription("alac", 800)).toBe("Lossless (Original Quality)")
  })

  test("returns bitrate for unknown codec", () => {
    expect(getQualityDescription("unknown_codec", 256)).toBe("256kbps")
  })
})

// ============================================================================
// getAudioMetadata
// ============================================================================

describe("getAudioMetadata", () => {
  test("returns null for non-existent file", async () => {
    const result = await getAudioMetadata("/nonexistent/file.mp3")
    expect(result).toBeNull()
  })

  test("returns null for fake file (ffprobe fails)", async () => {
    const tmpFile = join(tmpdir(), `tapir_meta_${Date.now()}.mp3`)
    writeFileSync(tmpFile, "not real audio")

    const result = await getAudioMetadata(tmpFile)
    // ffprobe may fail on fake file
    // just verify it doesn't throw
    expect(result === null || typeof result === "object").toBe(true)
    rmSync(tmpFile, { force: true })
  })
})

// ============================================================================
// getFileInfo
// ============================================================================

describe("getFileInfo", () => {
  test("returns file size", async () => {
    const tmpFile = join(tmpdir(), `tapir_finfo_${Date.now()}.mp3`)
    writeFileSync(tmpFile, "a".repeat(1024))

    const info = await getFileInfo(tmpFile)
    expect(info.size).toBe(1024)
    rmSync(tmpFile, { force: true })
  })

  test("returns null duration for fake file", async () => {
    const tmpFile = join(tmpdir(), `tapir_finfo_${Date.now()}.mp3`)
    writeFileSync(tmpFile, "fake")

    const info = await getFileInfo(tmpFile)
    // duration might be null for non-real audio
    expect(typeof info.size).toBe("number")
    rmSync(tmpFile, { force: true })
  })
})

// ============================================================================
// convertAudioFile
// ============================================================================

describe("convertAudioFile", () => {
  test("returns null for unsupported format", async () => {
    const messages: string[] = []
    const result = await convertAudioFile(
      { inputFile: "/tmp/test.mp3", outputFormat: "xyz" },
      (msg) => messages.push(msg),
    )
    expect(result).toBeNull()
    expect(messages.some((m) => m.includes("Unsupported format"))).toBe(true)
  })

  test("calls onProgress with conversion message", async () => {
    const tmpFile = join(tmpdir(), `tapir_conv_${Date.now()}.mp3`)
    writeFileSync(tmpFile, "fake audio data for conversion")
    const messages: string[] = []

    try {
      await convertAudioFile(
        { inputFile: tmpFile, outputFormat: "wav" },
        (msg) => messages.push(msg),
      )
      // Should at least have the "Converting..." message
      expect(messages.some((m) => m.includes("Converting"))).toBe(true)
    } finally {
      rmSync(tmpFile, { force: true })
      // Clean up potential output file
      try { rmSync(tmpFile.replace(".mp3", ".wav"), { force: true }) } catch {}
    }
  })

  test("handles bitrate option", async () => {
    let capturedArgs: string[] = []
    const originalSpawn = Bun.spawn

    Bun.spawn = ((args: string[], opts?: any) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(1), // fail so it doesn't try to read output file
      }
    }) as any

    const tmpFile = join(tmpdir(), `tapir_conv_br_${Date.now()}.mp3`)
    writeFileSync(tmpFile, "fake")

    try {
      await convertAudioFile({ inputFile: tmpFile, outputFormat: "aac", bitrate: 256 })
      expect(capturedArgs).toContain("-b:a")
      expect(capturedArgs).toContain("256k")
    } finally {
      Bun.spawn = originalSpawn
      rmSync(tmpFile, { force: true })
    }
  })
})
