/**
 * Text-to-Speech service - converts documents (PDF, TXT, etc.) to speech audio
 *
 * Supported TTS engines (in priority order):
 *   1. edge-tts  - Microsoft Edge TTS (high quality, many voices/languages)
 *   2. gtts-cli  - Google Text-to-Speech (good quality, simple)
 *   3. espeak    - eSpeak / eSpeak-NG (offline, lower quality)
 *
 * Document parsing:
 *   - PDF: uses pdftotext (from poppler-utils) for robust text extraction
 *   - TXT/MD/RST/CSV/LOG/HTML: read directly as text, HTML tags stripped
 */

import { existsSync, readFileSync, statSync, unlinkSync, readdirSync } from "fs"
import { extname, basename, join, dirname } from "path"
import type { TTSEngine, TTSVoice, TTSOptions, TTSResult, TTSOutputFormat } from "../types"
import {
  getDownloadDirectory,
  sanitizeFilename,
  formatSize,
  detectAvailableTtsEngine,
  checkPdfToText,
  isSupportedDocumentFile,
  TTS_CHUNK_MAX_CHARS,
  SUBPROCESS_TIMEOUT,
} from "../utils"

// ============================================================================
// Document Text Extraction
// ============================================================================

/**
 * Extract text from a PDF file using pdftotext (poppler-utils).
 */
export async function extractTextFromPdf(filePath: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["pdftotext", "-layout", filePath, "-"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode === 0 && stdout.trim()) {
      return stdout.trim()
    }

    // Fallback: try without -layout
    const proc2 = Bun.spawn(["pdftotext", filePath, "-"], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout2 = await new Response(proc2.stdout).text()
    const exitCode2 = await proc2.exited

    if (exitCode2 === 0 && stdout2.trim()) {
      return stdout2.trim()
    }

    return null
  } catch {
    return null
  }
}

/**
 * Strip HTML tags from text content.
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Extract readable text from a document file.
 * Supports PDF, TXT, MD, RST, HTML, CSV, LOG.
 */
export async function extractTextFromDocument(
  filePath: string,
  onProgress?: (message: string) => void,
): Promise<string | null> {
  if (!existsSync(filePath)) {
    onProgress?.(`File not found: ${filePath}`)
    return null
  }

  const ext = extname(filePath).toLowerCase()
  const fileSize = statSync(filePath).size

  onProgress?.(`Reading ${basename(filePath)} (${formatSize(fileSize)})...`)

  switch (ext) {
    case ".pdf": {
      onProgress?.("Extracting text from PDF...")
      const text = await extractTextFromPdf(filePath)
      if (!text) {
        onProgress?.("PDF text extraction failed. Is pdftotext (poppler-utils) installed?")
        return null
      }
      return text
    }

    case ".html":
    case ".htm": {
      const raw = readFileSync(filePath, "utf-8")
      return stripHtmlTags(raw)
    }

    case ".txt":
    case ".md":
    case ".rst":
    case ".csv":
    case ".log":
    default: {
      const raw = readFileSync(filePath, "utf-8")
      return raw.trim()
    }
  }
}

// ============================================================================
// Text Chunking
// ============================================================================

/**
 * Split text into chunks suitable for TTS processing.
 * Tries to split at sentence boundaries for natural-sounding speech.
 */
export function chunkText(text: string, maxChars: number = TTS_CHUNK_MAX_CHARS): string[] {
  if (!text || text.length === 0) return []
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim())
      break
    }

    // Try to split at sentence boundary (. ! ? followed by space)
    let splitIdx = -1
    const searchRange = remaining.slice(0, maxChars)

    // Search backwards for sentence-ending punctuation
    for (let i = searchRange.length - 1; i >= Math.floor(maxChars * 0.5); i--) {
      if ((searchRange[i] === "." || searchRange[i] === "!" || searchRange[i] === "?") &&
          (i + 1 >= searchRange.length || searchRange[i + 1] === " " || searchRange[i + 1] === "\n")) {
        splitIdx = i + 1
        break
      }
    }

    // Fallback: split at last space
    if (splitIdx === -1) {
      splitIdx = searchRange.lastIndexOf(" ")
    }

    // Last resort: hard split
    if (splitIdx === -1 || splitIdx === 0) {
      splitIdx = maxChars
    }

    chunks.push(remaining.slice(0, splitIdx).trim())
    remaining = remaining.slice(splitIdx).trim()
  }

  return chunks.filter((c) => c.length > 0)
}

// ============================================================================
// Voice Listing
// ============================================================================

/**
 * List available voices for the given TTS engine.
 */
export async function listVoices(engine: TTSEngine): Promise<TTSVoice[]> {
  switch (engine) {
    case "edge-tts": {
      try {
        const proc = Bun.spawn(["edge-tts", "--list-voices"], {
          stdout: "pipe",
          stderr: "pipe",
        })
        const stdout = await new Response(proc.stdout).text()
        const exitCode = await proc.exited

        if (exitCode !== 0) return getDefaultVoices(engine)

        const voices: TTSVoice[] = []
        let current: Partial<TTSVoice> = {}

        for (const line of stdout.split("\n")) {
          const trimmed = line.trim()
          if (trimmed.startsWith("Name: ")) {
            if (current.id) voices.push(current as TTSVoice)
            current = { id: trimmed.slice(6).trim() }
            current.name = current.id.split("-").slice(2).join(" ").replace(/Neural$/, "").trim() || current.id
          } else if (trimmed.startsWith("Gender: ")) {
            current.gender = trimmed.slice(8).trim()
          } else if (trimmed.startsWith("Locale: ")) {
            current.language = trimmed.slice(8).trim()
          }
        }
        if (current.id) voices.push(current as TTSVoice)

        return voices.length > 0 ? voices : getDefaultVoices(engine)
      } catch {
        return getDefaultVoices(engine)
      }
    }

    case "gtts":
      return getDefaultVoices(engine)

    case "espeak": {
      try {
        const cmd = existsSync("/usr/bin/espeak-ng") ? "espeak-ng" : "espeak"
        const proc = Bun.spawn([cmd, "--voices"], {
          stdout: "pipe",
          stderr: "pipe",
        })
        const stdout = await new Response(proc.stdout).text()
        const exitCode = await proc.exited

        if (exitCode !== 0) return getDefaultVoices(engine)

        const voices: TTSVoice[] = []
        for (const line of stdout.split("\n").slice(1)) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 4) {
            voices.push({
              id: parts[4] || parts[3],
              name: parts[3],
              language: parts[1],
              gender: parts[2]?.includes("M") ? "Male" : "Female",
            })
          }
        }
        return voices.length > 0 ? voices : getDefaultVoices(engine)
      } catch {
        return getDefaultVoices(engine)
      }
    }
  }
}

/**
 * Get a set of well-known default voices for the engine.
 */
export function getDefaultVoices(engine: TTSEngine): TTSVoice[] {
  switch (engine) {
    case "edge-tts":
      return [
        { id: "en-US-AriaNeural", name: "Aria", language: "en-US", gender: "Female" },
        { id: "en-US-GuyNeural", name: "Guy", language: "en-US", gender: "Male" },
        { id: "en-US-JennyNeural", name: "Jenny", language: "en-US", gender: "Female" },
        { id: "en-GB-SoniaNeural", name: "Sonia", language: "en-GB", gender: "Female" },
        { id: "en-GB-RyanNeural", name: "Ryan", language: "en-GB", gender: "Male" },
        { id: "en-AU-NatashaNeural", name: "Natasha", language: "en-AU", gender: "Female" },
        { id: "es-ES-ElviraNeural", name: "Elvira", language: "es-ES", gender: "Female" },
        { id: "fr-FR-DeniseNeural", name: "Denise", language: "fr-FR", gender: "Female" },
        { id: "de-DE-KatjaNeural", name: "Katja", language: "de-DE", gender: "Female" },
        { id: "ja-JP-NanamiNeural", name: "Nanami", language: "ja-JP", gender: "Female" },
        { id: "zh-CN-XiaoxiaoNeural", name: "Xiaoxiao", language: "zh-CN", gender: "Female" },
        { id: "pt-BR-FranciscaNeural", name: "Francisca", language: "pt-BR", gender: "Female" },
      ]
    case "gtts":
      return [
        { id: "en", name: "English", language: "en" },
        { id: "es", name: "Spanish", language: "es" },
        { id: "fr", name: "French", language: "fr" },
        { id: "de", name: "German", language: "de" },
        { id: "ja", name: "Japanese", language: "ja" },
        { id: "zh-CN", name: "Chinese", language: "zh-CN" },
        { id: "pt", name: "Portuguese", language: "pt" },
      ]
    case "espeak":
      return [
        { id: "en", name: "English", language: "en", gender: "Male" },
        { id: "en+f3", name: "English Female", language: "en", gender: "Female" },
        { id: "es", name: "Spanish", language: "es", gender: "Male" },
        { id: "fr", name: "French", language: "fr", gender: "Male" },
        { id: "de", name: "German", language: "de", gender: "Male" },
      ]
  }
}

/**
 * Get the default voice ID for the given engine.
 */
export function getDefaultVoice(engine: TTSEngine): string {
  switch (engine) {
    case "edge-tts": return "en-US-AriaNeural"
    case "gtts": return "en"
    case "espeak": return "en"
  }
}

// ============================================================================
// TTS Generation
// ============================================================================

/**
 * Generate speech audio from a single text chunk using the specified engine.
 */
async function generateChunk(
  text: string,
  outputFile: string,
  engine: TTSEngine,
  voice: string,
  outputFormat: TTSOutputFormat,
): Promise<boolean> {
  switch (engine) {
    case "edge-tts": {
      // edge-tts outputs mp3 by default
      const tmpMp3 = outputFormat === "mp3" ? outputFile : outputFile + ".tmp.mp3"
      const proc = Bun.spawn(
        ["edge-tts", "--voice", voice, "--text", text, "--write-media", tmpMp3],
        { stdout: "pipe", stderr: "pipe" },
      )
      const exitCode = await proc.exited

      if (exitCode !== 0) return false

      if (outputFormat !== "mp3") {
        // Convert to target format using ffmpeg
        const convProc = Bun.spawn(
          ["ffmpeg", "-i", tmpMp3, "-y", outputFile],
          { stdout: "pipe", stderr: "pipe" },
        )
        const convExit = await convProc.exited
        try { unlinkSync(tmpMp3) } catch {}
        return convExit === 0
      }
      return true
    }

    case "gtts": {
      const tmpMp3 = outputFormat === "mp3" ? outputFile : outputFile + ".tmp.mp3"
      const proc = Bun.spawn(
        ["gtts-cli", "-l", voice, "-o", tmpMp3, text],
        { stdout: "pipe", stderr: "pipe" },
      )
      const exitCode = await proc.exited

      if (exitCode !== 0) return false

      if (outputFormat !== "mp3") {
        const convProc = Bun.spawn(
          ["ffmpeg", "-i", tmpMp3, "-y", outputFile],
          { stdout: "pipe", stderr: "pipe" },
        )
        const convExit = await convProc.exited
        try { unlinkSync(tmpMp3) } catch {}
        return convExit === 0
      }
      return true
    }

    case "espeak": {
      const cmd = existsSync("/usr/bin/espeak-ng") ? "espeak-ng" : "espeak"
      const tmpWav = outputFormat === "wav" ? outputFile : outputFile + ".tmp.wav"
      const proc = Bun.spawn(
        [cmd, "-v", voice, "-w", tmpWav, text],
        { stdout: "pipe", stderr: "pipe" },
      )
      const exitCode = await proc.exited

      if (exitCode !== 0) return false

      if (outputFormat !== "wav") {
        const convProc = Bun.spawn(
          ["ffmpeg", "-i", tmpWav, "-y", outputFile],
          { stdout: "pipe", stderr: "pipe" },
        )
        const convExit = await convProc.exited
        try { unlinkSync(tmpWav) } catch {}
        return convExit === 0
      }
      return true
    }
  }
}

/**
 * Concatenate multiple audio files into one using ffmpeg.
 */
async function concatenateAudioFiles(
  files: string[],
  outputFile: string,
): Promise<boolean> {
  if (files.length === 0) return false
  if (files.length === 1) {
    // Just rename/copy the single file
    const { copyFileSync } = await import("fs")
    try {
      copyFileSync(files[0], outputFile)
      return true
    } catch {
      return false
    }
  }

  // Build ffmpeg concat filter
  const inputArgs: string[] = []
  const filterParts: string[] = []

  for (let i = 0; i < files.length; i++) {
    inputArgs.push("-i", files[i])
    filterParts.push(`[${i}:a]`)
  }

  const filter = `${filterParts.join("")}concat=n=${files.length}:v=0:a=1[out]`

  const args = [
    "ffmpeg",
    ...inputArgs,
    "-filter_complex", filter,
    "-map", "[out]",
    "-y",
    outputFile,
  ]

  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
  const exitCode = await proc.exited
  return exitCode === 0
}

// ============================================================================
// Main TTS Pipeline
// ============================================================================

/**
 * Convert a document file to speech audio.
 *
 * Pipeline:
 *   1. Extract text from document
 *   2. Chunk text if needed
 *   3. Generate speech for each chunk
 *   4. Concatenate chunks into final audio file
 */
export async function textToSpeech(
  options: TTSOptions,
  onProgress?: (message: string) => void,
): Promise<TTSResult> {
  const {
    inputFile,
    voice,
    outputFormat = "mp3",
    outputDir = "youtube_downloads",
    engine: requestedEngine,
  } = options

  // Detect engine
  const engine = requestedEngine || (await detectAvailableTtsEngine())
  if (!engine) {
    return {
      success: false,
      engine: "edge-tts",
      voice: voice || "unknown",
      textLength: 0,
      chunkCount: 0,
      message: "No TTS engine found. Install edge-tts (pip install edge-tts), gtts (pip install gTTS), or espeak.",
    }
  }

  onProgress?.(`Using TTS engine: ${engine}`)

  const voiceId = voice || getDefaultVoice(engine)
  onProgress?.(`Voice: ${voiceId}`)

  // Step 1: Extract text
  onProgress?.("Step 1: Extracting text from document...")
  const text = await extractTextFromDocument(inputFile, onProgress)

  if (!text || text.trim().length === 0) {
    return {
      success: false,
      engine,
      voice: voiceId,
      textLength: 0,
      chunkCount: 0,
      message: "No text could be extracted from the document.",
    }
  }

  onProgress?.(`Extracted ${text.length} characters of text`)

  // Step 2: Chunk text
  onProgress?.("Step 2: Preparing text chunks...")
  const chunks = chunkText(text)
  onProgress?.(`Split into ${chunks.length} chunk(s)`)

  // Step 3: Generate speech for each chunk
  const safeDir = getDownloadDirectory(outputDir)
  const inputBase = sanitizeFilename(basename(inputFile, extname(inputFile)))
  const chunkFiles: string[] = []

  onProgress?.("Step 3: Generating speech...")

  for (let i = 0; i < chunks.length; i++) {
    const chunkFile = join(safeDir, `${inputBase}_tts_chunk_${i}.${outputFormat}`)
    onProgress?.(`Generating chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)...`)

    const success = await generateChunk(chunks[i], chunkFile, engine, voiceId, outputFormat)

    if (!success) {
      // Clean up chunk files
      for (const f of chunkFiles) {
        try { unlinkSync(f) } catch {}
      }
      return {
        success: false,
        engine,
        voice: voiceId,
        textLength: text.length,
        chunkCount: chunks.length,
        message: `Failed to generate speech for chunk ${i + 1}/${chunks.length}`,
      }
    }

    chunkFiles.push(chunkFile)
  }

  // Step 4: Concatenate if multiple chunks
  const finalOutput = join(safeDir, `${inputBase}.${outputFormat}`)

  if (chunkFiles.length > 1) {
    onProgress?.("Step 4: Merging audio chunks...")
    const concatSuccess = await concatenateAudioFiles(chunkFiles, finalOutput)

    // Clean up chunk files
    for (const f of chunkFiles) {
      try { unlinkSync(f) } catch {}
    }

    if (!concatSuccess) {
      return {
        success: false,
        engine,
        voice: voiceId,
        textLength: text.length,
        chunkCount: chunks.length,
        message: "Failed to merge audio chunks. Is ffmpeg installed?",
      }
    }
  } else if (chunkFiles.length === 1) {
    // Rename single chunk to final output
    const { renameSync } = await import("fs")
    try {
      renameSync(chunkFiles[0], finalOutput)
    } catch {
      // Cross-device rename fallback
      const { copyFileSync } = await import("fs")
      copyFileSync(chunkFiles[0], finalOutput)
      try { unlinkSync(chunkFiles[0]) } catch {}
    }
  }

  if (!existsSync(finalOutput)) {
    return {
      success: false,
      engine,
      voice: voiceId,
      textLength: text.length,
      chunkCount: chunks.length,
      message: "Output file was not created.",
    }
  }

  const outputSize = statSync(finalOutput).size
  onProgress?.(`Speech generated: ${finalOutput} (${formatSize(outputSize)})`)

  return {
    success: true,
    outputFile: finalOutput,
    engine,
    voice: voiceId,
    textLength: text.length,
    chunkCount: chunks.length,
    message: `Successfully converted ${text.length} characters to speech using ${engine}`,
  }
}
