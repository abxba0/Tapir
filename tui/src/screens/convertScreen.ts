/**
 * Audio Conversion Screen - Interactive audio format conversion
 *
 * Steps:
 *   1. Enter local audio file path
 *   2. Show file info
 *   3. Select output format
 *   4. Convert
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
  getFileInfo,
  isSupportedAudioFile,
  convertAudioFile,
  estimateOutputSize,
} from "../services/converter"
import { getSupportedAudioFormats, formatDuration, formatSize } from "../utils"
import { basename } from "path"

type Phase = "file_input" | "format_select" | "converting" | "done"

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let statusText: TextRenderable | null = null
let fileInputBox: BoxRenderable | null = null
let fileInput: InputRenderable | null = null
let formatSelect: SelectRenderable | null = null
let formatSelectBox: BoxRenderable | null = null
let resultText: TextRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: (() => void) | null = null
let currentPhase: Phase = "file_input"

function setStatus(msg: string, color: string = colors.text) {
  if (!renderer || !contentBox) return

  if (statusText) {
    statusText.content = msg
    statusText.fg = color
  } else {
    statusText = new TextRenderable(renderer, {
      id: "cv-status",
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

  setStatus(
    "Supported input formats: MP3, M4A, WAV, FLAC, OGG, AAC, WMA\n\nEnter the path to your audio file:",
    colors.textCyan,
  )

  fileInputBox = new BoxRenderable(renderer, {
    id: "cv-file-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.borderFocused,
    title: "Audio File Path",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  fileInput = new InputRenderable(renderer, {
    id: "cv-file-input",
    width: "auto",
    placeholder: "/path/to/audio.mp3",
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

    if (!isSupportedAudioFile(path)) {
      setStatus(
        "File not found or unsupported format.\nSupported: MP3, M4A, WAV, FLAC, OGG, AAC, WMA",
        colors.textRed,
      )
      return
    }

    await handleFileSelected(path)
  })

  fileInputBox.add(fileInput)
  contentBox.add(fileInputBox)
  fileInput.focus()
  fileInputBox.focus()
}

async function handleFileSelected(filePath: string) {
  if (!renderer || !contentBox) return

  setStatus("Analyzing audio file...", colors.textYellow)
  if (fileInput) fileInput.blur()

  const info = await getFileInfo(filePath)
  const fileName = basename(filePath)

  let infoLines = `File: ${fileName}\nSize: ${formatSize(info.size)}`
  if (info.duration) infoLines += `\nDuration: ${formatDuration(Math.floor(info.duration))}`
  if (info.bitrate) infoLines += `\nBitrate: ${Math.floor(info.bitrate)} kbps`

  setStatus(`${infoLines}\n\nSelect output format:`, colors.textGreen)
  currentPhase = "format_select"

  const formats = getSupportedAudioFormats()
  const formatOptions: SelectOption[] = Object.entries(formats).map(([key, fmt]) => ({
    name: fmt.name,
    description: `${fmt.description} (${fmt.defaultBitrate}kbps default)`,
    value: key,
  }))

  formatSelectBox = new BoxRenderable(renderer, {
    id: "cv-format-box",
    width: "auto",
    height: "auto",
    minHeight: 8,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentGreen,
    title: "Output Format",
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  formatSelect = new SelectRenderable(renderer, {
    id: "cv-format-select",
    width: "auto",
    height: "auto",
    minHeight: 6,
    options: formatOptions,
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accentGreen,
    selectedTextColor: "#ffffff",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textCyan,
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 1,
    flexShrink: 1,
  })

  formatSelect.on(SelectRenderableEvents.ITEM_SELECTED, async (_index: number, option: SelectOption) => {
    await handleConvert(filePath, option.value as string, info.duration, info.size)
  })

  formatSelectBox.add(formatSelect)
  contentBox.add(formatSelectBox)
  formatSelect.focus()
  formatSelectBox.focus()
}

async function handleConvert(
  filePath: string,
  outputFormat: string,
  duration: number | null,
  inputSize: number,
) {
  if (!renderer || !contentBox) return
  currentPhase = "converting"

  if (formatSelect) { formatSelect.destroy(); formatSelect = null }
  if (formatSelectBox) { contentBox.remove(formatSelectBox.id); formatSelectBox = null }

  const formats = getSupportedAudioFormats()
  const fmt = formats[outputFormat]
  const bitrate = fmt.defaultBitrate

  let summary = `Converting to ${fmt.name} (${bitrate}kbps)...`
  if (duration) {
    const estimated = estimateOutputSize(duration, bitrate)
    summary += `\nEstimated output size: ${formatSize(estimated)}`
  }

  setStatus(summary, colors.textYellow)

  resultText = new TextRenderable(renderer, {
    id: "cv-result",
    content: "Processing...",
    fg: colors.textCyan,
    bg: "transparent",
    flexGrow: 1,
    flexShrink: 1,
  })
  contentBox.add(resultText)

  const result = await convertAudioFile(
    { inputFile: filePath, outputFormat, bitrate },
    (msg: string) => { if (resultText) resultText.content = msg },
  )

  currentPhase = "done"

  if (result) {
    setStatus(`Conversion completed!\nOutput: ${result}`, colors.textGreen)
    if (resultText) resultText.content = "Audio conversion finished successfully."
  } else {
    setStatus("Conversion failed.", colors.textRed)
  }

  if (footer) footer.content = "Press ESC or Q to return to main menu"
}

export function run(rendererInstance: CliRenderer): Promise<void> {
  return new Promise((resolve) => {
    resolveScreen = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    headerBox = new BoxRenderable(renderer, {
      id: "cv-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: colors.accentGreen,
      borderStyle: "single",
      borderColor: colors.borderSuccess,
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    header = new TextRenderable(renderer, {
      id: "cv-header",
      content: "Audio Format Conversion",
      fg: "#ffffff",
      bg: "transparent",
      flexGrow: 1,
    })
    headerBox.add(header)

    contentBox = new BoxRenderable(renderer, {
      id: "cv-content",
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
      id: "cv-footer-box",
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
      id: "cv-footer",
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
  if (formatSelect) formatSelect.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; fileInputBox = null; fileInput = null
  formatSelect = null; formatSelectBox = null; resultText = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "file_input"
}
