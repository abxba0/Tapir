/**
 * Transcription service - subtitle extraction via yt-dlp and speech-to-text via Whisper
 */

import { $ } from "bun"
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "fs"
import { join, extname, basename } from "path"
import type {
  TranscriptionResult,
  TranscriptionSegment,
  TranscriptionOptions,
  TranscriptionFormat,
  WhisperModelSize,
} from "../types"
import {
  getDownloadDirectory,
  parseSubtitleToText,
  formatTimestampSrt,
  formatTimestampVtt,
  sanitizeFilename,
  formatSize,
} from "../utils"

// ============================================================================
// Subtitle Extraction (yt-dlp)
// ============================================================================

/**
 * Try to extract existing subtitles/captions from a URL using yt-dlp.
 * This is the fastest method - no audio processing needed.
 */
export async function extractSubtitlesFromUrl(
  url: string,
  outputDir: string,
  language: string = "en",
  cookiesFile?: string,
  cookiesFromBrowser?: string,
  onProgress?: (message: string) => void,
): Promise<{ text: string; filePath: string } | null> {
  const safeDir = getDownloadDirectory(outputDir)

  // First, check what subtitles are available
  const infoArgs = [
    "yt-dlp",
    "--dump-json",
    "--no-download",
    "--no-warnings",
    "--quiet",
  ]
  if (cookiesFile) infoArgs.push("--cookies", cookiesFile)
  if (cookiesFromBrowser) infoArgs.push("--cookies-from-browser", cookiesFromBrowser)
  infoArgs.push(url)

  try {
    onProgress?.("Checking for available subtitles...")
    const infoProc = Bun.spawn(infoArgs, { stdout: "pipe", stderr: "pipe" })
    const infoStdout = await new Response(infoProc.stdout).text()
    const infoExit = await infoProc.exited

    if (infoExit !== 0) return null

    const info = JSON.parse(infoStdout.trim().split("\n")[0])
    const subtitles = info.subtitles || {}
    const autoCaptions = info.automatic_captions || {}

    // Find matching language subtitles (prefer manual over auto)
    let langKey: string | null = null

    for (const key of Object.keys(subtitles)) {
      if (key.startsWith(language)) {
        langKey = key
        break
      }
    }
    if (!langKey) {
      for (const key of Object.keys(autoCaptions)) {
        if (key.startsWith(language)) {
          langKey = key
          break
        }
      }
    }

    if (!langKey) {
      onProgress?.("No subtitles found for the specified language.")
      return null
    }

    onProgress?.(`Found ${langKey} subtitles, downloading...`)

    // Download subtitles using yt-dlp
    const dlArgs = [
      "yt-dlp",
      "--skip-download",
      "--write-sub",
      "--write-auto-sub",
      "--sub-lang", langKey,
      "--sub-format", "srt/vtt/best",
      "--no-warnings",
      "--quiet",
      "-o", join(safeDir, "%(title)s.%(ext)s"),
    ]

    if (cookiesFile) dlArgs.push("--cookies", cookiesFile)
    if (cookiesFromBrowser) dlArgs.push("--cookies-from-browser", cookiesFromBrowser)
    dlArgs.push(url)

    const dlProc = Bun.spawn(dlArgs, { stdout: "pipe", stderr: "pipe" })
    await dlProc.exited

    // Find the downloaded subtitle file
    const files = readdirSync(safeDir)
    for (const fname of files) {
      if (
        (fname.endsWith(".srt") || fname.endsWith(".vtt")) &&
        (fname.includes(langKey) || fname.includes(language))
      ) {
        const filePath = join(safeDir, fname)
        const content = readFileSync(filePath, "utf-8")
        if (content.trim()) {
          return { text: content, filePath }
        }
      }
    }

    // Broader search for any subtitle files
    for (const fname of files) {
      if (fname.endsWith(".srt") || fname.endsWith(".vtt")) {
        const filePath = join(safeDir, fname)
        const content = readFileSync(filePath, "utf-8")
        if (content.trim()) {
          return { text: content, filePath }
        }
      }
    }

    return null
  } catch (err) {
    onProgress?.(`Subtitle extraction error: ${err}`)
    return null
  }
}

// ============================================================================
// Audio Download for Transcription
// ============================================================================

/**
 * Download only the audio track from a URL for Whisper transcription.
 */
export async function downloadAudioForTranscription(
  url: string,
  outputDir: string,
  cookiesFile?: string,
  cookiesFromBrowser?: string,
  onProgress?: (message: string) => void,
): Promise<string | null> {
  const safeDir = getDownloadDirectory(outputDir)
  const outTemplate = join(safeDir, "transcription_audio.%(ext)s")

  const args = [
    "yt-dlp",
    "-f", "bestaudio/best",
    "-o", outTemplate,
    "--no-warnings",
    "--quiet",
    "-x",
    "--audio-format", "wav",
    "--audio-quality", "16K",
  ]

  if (cookiesFile) args.push("--cookies", cookiesFile)
  if (cookiesFromBrowser) args.push("--cookies-from-browser", cookiesFromBrowser)
  args.push(url)

  try {
    onProgress?.("Downloading audio for transcription...")
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      onProgress?.(`Audio download failed: ${stderr.slice(0, 200)}`)
      return null
    }

    // Find the downloaded file
    const wavPath = join(safeDir, "transcription_audio.wav")
    if (existsSync(wavPath)) return wavPath

    // Search for any transcription_audio file
    const files = readdirSync(safeDir)
    for (const fname of files) {
      if (fname.startsWith("transcription_audio")) {
        return join(safeDir, fname)
      }
    }

    return null
  } catch (err) {
    onProgress?.(`Audio download error: ${err}`)
    return null
  }
}

// ============================================================================
// Whisper Transcription
// ============================================================================

/**
 * Transcribe an audio/video file using faster-whisper (CTranslate2 backend).
 */
export async function transcribeWithWhisper(
  audioPath: string,
  modelSize: WhisperModelSize = "base",
  language?: string,
  outputDir?: string,
  onProgress?: (message: string) => void,
): Promise<TranscriptionResult | null> {
  const outDir = outputDir || getDownloadDirectory("youtube_downloads")

  onProgress?.(`Loading Whisper '${modelSize}' model...`)

  // Use faster-whisper via Python (no CLI available for faster-whisper)
  const script = `
import json
from faster_whisper import WhisperModel
model = WhisperModel("${modelSize}", device="cpu", compute_type="int8")
segments, info = model.transcribe("${audioPath.replace(/"/g, '\\"')}"${language ? `, language="${language}"` : ""})
seg_list = []
full_text = []
for s in segments:
    seg_list.append({"start": s.start, "end": s.end, "text": s.text})
    full_text.append(s.text)
output = {
    "text": " ".join(full_text),
    "segments": seg_list,
    "language": info.language
}
print(json.dumps(output))
`

  try {
    onProgress?.("Transcribing audio (this may take a while)...")
    const proc = Bun.spawn(["python3", "-c", script], {
      stdout: "pipe",
      stderr: "pipe",
    })

    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode === 0 && stdout.trim()) {
      const data = JSON.parse(stdout.trim())
      return {
        text: data.text,
        segments: data.segments,
        language: data.language,
      }
    }

    const stderr = await new Response(proc.stderr).text()
    onProgress?.(`Whisper error: ${stderr.slice(0, 200)}`)
    return null
  } catch (err) {
    onProgress?.(`Whisper error: ${err}`)
    return null
  }
}

// ============================================================================
// Save Transcription
// ============================================================================

/**
 * Save transcription text (and optional segments) to a file.
 */
export function saveTranscription(
  text: string,
  segments: TranscriptionSegment[] | null,
  outputPath: string,
  format: TranscriptionFormat = "txt",
): string | null {
  const basePath = outputPath.replace(/\.[^.]+$/, "")
  const outputFile = `${basePath}.${format}`

  try {
    let content = ""

    switch (format) {
      case "txt":
        content = text
        break

      case "srt":
        if (segments && segments.length > 0) {
          content = segments
            .map((seg, i) => {
              const start = formatTimestampSrt(seg.start)
              const end = formatTimestampSrt(seg.end)
              return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`
            })
            .join("\n")
        } else {
          content = `1\n00:00:00,000 --> 99:59:59,999\n${text}\n`
        }
        break

      case "vtt":
        content = "WEBVTT\n\n"
        if (segments && segments.length > 0) {
          content += segments
            .map((seg) => {
              const start = formatTimestampVtt(seg.start)
              const end = formatTimestampVtt(seg.end)
              return `${start} --> ${end}\n${seg.text.trim()}\n`
            })
            .join("\n")
        } else {
          content += `00:00:00.000 --> 99:59:59.999\n${text}\n`
        }
        break
    }

    writeFileSync(outputFile, content, "utf-8")
    return outputFile
  } catch (err) {
    return null
  }
}

/**
 * Full transcription pipeline: tries subtitles first, falls back to Whisper.
 */
export async function transcribeFromUrl(
  options: TranscriptionOptions,
  onProgress?: (message: string) => void,
): Promise<TranscriptionResult | null> {
  const {
    source,
    language,
    modelSize = "base",
    outputDir = "youtube_downloads",
    cookiesFile,
    cookiesFromBrowser,
  } = options

  const subLang = language || "en"

  // Step 1: Try subtitle extraction
  onProgress?.("Step 1: Checking for existing subtitles/captions...")
  const subResult = await extractSubtitlesFromUrl(source, outputDir, subLang, cookiesFile, cookiesFromBrowser, onProgress)

  if (subResult) {
    onProgress?.("Subtitles found! Parsing...")
    const plainText = parseSubtitleToText(subResult.text)
    return { text: plainText, segments: [], language: subLang }
  }

  // Step 2: Download audio and transcribe with Whisper
  onProgress?.("Step 2: No subtitles found. Downloading audio for Whisper transcription...")
  const audioPath = await downloadAudioForTranscription(source, outputDir, cookiesFile, cookiesFromBrowser, onProgress)

  if (!audioPath) {
    onProgress?.("Failed to download audio.")
    return null
  }

  onProgress?.(`Audio saved: ${audioPath}`)
  const result = await transcribeWithWhisper(audioPath, modelSize, language || undefined, outputDir, onProgress)

  // Clean up temporary audio
  try {
    unlinkSync(audioPath)
  } catch {
    // ignore cleanup errors
  }

  return result
}

/**
 * Transcribe a local media file with Whisper.
 */
export async function transcribeLocalFile(
  filePath: string,
  modelSize: WhisperModelSize = "base",
  language?: string,
  outputDir?: string,
  onProgress?: (message: string) => void,
): Promise<TranscriptionResult | null> {
  return transcribeWithWhisper(filePath, modelSize, language, outputDir, onProgress)
}
