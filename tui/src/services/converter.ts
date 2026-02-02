/**
 * Audio conversion service - wraps FFmpeg for audio format conversion
 */

import { $ } from "bun"
import { existsSync, statSync } from "fs"
import { extname, basename, join, dirname } from "path"
import type { AudioMetadata, ConversionOptions, AudioFormatInfo } from "../types"
import { getSupportedAudioFormats, formatSize, SUBPROCESS_TIMEOUT } from "../utils"

const SUPPORTED_INPUT_EXTENSIONS = [".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".wma"]

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract audio metadata using ffprobe.
 */
export async function getAudioMetadata(filePath: string): Promise<AudioMetadata | null> {
  try {
    const proc = Bun.spawn(
      ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath],
      { stdout: "pipe", stderr: "pipe" },
    )
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode === 0) {
      return JSON.parse(stdout) as AudioMetadata
    }
    return null
  } catch {
    return null
  }
}

/**
 * Get file info: size, duration, bitrate.
 */
export async function getFileInfo(
  filePath: string,
): Promise<{ size: number; duration: number | null; bitrate: number | null }> {
  const stats = statSync(filePath)
  const size = stats.size

  const metadata = await getAudioMetadata(filePath)
  let duration: number | null = null
  let bitrate: number | null = null

  if (metadata?.format) {
    duration = metadata.format.duration ? parseFloat(metadata.format.duration) : null
    bitrate = metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) / 1000 : null
  }

  // Try streams if format didn't have bitrate
  if (!bitrate && metadata?.streams) {
    for (const stream of metadata.streams) {
      if (stream.codec_type === "audio" && stream.bit_rate) {
        bitrate = parseInt(stream.bit_rate) / 1000
        break
      }
    }
  }

  return { size, duration, bitrate }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if a file is a supported audio input format.
 */
export function isSupportedAudioFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false
  const ext = extname(filePath).toLowerCase()
  return SUPPORTED_INPUT_EXTENSIONS.includes(ext)
}

// ============================================================================
// Size Estimation
// ============================================================================

/**
 * Estimate output file size based on duration and target bitrate.
 */
export function estimateOutputSize(durationSeconds: number, bitrateKbps: number): number {
  return Math.floor((bitrateKbps * 1000 * durationSeconds) / 8)
}

/**
 * Describe quality based on codec and bitrate.
 */
export function getQualityDescription(codec: string, bitrateKbps: number): string {
  if (!bitrateKbps) return "Unknown quality"
  const c = codec.toLowerCase()

  if (["mp3", "aac", "vorbis", "opus"].some((x) => c.includes(x))) {
    if (bitrateKbps >= 320) return "Very High (320kbps)"
    if (bitrateKbps >= 256) return "High (256kbps)"
    if (bitrateKbps >= 192) return "Good (192kbps)"
    if (bitrateKbps >= 128) return "Standard (128kbps)"
    return `Low (${bitrateKbps}kbps)`
  }

  if (["flac", "wav", "alac", "pcm"].some((x) => c.includes(x))) {
    return "Lossless (Original Quality)"
  }

  return `${bitrateKbps}kbps`
}

// ============================================================================
// Conversion
// ============================================================================

/**
 * Convert audio file to specified format using FFmpeg.
 * Returns the output file path on success, or null on failure.
 */
export async function convertAudioFile(
  options: ConversionOptions,
  onProgress?: (message: string) => void,
): Promise<string | null> {
  const formats = getSupportedAudioFormats()
  const formatKey = options.outputFormat.toLowerCase()
  const formatInfo = formats[formatKey]

  if (!formatInfo) {
    onProgress?.(`Error: Unsupported format '${options.outputFormat}'`)
    return null
  }

  const bitrate = options.bitrate || formatInfo.defaultBitrate
  const inputBase = basename(options.inputFile, extname(options.inputFile))
  const outputFile = join(dirname(options.inputFile), `${inputBase}.${formatKey}`)

  onProgress?.(`Converting '${basename(options.inputFile)}' to ${formatInfo.name}...`)

  const args = ["ffmpeg", "-i", options.inputFile]

  if (["wav", "flac"].includes(formatKey)) {
    args.push("-c:a", formatInfo.codec)
  } else {
    args.push("-c:a", formatInfo.codec, "-b:a", `${bitrate}k`)
  }

  args.push("-y", outputFile)

  try {
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode === 0) {
      const outSize = statSync(outputFile).size
      onProgress?.(`Conversion successful! Output: ${outputFile} (${formatSize(outSize)})`)
      return outputFile
    } else {
      onProgress?.(`Conversion failed: ${stderr.slice(0, 200)}`)
      return null
    }
  } catch (err) {
    onProgress?.(`Conversion error: ${err}`)
    return null
  }
}
