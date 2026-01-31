/**
 * Transcription Screen - Interactive media transcription workflow
 *
 * Steps:
 *   1. Enter URL or local file path
 *   2. Select Whisper model
 *   3. Select output format
 *   4. Transcribe and display result
 */

import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core"
import type { SelectOption } from "@opentui/core"
import { colors, layout } from "../components/theme"
import {
  transcribeFromUrl,
  transcribeLocalFile,
  saveTranscription,
} from "../services/transcriber"
import { getVideoInfo } from "../services/downloader"
import {
  isLocalMediaFile,
  isValidUrl,
  detectSite,
  getSupportedSites,
  getWhisperModels,
  getDownloadDirectory,
  sanitizeFilename,
} from "../utils"
import type { WhisperModelSize, TranscriptionFormat, TranscriptionResult } from "../types"
import { existsSync } from "fs"
import { basename, join } from "path"

type Phase = "source_input" | "model_select" | "format_select" | "transcribing" | "done"

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let statusText: TextRenderable | null = null
let sourceInputBox: BoxRenderable | null = null
let sourceInput: InputRenderable | null = null
let modelSelect: SelectRenderable | null = null
let modelSelectBox: BoxRenderable | null = null
let formatSelect: SelectRenderable | null = null
let formatSelectBox: BoxRenderable | null = null
let progressText: TextRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: (() => void) | null = null
let currentPhase: Phase = "source_input"

let selectedSource = ""
let selectedLanguage: string | undefined = undefined
let selectedModel: WhisperModelSize = "base"
let selectedFormat: TranscriptionFormat = "txt"
let isLocal = false

function setStatus(msg: string, color: string = colors.text) {
  if (!renderer || !contentBox) return

  if (statusText) {
    statusText.content = msg
    statusText.fg = color
  } else {
    statusText = new TextRenderable(renderer, {
      id: "tr-status",
      content: msg,
      fg: color,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(statusText)
  }
}

function showSourceInput() {
  if (!renderer || !contentBox) return
  currentPhase = "source_input"

  setStatus(
    "Enter a URL or local file path to transcribe:\n" +
    "  URLs: YouTube, Instagram, TikTok, Vimeo, and 1800+ sites\n" +
    "  Files: MP3, WAV, FLAC, M4A, OGG, MP4, MKV, AVI, MOV, WebM",
    colors.textCyan,
  )

  sourceInputBox = new BoxRenderable(renderer, {
    id: "tr-source-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentPurple,
    title: "URL or File Path",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  sourceInput = new InputRenderable(renderer, {
    id: "tr-source-input",
    width: "auto",
    placeholder: "https://youtube.com/watch?v=... or /path/to/media.mp4",
    backgroundColor: colors.bgInput,
    focusedBackgroundColor: colors.bgInputFocused,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    placeholderColor: colors.textDim,
    cursorColor: colors.textBright,
    maxLength: 500,
    flexGrow: 1,
    flexShrink: 1,
  })

  sourceInput.on(InputRenderableEvents.ENTER, () => {
    let src = sourceInput?.value?.trim() || ""
    src = src.replace(/^["']|["']$/g, "")

    if (!src) {
      setStatus("Please enter a URL or file path.", colors.textRed)
      return
    }

    selectedSource = src
    isLocal = isLocalMediaFile(src) || (existsSync(src) && !src.startsWith("http"))

    if (isLocal && !existsSync(src)) {
      setStatus(`File not found: ${src}`, colors.textRed)
      return
    }

    if (!isLocal && !isValidUrl(src)) {
      setStatus("Invalid URL. Please enter a valid URL.", colors.textRed)
      return
    }

    showModelSelect()
  })

  sourceInputBox.add(sourceInput)
  contentBox.add(sourceInputBox)
  sourceInput.focus()
  sourceInputBox.focus()
}

function showModelSelect() {
  if (!renderer || !contentBox) return
  currentPhase = "model_select"

  if (sourceInput) { sourceInput.destroy(); sourceInput = null }
  if (sourceInputBox) { contentBox.remove(sourceInputBox.id); sourceInputBox = null }

  if (isLocal) {
    setStatus(`Local file: ${basename(selectedSource)}\n\nSelect Whisper model:`, colors.textGreen)
  } else {
    const site = detectSite(selectedSource)
    const siteInfo = getSupportedSites()[site] || { name: "Unknown" }
    setStatus(
      `URL: ${selectedSource}\nSite: ${siteInfo.name}\n\nSelect Whisper model (used if no subtitles available):`,
      colors.textGreen,
    )
  }

  const models = getWhisperModels()
  const modelOptions: SelectOption[] = Object.entries(models).map(([key, info]) => ({
    name: info.name,
    description: `${info.description} (~${info.sizeMb}MB)`,
    value: key,
  }))

  modelSelectBox = new BoxRenderable(renderer, {
    id: "tr-model-box",
    width: "auto",
    height: "auto",
    minHeight: 7,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentPurple,
    title: "Whisper Model",
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  modelSelect = new SelectRenderable(renderer, {
    id: "tr-model-select",
    width: "auto",
    height: "auto",
    minHeight: 5,
    options: modelOptions,
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accentPurple,
    selectedTextColor: "#ffffff",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textCyan,
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 1,
    flexShrink: 1,
  })

  modelSelect.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    selectedModel = option.value as WhisperModelSize
    showFormatSelect()
  })

  modelSelectBox.add(modelSelect)
  contentBox.add(modelSelectBox)
  modelSelect.focus()
  modelSelectBox.focus()
}

function showFormatSelect() {
  if (!renderer || !contentBox) return
  currentPhase = "format_select"

  if (modelSelect) { modelSelect.destroy(); modelSelect = null }
  if (modelSelectBox) { contentBox.remove(modelSelectBox.id); modelSelectBox = null }

  setStatus(`Model: ${selectedModel}\n\nSelect output format:`, colors.textGreen)

  const formatOptions: SelectOption[] = [
    { name: "TXT", description: "Plain text transcription", value: "txt" },
    { name: "SRT", description: "SubRip subtitle format with timestamps", value: "srt" },
    { name: "VTT", description: "WebVTT subtitle format with timestamps", value: "vtt" },
  ]

  formatSelectBox = new BoxRenderable(renderer, {
    id: "tr-format-box",
    width: "auto",
    height: "auto",
    minHeight: 5,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentPurple,
    title: "Output Format",
    titleAlignment: "center",
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  formatSelect = new SelectRenderable(renderer, {
    id: "tr-format-select",
    width: "auto",
    height: "auto",
    minHeight: 3,
    options: formatOptions,
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accentPurple,
    selectedTextColor: "#ffffff",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textCyan,
    showScrollIndicator: false,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 0,
    flexShrink: 0,
  })

  formatSelect.on(SelectRenderableEvents.ITEM_SELECTED, async (_index: number, option: SelectOption) => {
    selectedFormat = option.value as TranscriptionFormat
    await startTranscription()
  })

  formatSelectBox.add(formatSelect)
  contentBox.add(formatSelectBox)
  formatSelect.focus()
  formatSelectBox.focus()
}

async function startTranscription() {
  if (!renderer || !contentBox) return
  currentPhase = "transcribing"

  if (formatSelect) { formatSelect.destroy(); formatSelect = null }
  if (formatSelectBox) { contentBox.remove(formatSelectBox.id); formatSelectBox = null }

  setStatus(
    `Transcribing: ${isLocal ? basename(selectedSource) : selectedSource}\n` +
    `Model: ${selectedModel} | Format: ${selectedFormat.toUpperCase()}`,
    colors.textYellow,
  )

  progressText = new TextRenderable(renderer, {
    id: "tr-progress",
    content: "Starting transcription...",
    fg: colors.textCyan,
    bg: "transparent",
    flexGrow: 1,
    flexShrink: 1,
  })
  contentBox.add(progressText)

  const onProgress = (msg: string) => {
    if (progressText) {
      const lines = (String(progressText.content) || "").split("\n")
      if (lines.length > 10) lines.splice(0, lines.length - 10)
      lines.push(msg)
      progressText.content = lines.join("\n")
    }
  }

  let result: TranscriptionResult | null = null

  if (isLocal) {
    result = await transcribeLocalFile(selectedSource, selectedModel, selectedLanguage, "youtube_downloads", onProgress)
  } else {
    result = await transcribeFromUrl(
      {
        source: selectedSource,
        language: selectedLanguage,
        modelSize: selectedModel,
        outputFormat: selectedFormat,
        outputDir: "youtube_downloads",
      },
      onProgress,
    )
  }

  currentPhase = "done"

  if (!result || !result.text) {
    setStatus("Transcription failed or produced no text.", colors.textRed)
    if (footer) footer.content = "Press ESC or Q to return to main menu"
    return
  }

  // Save transcription
  let sourceTitle: string
  if (isLocal) {
    sourceTitle = basename(selectedSource).replace(/\.[^.]+$/, "")
  } else {
    const info = await getVideoInfo(selectedSource)
    sourceTitle = info?.title || "transcription"
  }

  const safeTitle = sanitizeFilename(sourceTitle)
  const outputDir = getDownloadDirectory("youtube_downloads")
  const outputPath = join(outputDir, safeTitle)
  const savedPath = saveTranscription(result.text, result.segments, outputPath, selectedFormat)

  const preview = result.text.slice(0, 400) + (result.text.length > 400 ? "..." : "")
  const wordCount = result.text.split(/\s+/).length

  let statusMsg = `Transcription complete!\n\nWords: ${wordCount} | Characters: ${result.text.length}`
  if (result.segments?.length) statusMsg += ` | Segments: ${result.segments.length}`
  if (result.language) statusMsg += ` | Language: ${result.language}`
  if (savedPath) statusMsg += `\n\nSaved to: ${savedPath}`

  setStatus(statusMsg, colors.textGreen)
  if (progressText) progressText.content = `Preview:\n${preview}`
  if (footer) footer.content = "Press ESC or Q to return to main menu"
}

export function run(rendererInstance: CliRenderer): Promise<void> {
  return new Promise((resolve) => {
    resolveScreen = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    headerBox = new BoxRenderable(renderer, {
      id: "tr-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: colors.accentPurple,
      borderStyle: "single",
      borderColor: "#7c3aed",
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    header = new TextRenderable(renderer, {
      id: "tr-header",
      content: "Media Transcription",
      fg: "#ffffff",
      bg: "transparent",
      flexGrow: 1,
    })
    headerBox.add(header)

    contentBox = new BoxRenderable(renderer, {
      id: "tr-content",
      width: "auto",
      height: "auto",
      flexGrow: 1,
      flexShrink: 1,
      backgroundColor: colors.bgPanel,
      borderStyle: "single",
      borderColor: colors.border,
      border: true,
      flexDirection: "column",
    })

    footerBox = new BoxRenderable(renderer, {
      id: "tr-footer-box",
      width: "auto",
      height: layout.footerHeight,
      backgroundColor: colors.footerBg,
      borderStyle: "single",
      borderColor: colors.footerBorder,
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    footer = new TextRenderable(renderer, {
      id: "tr-footer",
      content: "ENTER: Submit | ESC: Back to menu",
      fg: colors.textDim,
      bg: "transparent",
      flexGrow: 1,
    })
    footerBox.add(footer)

    renderer.root.add(headerBox)
    renderer.root.add(contentBox)
    renderer.root.add(footerBox)

    keyHandler = (key: KeyEvent) => {
      if (key.name === "escape" || (key.name === "q" && currentPhase === "done")) {
        if (resolveScreen) { resolveScreen(); resolveScreen = null }
      }
    }
    renderer.keyInput.on("keypress", keyHandler)

    showSourceInput()
  })
}

export function destroy(rendererInstance: CliRenderer): void {
  if (keyHandler) rendererInstance.keyInput.off("keypress", keyHandler)
  if (sourceInput) sourceInput.destroy()
  if (modelSelect) modelSelect.destroy()
  if (formatSelect) formatSelect.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; sourceInputBox = null; sourceInput = null
  modelSelect = null; modelSelectBox = null
  formatSelect = null; formatSelectBox = null; progressText = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "source_input"
  selectedSource = ""; selectedLanguage = undefined
  selectedModel = "base"; selectedFormat = "txt"; isLocal = false
}
