/**
 * Text-to-Speech Screen - Interactive document-to-speech workflow
 *
 * Steps:
 *   1. Enter document file path (PDF, TXT, MD, etc.)
 *   2. Select TTS voice
 *   3. Select output format (MP3/WAV)
 *   4. Generate speech and display result
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
  textToSpeech,
  listVoices,
  getDefaultVoices,
  getDefaultVoice,
} from "../services/tts"
import {
  isSupportedDocumentFile,
  detectAvailableTtsEngine,
  formatSize,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  TTS_OUTPUT_FORMATS,
} from "../utils"
import type { TTSEngine, TTSOutputFormat, TTSVoice } from "../types"
import { existsSync, statSync } from "fs"
import { basename } from "path"

type Phase = "file_input" | "voice_select" | "format_select" | "generating" | "done"

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let statusText: TextRenderable | null = null
let fileInputBox: BoxRenderable | null = null
let fileInput: InputRenderable | null = null
let voiceSelect: SelectRenderable | null = null
let voiceSelectBox: BoxRenderable | null = null
let formatSelect: SelectRenderable | null = null
let formatSelectBox: BoxRenderable | null = null
let progressText: TextRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: (() => void) | null = null
let currentPhase: Phase = "file_input"

let selectedFile = ""
let selectedVoice = ""
let selectedFormat: TTSOutputFormat = "mp3"
let detectedEngine: TTSEngine | null = null

function setStatus(msg: string, color: string = colors.text) {
  if (!renderer || !contentBox) return

  if (statusText) {
    statusText.content = msg
    statusText.fg = color
  } else {
    statusText = new TextRenderable(renderer, {
      id: "tts-status",
      content: msg,
      fg: color,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(statusText)
  }
}

function showFileInput() {
  if (!renderer || !contentBox) return
  currentPhase = "file_input"

  const exts = SUPPORTED_DOCUMENT_EXTENSIONS.map((e) => e.slice(1).toUpperCase()).join(", ")
  setStatus(
    `Convert a document to natural-sounding speech audio.\n\n` +
    `Supported formats: ${exts}\n\n` +
    `Enter the path to your document:`,
    colors.textCyan,
  )

  fileInputBox = new BoxRenderable(renderer, {
    id: "tts-file-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentYellow,
    title: "Document File Path",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  fileInput = new InputRenderable(renderer, {
    id: "tts-file-input",
    width: "auto",
    placeholder: "/path/to/document.pdf or /path/to/file.txt",
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

  fileInput.on(InputRenderableEvents.ENTER, async () => {
    let path = fileInput?.value?.trim() || ""
    path = path.replace(/^["']|["']$/g, "")

    if (!path) {
      setStatus("Please enter a file path.", colors.textRed)
      return
    }

    if (!existsSync(path)) {
      setStatus(`File not found: ${path}`, colors.textRed)
      return
    }

    if (!isSupportedDocumentFile(path)) {
      const exts = SUPPORTED_DOCUMENT_EXTENSIONS.map((e) => e.slice(1).toUpperCase()).join(", ")
      setStatus(
        `Unsupported file format.\nSupported: ${exts}`,
        colors.textRed,
      )
      return
    }

    selectedFile = path

    // Detect TTS engine
    setStatus("Detecting available TTS engine...", colors.textYellow)
    detectedEngine = await detectAvailableTtsEngine()

    if (!detectedEngine) {
      setStatus(
        "No TTS engine found.\n\n" +
        "Install one of the following:\n" +
        "  pip install edge-tts    (recommended - high quality, many voices)\n" +
        "  pip install gTTS        (Google TTS)\n" +
        "  apt install espeak      (offline, lower quality)",
        colors.textRed,
      )
      if (footer) footer.content = "Press ESC to return to main menu"
      currentPhase = "done"
      return
    }

    await showVoiceSelect()
  })

  fileInputBox.add(fileInput)
  contentBox.add(fileInputBox)
  fileInput.focus()
  fileInputBox.focus()
}

async function showVoiceSelect() {
  if (!renderer || !contentBox || !detectedEngine) return
  currentPhase = "voice_select"

  if (fileInput) { fileInput.destroy(); fileInput = null }
  if (fileInputBox) { contentBox.remove(fileInputBox.id); fileInputBox = null }

  const fileInfo = statSync(selectedFile)
  setStatus(
    `File: ${basename(selectedFile)} (${formatSize(fileInfo.size)})\n` +
    `Engine: ${detectedEngine}\n\n` +
    `Select a voice:`,
    colors.textGreen,
  )

  const voices = await listVoices(detectedEngine)
  const voiceOptions: SelectOption[] = voices.map((v) => ({
    name: v.name,
    description: `${v.language}${v.gender ? ` (${v.gender})` : ""} - ${v.id}`,
    value: v.id,
  }))

  voiceSelectBox = new BoxRenderable(renderer, {
    id: "tts-voice-box",
    width: "auto",
    height: "auto",
    minHeight: 8,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentYellow,
    title: "Voice",
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  voiceSelect = new SelectRenderable(renderer, {
    id: "tts-voice-select",
    width: "auto",
    height: "auto",
    minHeight: 6,
    options: voiceOptions,
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accentYellow,
    selectedTextColor: "#000000",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textOrange,
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 1,
    flexShrink: 1,
  })

  voiceSelect.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    selectedVoice = option.value as string
    showFormatSelect()
  })

  voiceSelectBox.add(voiceSelect)
  contentBox.add(voiceSelectBox)
  voiceSelect.focus()
  voiceSelectBox.focus()
}

function showFormatSelect() {
  if (!renderer || !contentBox) return
  currentPhase = "format_select"

  if (voiceSelect) { voiceSelect.destroy(); voiceSelect = null }
  if (voiceSelectBox) { contentBox.remove(voiceSelectBox.id); voiceSelectBox = null }

  setStatus(
    `Voice: ${selectedVoice}\n\nSelect output audio format:`,
    colors.textGreen,
  )

  const formatOptions: SelectOption[] = [
    { name: "MP3", description: "MPEG Audio Layer 3 - widely compatible, smaller file", value: "mp3" },
    { name: "WAV", description: "Waveform Audio - lossless, larger file", value: "wav" },
  ]

  formatSelectBox = new BoxRenderable(renderer, {
    id: "tts-format-box",
    width: "auto",
    height: "auto",
    minHeight: 4,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentYellow,
    title: "Output Format",
    titleAlignment: "center",
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  formatSelect = new SelectRenderable(renderer, {
    id: "tts-format-select",
    width: "auto",
    height: "auto",
    minHeight: 2,
    options: formatOptions,
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accentYellow,
    selectedTextColor: "#000000",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textOrange,
    showScrollIndicator: false,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 0,
    flexShrink: 0,
  })

  formatSelect.on(SelectRenderableEvents.ITEM_SELECTED, async (_index: number, option: SelectOption) => {
    selectedFormat = option.value as TTSOutputFormat
    await startGeneration()
  })

  formatSelectBox.add(formatSelect)
  contentBox.add(formatSelectBox)
  formatSelect.focus()
  formatSelectBox.focus()
}

async function startGeneration() {
  if (!renderer || !contentBox || !detectedEngine) return
  currentPhase = "generating"

  if (formatSelect) { formatSelect.destroy(); formatSelect = null }
  if (formatSelectBox) { contentBox.remove(formatSelectBox.id); formatSelectBox = null }

  setStatus(
    `Generating speech from: ${basename(selectedFile)}\n` +
    `Engine: ${detectedEngine} | Voice: ${selectedVoice} | Format: ${selectedFormat.toUpperCase()}`,
    colors.textYellow,
  )

  progressText = new TextRenderable(renderer, {
    id: "tts-progress",
    content: "Starting text-to-speech conversion...",
    fg: colors.textCyan,
    bg: "transparent",
    flexGrow: 1,
    flexShrink: 1,
  })
  contentBox.add(progressText)

  const onProgress = (msg: string) => {
    if (progressText) {
      const lines = (String(progressText.content) || "").split("\n")
      if (lines.length > 12) lines.splice(0, lines.length - 12)
      lines.push(msg)
      progressText.content = lines.join("\n")
    }
  }

  const result = await textToSpeech(
    {
      inputFile: selectedFile,
      voice: selectedVoice,
      outputFormat: selectedFormat,
      engine: detectedEngine,
    },
    onProgress,
  )

  currentPhase = "done"

  if (result.success) {
    let statusMsg = `Text-to-speech completed!\n\n` +
      `Engine: ${result.engine}\n` +
      `Voice: ${result.voice}\n` +
      `Text: ${result.textLength.toLocaleString()} characters in ${result.chunkCount} chunk(s)`
    if (result.outputFile) {
      const outSize = statSync(result.outputFile).size
      statusMsg += `\n\nOutput: ${result.outputFile} (${formatSize(outSize)})`
    }
    setStatus(statusMsg, colors.textGreen)
    if (progressText) progressText.content = result.message
  } else {
    setStatus(`Text-to-speech failed: ${result.message}`, colors.textRed)
  }

  if (footer) footer.content = "Press ESC or Q to return to main menu"
}

export function run(rendererInstance: CliRenderer): Promise<void> {
  return new Promise((resolve) => {
    resolveScreen = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    headerBox = new BoxRenderable(renderer, {
      id: "tts-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: colors.accentYellow,
      borderStyle: "single",
      borderColor: "#ca8a04",
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    header = new TextRenderable(renderer, {
      id: "tts-header",
      content: "Text to Speech",
      fg: "#000000",
      bg: "transparent",
      flexGrow: 1,
    })
    headerBox.add(header)

    contentBox = new BoxRenderable(renderer, {
      id: "tts-content",
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
      id: "tts-footer-box",
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
      id: "tts-footer",
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

    showFileInput()
  })
}

export function destroy(rendererInstance: CliRenderer): void {
  if (keyHandler) rendererInstance.keyInput.off("keypress", keyHandler)
  if (fileInput) fileInput.destroy()
  if (voiceSelect) voiceSelect.destroy()
  if (formatSelect) formatSelect.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; fileInputBox = null; fileInput = null
  voiceSelect = null; voiceSelectBox = null
  formatSelect = null; formatSelectBox = null; progressText = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "file_input"
  selectedFile = ""; selectedVoice = ""; selectedFormat = "mp3"
  detectedEngine = null
}
