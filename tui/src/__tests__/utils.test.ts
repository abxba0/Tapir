/**
 * Tests for utils.ts - formatting, validation, site detection, and helpers
 */
import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test"
import { existsSync, mkdirSync, accessSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import {
  VERSION,
  VERSION_DATE,
  SUBPROCESS_TIMEOUT,
  DEFAULT_MAX_WORKERS,
  MAX_WORKERS_LIMIT,
  SUPPORTED_MEDIA_EXTENSIONS,
  TRANSCRIPTION_FORMATS,
  formatDuration,
  formatSize,
  formatCount,
  formatTimestampSrt,
  formatTimestampVtt,
  isValidUrl,
  isValidYoutubeUrl,
  detectSite,
  getSupportedSites,
  getDownloadDirectory,
  isLocalMediaFile,
  sanitizeFilename,
  getSupportedAudioFormats,
  getWhisperModels,
  parseSubtitleToText,
} from "../utils"

// ============================================================================
// Constants
// ============================================================================

describe("Constants", () => {
  test("VERSION is a semver string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test("VERSION_DATE is a date string", () => {
    expect(VERSION_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test("SUBPROCESS_TIMEOUT is a positive number", () => {
    expect(SUBPROCESS_TIMEOUT).toBeGreaterThan(0)
  })

  test("DEFAULT_MAX_WORKERS is reasonable", () => {
    expect(DEFAULT_MAX_WORKERS).toBeGreaterThanOrEqual(1)
    expect(DEFAULT_MAX_WORKERS).toBeLessThanOrEqual(MAX_WORKERS_LIMIT)
  })

  test("SUPPORTED_MEDIA_EXTENSIONS has audio and video", () => {
    expect(SUPPORTED_MEDIA_EXTENSIONS.audio.length).toBeGreaterThan(0)
    expect(SUPPORTED_MEDIA_EXTENSIONS.video.length).toBeGreaterThan(0)
    expect(SUPPORTED_MEDIA_EXTENSIONS.audio).toContain(".mp3")
    expect(SUPPORTED_MEDIA_EXTENSIONS.video).toContain(".mp4")
  })

  test("TRANSCRIPTION_FORMATS", () => {
    expect(TRANSCRIPTION_FORMATS).toContain("txt")
    expect(TRANSCRIPTION_FORMATS).toContain("srt")
    expect(TRANSCRIPTION_FORMATS).toContain("vtt")
  })
})

// ============================================================================
// formatDuration
// ============================================================================

describe("formatDuration", () => {
  test("returns 'Unknown' for undefined", () => {
    expect(formatDuration(undefined)).toBe("Unknown")
  })

  test("returns 'Unknown' for 0", () => {
    expect(formatDuration(0)).toBe("Unknown")
  })

  test("formats seconds only", () => {
    expect(formatDuration(45)).toBe("00:45")
  })

  test("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("02:05")
  })

  test("formats hours, minutes, seconds", () => {
    expect(formatDuration(3661)).toBe("1:01:01")
  })

  test("formats exactly one hour", () => {
    expect(formatDuration(3600)).toBe("1:00:00")
  })

  test("pads minutes and seconds", () => {
    expect(formatDuration(7262)).toBe("2:01:02")
  })

  test("handles large durations", () => {
    expect(formatDuration(36000)).toBe("10:00:00")
  })
})

// ============================================================================
// formatSize
// ============================================================================

describe("formatSize", () => {
  test("returns '0B' for undefined", () => {
    expect(formatSize(undefined)).toBe("0B")
  })

  test("returns '0B' for 0", () => {
    expect(formatSize(0)).toBe("0B")
  })

  test("formats bytes", () => {
    expect(formatSize(500)).toBe("500.00 B")
  })

  test("formats kilobytes", () => {
    expect(formatSize(1024)).toBe("1.00 KB")
  })

  test("formats megabytes", () => {
    expect(formatSize(1048576)).toBe("1.00 MB")
  })

  test("formats gigabytes", () => {
    expect(formatSize(1073741824)).toBe("1.00 GB")
  })

  test("formats terabytes", () => {
    expect(formatSize(1099511627776)).toBe("1.00 TB")
  })

  test("formats fractional values", () => {
    const result = formatSize(1536)
    expect(result).toBe("1.50 KB")
  })
})

// ============================================================================
// formatCount
// ============================================================================

describe("formatCount", () => {
  test("returns 'Unknown' for undefined", () => {
    expect(formatCount(undefined)).toBe("Unknown")
  })

  test("returns 'Unknown' for 0", () => {
    expect(formatCount(0)).toBe("Unknown")
  })

  test("formats small number", () => {
    expect(formatCount(42)).toBe("42")
  })

  test("formats with locale separators", () => {
    const result = formatCount(1234567)
    // Locale-dependent, but should contain digits
    expect(result).toContain("1")
    expect(result.length).toBeGreaterThan(5)
  })
})

// ============================================================================
// formatTimestampSrt
// ============================================================================

describe("formatTimestampSrt", () => {
  test("formats zero", () => {
    expect(formatTimestampSrt(0)).toBe("00:00:00,000")
  })

  test("formats seconds with milliseconds", () => {
    expect(formatTimestampSrt(5.5)).toBe("00:00:05,500")
  })

  test("formats minutes", () => {
    expect(formatTimestampSrt(125.25)).toBe("00:02:05,250")
  })

  test("formats hours", () => {
    expect(formatTimestampSrt(3661.123)).toBe("01:01:01,123")
  })
})

// ============================================================================
// formatTimestampVtt
// ============================================================================

describe("formatTimestampVtt", () => {
  test("formats zero", () => {
    expect(formatTimestampVtt(0)).toBe("00:00:00.000")
  })

  test("uses dot separator instead of comma", () => {
    const result = formatTimestampVtt(5.5)
    expect(result).toBe("00:00:05.500")
    expect(result).toContain(".")
    expect(result).not.toContain(",")
  })

  test("formats hours", () => {
    expect(formatTimestampVtt(3661.123)).toBe("01:01:01.123")
  })
})

// ============================================================================
// isValidUrl
// ============================================================================

describe("isValidUrl", () => {
  test("returns false for empty string", () => {
    expect(isValidUrl("")).toBe(false)
  })

  test("returns false for null/undefined-like", () => {
    expect(isValidUrl(null as any)).toBe(false)
    expect(isValidUrl(undefined as any)).toBe(false)
  })

  test("returns false for non-string", () => {
    expect(isValidUrl(123 as any)).toBe(false)
  })

  test("returns true for http URL", () => {
    expect(isValidUrl("http://example.com")).toBe(true)
  })

  test("returns true for https URL", () => {
    expect(isValidUrl("https://youtube.com/watch?v=abc")).toBe(true)
  })

  test("returns true for www URL", () => {
    expect(isValidUrl("www.example.com")).toBe(true)
  })

  test("returns true for domain with dot", () => {
    expect(isValidUrl("example.com")).toBe(true)
  })

  test("returns false for plain word without dot", () => {
    expect(isValidUrl("notaurl")).toBe(false)
  })
})

// ============================================================================
// isValidYoutubeUrl
// ============================================================================

describe("isValidYoutubeUrl", () => {
  test("matches standard watch URL", () => {
    expect(isValidYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
  })

  test("matches short URL", () => {
    expect(isValidYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true)
  })

  test("matches shorts URL", () => {
    expect(isValidYoutubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(true)
  })

  test("matches playlist URL", () => {
    expect(isValidYoutubeUrl("https://www.youtube.com/playlist?list=PLtest123")).toBe(true)
  })

  test("matches channel URL", () => {
    expect(isValidYoutubeUrl("https://www.youtube.com/@username")).toBe(true)
  })

  test("rejects non-YouTube URL", () => {
    expect(isValidYoutubeUrl("https://vimeo.com/123456")).toBe(false)
  })

  test("rejects empty string", () => {
    expect(isValidYoutubeUrl("")).toBe(false)
  })

  test("matches without protocol", () => {
    expect(isValidYoutubeUrl("youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true)
  })
})

// ============================================================================
// detectSite
// ============================================================================

describe("detectSite", () => {
  test("detects youtube.com", () => {
    expect(detectSite("https://www.youtube.com/watch?v=abc")).toBe("youtube")
  })

  test("detects youtu.be", () => {
    expect(detectSite("https://youtu.be/abc")).toBe("youtube")
  })

  test("detects vimeo", () => {
    expect(detectSite("https://vimeo.com/123456")).toBe("vimeo")
  })

  test("detects soundcloud", () => {
    expect(detectSite("https://soundcloud.com/artist/track")).toBe("soundcloud")
  })

  test("detects dailymotion", () => {
    expect(detectSite("https://www.dailymotion.com/video/abc")).toBe("dailymotion")
  })

  test("detects twitch", () => {
    expect(detectSite("https://www.twitch.tv/videos/123")).toBe("twitch")
  })

  test("detects bandcamp", () => {
    expect(detectSite("https://artist.bandcamp.com/track/song")).toBe("bandcamp")
  })

  test("detects tiktok", () => {
    expect(detectSite("https://www.tiktok.com/@user/video/123")).toBe("tiktok")
  })

  test("detects instagram", () => {
    expect(detectSite("https://www.instagram.com/reel/abc")).toBe("instagram")
  })

  test("returns 'other' for unknown sites", () => {
    expect(detectSite("https://example.com/video")).toBe("other")
  })

  test("handles URL without protocol", () => {
    expect(detectSite("youtube.com/watch?v=abc")).toBe("youtube")
  })

  test("handles invalid URL gracefully", () => {
    expect(detectSite("not a url at all")).toBe("other")
  })

  test("strips www prefix", () => {
    expect(detectSite("https://www.vimeo.com/123")).toBe("vimeo")
  })
})

// ============================================================================
// getSupportedSites
// ============================================================================

describe("getSupportedSites", () => {
  test("returns object with known sites", () => {
    const sites = getSupportedSites()
    expect(sites.youtube).toBeDefined()
    expect(sites.youtube.name).toBe("YouTube")
    expect(sites.vimeo).toBeDefined()
    expect(sites.other).toBeDefined()
  })

  test("each site has name, description, example", () => {
    const sites = getSupportedSites()
    for (const key of Object.keys(sites)) {
      expect(sites[key].name).toBeTruthy()
      expect(sites[key].description).toBeTruthy()
      expect(sites[key].example).toBeTruthy()
    }
  })
})

// ============================================================================
// getDownloadDirectory
// ============================================================================

describe("getDownloadDirectory", () => {
  test("returns a directory path", () => {
    const dir = getDownloadDirectory()
    expect(typeof dir).toBe("string")
    expect(dir.length).toBeGreaterThan(0)
  })

  test("creates directory if it does not exist", () => {
    const testDir = join(tmpdir(), `tapir_test_${Date.now()}`)
    const dir = getDownloadDirectory(testDir)
    expect(existsSync(dir)).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  test("handles absolute path", () => {
    const testDir = join(tmpdir(), `tapir_abs_${Date.now()}`)
    const dir = getDownloadDirectory(testDir)
    expect(dir).toBe(testDir)
    rmSync(dir, { recursive: true, force: true })
  })
})

// ============================================================================
// isLocalMediaFile
// ============================================================================

describe("isLocalMediaFile", () => {
  const tmpFile = join(tmpdir(), `tapir_test_${Date.now()}.mp4`)

  beforeEach(() => {
    writeFileSync(tmpFile, "fake video data")
  })

  afterEach(() => {
    try { rmSync(tmpFile, { force: true }) } catch {}
  })

  test("returns true for existing media file", () => {
    expect(isLocalMediaFile(tmpFile)).toBe(true)
  })

  test("returns false for non-existent file", () => {
    expect(isLocalMediaFile("/nonexistent/file.mp4")).toBe(false)
  })

  test("returns false for non-media extension", () => {
    const txtFile = join(tmpdir(), `tapir_test_${Date.now()}.txt`)
    writeFileSync(txtFile, "text")
    expect(isLocalMediaFile(txtFile)).toBe(false)
    rmSync(txtFile, { force: true })
  })

  test("recognizes audio extensions", () => {
    const mp3File = join(tmpdir(), `tapir_test_${Date.now()}.mp3`)
    writeFileSync(mp3File, "fake audio")
    expect(isLocalMediaFile(mp3File)).toBe(true)
    rmSync(mp3File, { force: true })
  })
})

// ============================================================================
// sanitizeFilename
// ============================================================================

describe("sanitizeFilename", () => {
  test("replaces special characters", () => {
    expect(sanitizeFilename('file<>:"/\\|?*name')).toBe("file_________name")
  })

  test("preserves normal characters", () => {
    expect(sanitizeFilename("normal-file_name.mp4")).toBe("normal-file_name.mp4")
  })

  test("handles empty string", () => {
    expect(sanitizeFilename("")).toBe("")
  })
})

// ============================================================================
// getSupportedAudioFormats
// ============================================================================

describe("getSupportedAudioFormats", () => {
  test("returns expected formats", () => {
    const formats = getSupportedAudioFormats()
    expect(formats.mp3).toBeDefined()
    expect(formats.aac).toBeDefined()
    expect(formats.wav).toBeDefined()
    expect(formats.flac).toBeDefined()
    expect(formats.ogg).toBeDefined()
    expect(formats.m4a).toBeDefined()
  })

  test("each format has required fields", () => {
    const formats = getSupportedAudioFormats()
    for (const key of Object.keys(formats)) {
      expect(formats[key].name).toBeTruthy()
      expect(formats[key].description).toBeTruthy()
      expect(formats[key].defaultBitrate).toBeGreaterThan(0)
      expect(formats[key].codec).toBeTruthy()
    }
  })
})

// ============================================================================
// getWhisperModels
// ============================================================================

describe("getWhisperModels", () => {
  test("returns expected models", () => {
    const models = getWhisperModels()
    expect(models.tiny).toBeDefined()
    expect(models.base).toBeDefined()
    expect(models.small).toBeDefined()
    expect(models.medium).toBeDefined()
    expect(models.large).toBeDefined()
  })

  test("models increase in size", () => {
    const models = getWhisperModels()
    expect(models.tiny.sizeMb).toBeLessThan(models.base.sizeMb)
    expect(models.base.sizeMb).toBeLessThan(models.small.sizeMb)
    expect(models.small.sizeMb).toBeLessThan(models.medium.sizeMb)
    expect(models.medium.sizeMb).toBeLessThan(models.large.sizeMb)
  })
})

// ============================================================================
// parseSubtitleToText
// ============================================================================

describe("parseSubtitleToText", () => {
  test("extracts text from SRT format", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:03,000 --> 00:00:05,000
This is a test`
    const result = parseSubtitleToText(srt)
    expect(result).toContain("Hello world")
    expect(result).toContain("This is a test")
  })

  test("strips HTML tags", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<b>Bold text</b> and <i>italic</i>`
    const result = parseSubtitleToText(srt)
    expect(result).toContain("Bold text")
    expect(result).toContain("italic")
    expect(result).not.toContain("<b>")
    expect(result).not.toContain("</b>")
  })

  test("strips curly brace tags", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
{\\an8}Some text`
    const result = parseSubtitleToText(srt)
    expect(result).toContain("Some text")
    expect(result).not.toContain("{")
  })

  test("skips WEBVTT header", () => {
    const vtt = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:03.000
Hello`
    const result = parseSubtitleToText(vtt)
    expect(result).toBe("Hello")
    expect(result).not.toContain("WEBVTT")
  })

  test("deduplicates consecutive lines", () => {
    const srt = `1
00:00:01,000 --> 00:00:02,000
Hello

2
00:00:02,000 --> 00:00:03,000
Hello

3
00:00:03,000 --> 00:00:04,000
World`
    const result = parseSubtitleToText(srt)
    expect(result).toBe("Hello World")
  })

  test("handles empty input", () => {
    expect(parseSubtitleToText("")).toBe("")
  })

  test("skips NOTE and STYLE header lines", () => {
    const vtt = `WEBVTT

NOTE This is a note

STYLE

00:00:01.000 --> 00:00:03.000
Actual text`
    const result = parseSubtitleToText(vtt)
    expect(result).toBe("Actual text")
  })
})
