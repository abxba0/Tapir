/**
 * Tests for services/transcriber.ts - transcription saving and pipeline
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { saveTranscription } from "../services/transcriber"
import type { TranscriptionSegment } from "../types"

// ============================================================================
// saveTranscription - pure file-writing function
// ============================================================================

const testDir = join(tmpdir(), `tapir_transcribe_test_${Date.now()}`)

beforeEach(() => {
  mkdirSync(testDir, { recursive: true })
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

describe("saveTranscription", () => {
  const segments: TranscriptionSegment[] = [
    { start: 0, end: 2.5, text: "Hello world" },
    { start: 2.5, end: 5.0, text: "This is a test" },
    { start: 5.0, end: 8.0, text: "Of the transcription system" },
  ]

  // ---- TXT format ----

  test("saves as TXT format", () => {
    const outputPath = join(testDir, "test.mp4")
    const result = saveTranscription("Hello world. This is a test.", null, outputPath, "txt")

    expect(result).not.toBeNull()
    expect(result!).toEndWith(".txt")
    expect(existsSync(result!)).toBe(true)

    const content = readFileSync(result!, "utf-8")
    expect(content).toBe("Hello world. This is a test.")
  })

  // ---- SRT format ----

  test("saves as SRT format with segments", () => {
    const outputPath = join(testDir, "test_srt.mp4")
    const result = saveTranscription("full text", segments, outputPath, "srt")

    expect(result).not.toBeNull()
    expect(result!).toEndWith(".srt")

    const content = readFileSync(result!, "utf-8")
    // Check SRT structure
    expect(content).toContain("1\n")
    expect(content).toContain("2\n")
    expect(content).toContain("3\n")
    expect(content).toContain("-->")
    expect(content).toContain("Hello world")
    expect(content).toContain("This is a test")
    expect(content).toContain(",") // SRT uses comma in timestamps
  })

  test("saves SRT with fallback when no segments", () => {
    const outputPath = join(testDir, "test_srt_noseg.mp4")
    const result = saveTranscription("Just text", null, outputPath, "srt")

    expect(result).not.toBeNull()
    const content = readFileSync(result!, "utf-8")
    expect(content).toContain("1\n")
    expect(content).toContain("Just text")
    expect(content).toContain("99:59:59,999")
  })

  test("saves SRT with empty segments array", () => {
    const outputPath = join(testDir, "test_srt_empty.mp4")
    const result = saveTranscription("Fallback text", [], outputPath, "srt")

    expect(result).not.toBeNull()
    const content = readFileSync(result!, "utf-8")
    expect(content).toContain("Fallback text")
    expect(content).toContain("99:59:59,999")
  })

  // ---- VTT format ----

  test("saves as VTT format with segments", () => {
    const outputPath = join(testDir, "test_vtt.mp4")
    const result = saveTranscription("full text", segments, outputPath, "vtt")

    expect(result).not.toBeNull()
    expect(result!).toEndWith(".vtt")

    const content = readFileSync(result!, "utf-8")
    expect(content).toStartWith("WEBVTT")
    expect(content).toContain("-->")
    expect(content).toContain("Hello world")
    expect(content).toContain(".") // VTT uses dot in timestamps
  })

  test("saves VTT with fallback when no segments", () => {
    const outputPath = join(testDir, "test_vtt_noseg.mp4")
    const result = saveTranscription("VTT text", null, outputPath, "vtt")

    expect(result).not.toBeNull()
    const content = readFileSync(result!, "utf-8")
    expect(content).toStartWith("WEBVTT")
    expect(content).toContain("VTT text")
    expect(content).toContain("99:59:59.999")
  })

  // ---- Edge cases ----

  test("replaces extension in output path", () => {
    const outputPath = join(testDir, "video.mp4")
    const result = saveTranscription("text", null, outputPath, "txt")
    expect(result!).toEndWith(".txt")
    expect(result!).not.toContain(".mp4")
  })

  test("defaults to txt format", () => {
    const outputPath = join(testDir, "default.mp4")
    const result = saveTranscription("default format text", null, outputPath)
    expect(result).not.toBeNull()
    expect(result!).toEndWith(".txt")
  })

  test("returns null when write fails", () => {
    const result = saveTranscription("text", null, "/nonexistent/dir/file.mp4", "txt")
    expect(result).toBeNull()
  })

  test("handles SRT timestamp formatting correctly", () => {
    const segs: TranscriptionSegment[] = [
      { start: 3661.123, end: 3665.456, text: "Hour mark" },
    ]
    const outputPath = join(testDir, "timestamp.mp4")
    const result = saveTranscription("text", segs, outputPath, "srt")

    const content = readFileSync(result!, "utf-8")
    // 3661.123 = 1:01:01,123
    expect(content).toContain("01:01:01,123")
    expect(content).toContain("01:01:05,456")
  })

  test("handles VTT timestamp formatting correctly", () => {
    const segs: TranscriptionSegment[] = [
      { start: 3661.123, end: 3665.456, text: "Hour mark" },
    ]
    const outputPath = join(testDir, "timestamp_vtt.mp4")
    const result = saveTranscription("text", segs, outputPath, "vtt")

    const content = readFileSync(result!, "utf-8")
    expect(content).toContain("01:01:01.123")
    expect(content).toContain("01:01:05.456")
  })
})
