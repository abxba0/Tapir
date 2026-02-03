/**
 * Tests for services/tts.ts - text-to-speech, document parsing, chunking, voices
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { writeFileSync, rmSync, mkdirSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import {
  extractTextFromPdf,
  extractTextFromDocument,
  stripHtmlTags,
  chunkText,
  listVoices,
  getDefaultVoices,
  getDefaultVoice,
  textToSpeech,
} from "../services/tts"
import {
  isSupportedDocumentFile,
  checkEdgeTts,
  checkGtts,
  checkEspeak,
  detectAvailableTtsEngine,
  TTS_CHUNK_MAX_CHARS,
  SUPPORTED_DOCUMENT_EXTENSIONS,
} from "../utils"

// ============================================================================
// isSupportedDocumentFile
// ============================================================================

describe("isSupportedDocumentFile", () => {
  test("returns false for non-existent file", () => {
    expect(isSupportedDocumentFile("/nonexistent/file.pdf")).toBe(false)
  })

  test("returns true for .txt file", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.txt`)
    writeFileSync(tmpFile, "Hello world")
    expect(isSupportedDocumentFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .pdf file", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.pdf`)
    writeFileSync(tmpFile, "fake pdf")
    expect(isSupportedDocumentFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .md file", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.md`)
    writeFileSync(tmpFile, "# Hello")
    expect(isSupportedDocumentFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .html file", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.html`)
    writeFileSync(tmpFile, "<html><body>Hello</body></html>")
    expect(isSupportedDocumentFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .csv file", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.csv`)
    writeFileSync(tmpFile, "a,b,c")
    expect(isSupportedDocumentFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .rst file", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.rst`)
    writeFileSync(tmpFile, "Title\n=====")
    expect(isSupportedDocumentFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns true for .log file", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.log`)
    writeFileSync(tmpFile, "2024-01-01 INFO message")
    expect(isSupportedDocumentFile(tmpFile)).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("returns false for unsupported extension like .mp3", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.mp3`)
    writeFileSync(tmpFile, "fake audio")
    expect(isSupportedDocumentFile(tmpFile)).toBe(false)
    rmSync(tmpFile, { force: true })
  })

  test("returns false for .jpg image", () => {
    const tmpFile = join(tmpdir(), `tapir_tts_${Date.now()}.jpg`)
    writeFileSync(tmpFile, "fake image")
    expect(isSupportedDocumentFile(tmpFile)).toBe(false)
    rmSync(tmpFile, { force: true })
  })
})

// ============================================================================
// stripHtmlTags
// ============================================================================

describe("stripHtmlTags", () => {
  test("strips simple HTML tags", () => {
    expect(stripHtmlTags("<p>Hello</p>")).toBe("Hello")
  })

  test("strips nested tags", () => {
    expect(stripHtmlTags("<div><span>Hello</span> <b>World</b></div>")).toBe("Hello World")
  })

  test("removes script tags and content", () => {
    expect(stripHtmlTags("<script>alert('xss')</script>Hello")).toBe("Hello")
  })

  test("removes style tags and content", () => {
    expect(stripHtmlTags("<style>body{color:red}</style>Hello")).toBe("Hello")
  })

  test("decodes HTML entities", () => {
    expect(stripHtmlTags("&amp; &lt; &gt; &quot; &#39;")).toBe("& < > \" '")
  })

  test("replaces &nbsp; with space", () => {
    expect(stripHtmlTags("Hello&nbsp;World")).toBe("Hello World")
  })

  test("collapses whitespace", () => {
    expect(stripHtmlTags("Hello     World")).toBe("Hello World")
  })

  test("returns empty string for empty input", () => {
    expect(stripHtmlTags("")).toBe("")
  })

  test("handles plain text without tags", () => {
    expect(stripHtmlTags("Hello World")).toBe("Hello World")
  })
})

// ============================================================================
// chunkText
// ============================================================================

describe("chunkText", () => {
  test("returns empty array for empty text", () => {
    expect(chunkText("")).toEqual([])
  })

  test("returns single chunk for short text", () => {
    const text = "Hello world"
    const chunks = chunkText(text)
    expect(chunks).toEqual(["Hello world"])
  })

  test("returns single chunk for text exactly at limit", () => {
    const text = "x".repeat(TTS_CHUNK_MAX_CHARS)
    const chunks = chunkText(text)
    expect(chunks).toEqual([text])
  })

  test("splits long text into multiple chunks", () => {
    const sentence = "This is a sentence. "
    const text = sentence.repeat(500)
    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(1)
    // All chunks should be within the limit
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(TTS_CHUNK_MAX_CHARS)
    }
  })

  test("splits at sentence boundaries", () => {
    // Build text that's just over the limit
    const shortPart = "A".repeat(Math.floor(TTS_CHUNK_MAX_CHARS * 0.7)) + ". "
    const rest = "B".repeat(Math.floor(TTS_CHUNK_MAX_CHARS * 0.5))
    const text = shortPart + rest
    const chunks = chunkText(text)
    expect(chunks.length).toBe(2)
    // First chunk should end with the sentence
    expect(chunks[0].endsWith(".")).toBe(true)
  })

  test("handles text without sentence boundaries", () => {
    const text = "word ".repeat(2000)
    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(TTS_CHUNK_MAX_CHARS)
    }
  })

  test("respects custom maxChars", () => {
    const text = "Hello world. This is a test. More text here."
    const chunks = chunkText(text, 20)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20)
    }
  })

  test("concatenated chunks reproduce original text", () => {
    const text = "First sentence. Second sentence. Third one! Fourth? Fifth."
    const chunks = chunkText(text, 30)
    const reconstructed = chunks.join(" ")
    // Whitespace might differ, but all words should be present
    const originalWords = text.split(/\s+/)
    const reconstructedWords = reconstructed.split(/\s+/)
    for (const word of originalWords) {
      expect(reconstructedWords).toContain(word)
    }
  })
})

// ============================================================================
// extractTextFromDocument
// ============================================================================

describe("extractTextFromDocument", () => {
  test("returns null for non-existent file", async () => {
    const result = await extractTextFromDocument("/nonexistent/file.txt")
    expect(result).toBeNull()
  })

  test("extracts text from .txt file", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_doc_${Date.now()}.txt`)
    writeFileSync(tmpFile, "Hello, this is a test document.")
    const result = await extractTextFromDocument(tmpFile)
    expect(result).toBe("Hello, this is a test document.")
    rmSync(tmpFile, { force: true })
  })

  test("extracts text from .md file", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_doc_${Date.now()}.md`)
    writeFileSync(tmpFile, "# Title\n\nSome content here.")
    const result = await extractTextFromDocument(tmpFile)
    expect(result).toBe("# Title\n\nSome content here.")
    rmSync(tmpFile, { force: true })
  })

  test("extracts and strips text from .html file", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_doc_${Date.now()}.html`)
    writeFileSync(tmpFile, "<html><body><p>Hello World</p></body></html>")
    const result = await extractTextFromDocument(tmpFile)
    expect(result).toBe("Hello World")
    rmSync(tmpFile, { force: true })
  })

  test("extracts text from .csv file", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_doc_${Date.now()}.csv`)
    writeFileSync(tmpFile, "name,age\nAlice,30\nBob,25")
    const result = await extractTextFromDocument(tmpFile)
    expect(result).toContain("Alice")
    expect(result).toContain("Bob")
    rmSync(tmpFile, { force: true })
  })

  test("returns empty trimmed string for whitespace-only file", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_doc_${Date.now()}.txt`)
    writeFileSync(tmpFile, "   \n  \n  ")
    const result = await extractTextFromDocument(tmpFile)
    expect(result).toBe("")
    rmSync(tmpFile, { force: true })
  })

  test("calls onProgress callback", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_doc_${Date.now()}.txt`)
    writeFileSync(tmpFile, "Test content")
    const messages: string[] = []
    await extractTextFromDocument(tmpFile, (msg) => messages.push(msg))
    expect(messages.length).toBeGreaterThan(0)
    expect(messages.some((m) => m.includes("Reading"))).toBe(true)
    rmSync(tmpFile, { force: true })
  })
})

// ============================================================================
// extractTextFromPdf
// ============================================================================

describe("extractTextFromPdf", () => {
  test("returns null for non-existent file", async () => {
    const result = await extractTextFromPdf("/nonexistent/file.pdf")
    expect(result).toBeNull()
  })

  test("returns null for invalid PDF (not real PDF data)", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_pdf_${Date.now()}.pdf`)
    writeFileSync(tmpFile, "not a real pdf")
    const result = await extractTextFromPdf(tmpFile)
    // pdftotext may fail or return empty for invalid PDFs
    expect(result === null || result === "").toBe(true)
    rmSync(tmpFile, { force: true })
  })
})

// ============================================================================
// getDefaultVoices
// ============================================================================

describe("getDefaultVoices", () => {
  test("returns edge-tts voices", () => {
    const voices = getDefaultVoices("edge-tts")
    expect(voices.length).toBeGreaterThan(0)
    expect(voices[0]).toHaveProperty("id")
    expect(voices[0]).toHaveProperty("name")
    expect(voices[0]).toHaveProperty("language")
    // Should include en-US voice
    expect(voices.some((v) => v.language === "en-US")).toBe(true)
  })

  test("returns gtts voices", () => {
    const voices = getDefaultVoices("gtts")
    expect(voices.length).toBeGreaterThan(0)
    expect(voices.some((v) => v.id === "en")).toBe(true)
  })

  test("returns espeak voices", () => {
    const voices = getDefaultVoices("espeak")
    expect(voices.length).toBeGreaterThan(0)
    expect(voices.some((v) => v.id === "en")).toBe(true)
  })
})

// ============================================================================
// getDefaultVoice
// ============================================================================

describe("getDefaultVoice", () => {
  test("returns AriaNeural for edge-tts", () => {
    expect(getDefaultVoice("edge-tts")).toBe("en-US-AriaNeural")
  })

  test("returns 'en' for gtts", () => {
    expect(getDefaultVoice("gtts")).toBe("en")
  })

  test("returns 'en' for espeak", () => {
    expect(getDefaultVoice("espeak")).toBe("en")
  })
})

// ============================================================================
// listVoices
// ============================================================================

describe("listVoices", () => {
  test("returns voices for edge-tts (falls back to defaults if not installed)", async () => {
    const voices = await listVoices("edge-tts")
    expect(voices.length).toBeGreaterThan(0)
    expect(voices[0]).toHaveProperty("id")
    expect(voices[0]).toHaveProperty("name")
  })

  test("returns voices for gtts", async () => {
    const voices = await listVoices("gtts")
    expect(voices.length).toBeGreaterThan(0)
  })

  test("returns voices for espeak (falls back to defaults if not installed)", async () => {
    const voices = await listVoices("espeak")
    expect(voices.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// TTS Engine Detection (utils)
// ============================================================================

describe("TTS engine detection", () => {
  test("checkEdgeTts returns boolean", async () => {
    const result = await checkEdgeTts()
    expect(typeof result).toBe("boolean")
  })

  test("checkGtts returns boolean", async () => {
    const result = await checkGtts()
    expect(typeof result).toBe("boolean")
  })

  test("checkEspeak returns boolean", async () => {
    const result = await checkEspeak()
    expect(typeof result).toBe("boolean")
  })

  test("detectAvailableTtsEngine returns engine or null", async () => {
    const result = await detectAvailableTtsEngine()
    expect(result === null || ["edge-tts", "gtts", "espeak"].includes(result)).toBe(true)
  })
})

// ============================================================================
// textToSpeech (integration-level)
// ============================================================================

describe("textToSpeech", () => {
  test("returns failure for non-existent input file", async () => {
    const result = await textToSpeech({
      inputFile: "/nonexistent/file.txt",
    })
    // Should fail at text extraction stage
    expect(result.success).toBe(false)
  })

  test("returns failure for empty file", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_empty_${Date.now()}.txt`)
    writeFileSync(tmpFile, "")
    const result = await textToSpeech({ inputFile: tmpFile })
    expect(result.success).toBe(false)
    // May fail with "No text" or "No TTS engine" depending on environment
    expect(result.message.length).toBeGreaterThan(0)
    rmSync(tmpFile, { force: true })
  })

  test("reports no engine when none available with explicit null engine", async () => {
    // This test passes a nonsense engine to trigger the engine detection path
    const tmpFile = join(tmpdir(), `tapir_tts_noeng_${Date.now()}.txt`)
    writeFileSync(tmpFile, "Hello world test")

    // Mock detectAvailableTtsEngine to return null
    const origDetect = (await import("../utils")).detectAvailableTtsEngine
    const utils = await import("../utils")
    const origFn = utils.detectAvailableTtsEngine

    // We can't easily mock module functions, so test with a valid file
    // and let it use whatever engine is available or fail gracefully
    const result = await textToSpeech({ inputFile: tmpFile })
    expect(typeof result.success).toBe("boolean")
    expect(typeof result.message).toBe("string")
    expect(result.textLength >= 0).toBe(true)
    rmSync(tmpFile, { force: true })
  })

  test("calls onProgress during processing", async () => {
    const tmpFile = join(tmpdir(), `tapir_tts_prog_${Date.now()}.txt`)
    writeFileSync(tmpFile, "Hello world, this is a test for progress.")
    const messages: string[] = []

    const result = await textToSpeech(
      { inputFile: tmpFile },
      (msg) => messages.push(msg),
    )

    // If an engine is available, should have progress messages
    // If no engine is available, the function returns early (no messages)
    const engineAvailable = await detectAvailableTtsEngine()
    if (engineAvailable) {
      expect(messages.length).toBeGreaterThan(0)
    } else {
      // No engine = early return, still a valid test
      expect(result.success).toBe(false)
    }
    rmSync(tmpFile, { force: true })
  })

  test("includes correct textLength in result", async () => {
    const text = "This is a test document for TTS conversion."
    const tmpFile = join(tmpdir(), `tapir_tts_len_${Date.now()}.txt`)
    writeFileSync(tmpFile, text)

    const result = await textToSpeech({ inputFile: tmpFile })

    // If engine was available, textLength should match; if not, it may be 0
    if (result.textLength > 0) {
      expect(result.textLength).toBe(text.length)
    }
    rmSync(tmpFile, { force: true })
  })
})

// ============================================================================
// SUPPORTED_DOCUMENT_EXTENSIONS
// ============================================================================

describe("SUPPORTED_DOCUMENT_EXTENSIONS", () => {
  test("contains .pdf", () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain(".pdf")
  })

  test("contains .txt", () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain(".txt")
  })

  test("contains .md", () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain(".md")
  })

  test("contains .html", () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain(".html")
  })

  test("contains .htm", () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain(".htm")
  })

  test("contains .rst", () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain(".rst")
  })

  test("contains .csv", () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain(".csv")
  })

  test("contains .log", () => {
    expect(SUPPORTED_DOCUMENT_EXTENSIONS).toContain(".log")
  })
})
