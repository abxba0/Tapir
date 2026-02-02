/**
 * Batch Download Screen - Queue multiple URLs and download them sequentially
 *
 * Steps:
 *   1. Add URLs one at a time (press ENTER to add, builds a visible queue)
 *   2. Select "Start Download" to begin
 *   3. Choose format (applied to all)
 *   4. Downloads run sequentially with overall + per-item progress
 *   5. Summary of all results
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
import { downloadVideoWithProgress } from "../services/downloader"
import { embedMetadata, extractMetadata, findLatestFile } from "../services/metadata"
import { runHook } from "../services/plugins"
import { loadSettings } from "../services/settings"
import { isValidUrl, formatDuration } from "../utils"
import type { DownloadProgress, DownloadResult, VideoInfo } from "../types"

type Phase = "url_input" | "format_select" | "downloading" | "done"

interface QueueItem {
  url: string
  status: "pending" | "downloading" | "success" | "failed"
  message?: string
}

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let statusText: TextRenderable | null = null
let urlInput: InputRenderable | null = null
let urlInputBox: BoxRenderable | null = null
let queueText: TextRenderable | null = null
let actionSelect: SelectRenderable | null = null
let actionSelectBox: BoxRenderable | null = null
let formatSelect: SelectRenderable | null = null
let formatSelectBox: BoxRenderable | null = null
let progressText: TextRenderable | null = null
let progressBarText: TextRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: (() => void) | null = null
let currentPhase: Phase = "url_input"
let queue: QueueItem[] = []

// ============================================================================
// Helpers
// ============================================================================

function setStatus(message: string, color: string = colors.text) {
  if (!renderer || !contentBox) return

  if (statusText) {
    statusText.content = message
    statusText.fg = color
  } else {
    statusText = new TextRenderable(renderer, {
      id: "ba-status",
      content: message,
      fg: color,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(statusText)
  }
}

function renderProgressBar(percent: number, width: number = 40): string {
  if (percent < 0) return "[" + " ".repeat(width) + "]   0%"
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round((clamped / 100) * width)
  const empty = width - filled
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${clamped.toFixed(1)}%`
}

function updateQueueDisplay() {
  if (!renderer || !contentBox) return

  const lines = queue.map((item, i) => {
    const idx = String(i + 1).padStart(2, " ")
    let icon = " "
    let shortUrl = item.url
    if (shortUrl.length > 60) shortUrl = shortUrl.slice(0, 57) + "..."

    switch (item.status) {
      case "pending": icon = " "; break
      case "downloading": icon = ">"; break
      case "success": icon = "+"; break
      case "failed": icon = "x"; break
    }

    const msg = item.message ? ` - ${item.message}` : ""
    return `  ${idx}. [${icon}] ${shortUrl}${msg}`
  })

  const content = lines.length > 0
    ? `Queue (${queue.length} URL${queue.length !== 1 ? "s" : ""}):\n${lines.join("\n")}`
    : "Queue is empty. Add URLs below."

  if (queueText) {
    queueText.content = content
  } else {
    queueText = new TextRenderable(renderer, {
      id: "ba-queue",
      content,
      fg: colors.text,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(queueText)
  }
}

function clearDynamicContent() {
  if (!contentBox) return

  if (urlInput) { urlInput.destroy(); urlInput = null }
  if (urlInputBox) { contentBox.remove(urlInputBox.id); urlInputBox = null }
  if (actionSelect) { actionSelect.destroy(); actionSelect = null }
  if (actionSelectBox) { contentBox.remove(actionSelectBox.id); actionSelectBox = null }
  if (formatSelect) { formatSelect.destroy(); formatSelect = null }
  if (formatSelectBox) { contentBox.remove(formatSelectBox.id); formatSelectBox = null }
  if (progressText) { contentBox.remove(progressText.id); progressText = null }
  if (progressBarText) { contentBox.remove(progressBarText.id); progressBarText = null }
}

// ============================================================================
// Phase: URL Input
// ============================================================================

function showUrlInput() {
  if (!renderer || !contentBox) return
  currentPhase = "url_input"

  setStatus(
    "Batch Download - Add multiple URLs to the queue.\nPaste URLs one at a time and press ENTER to add each.",
    colors.textCyan,
  )

  updateQueueDisplay()

  // URL input
  urlInputBox = new BoxRenderable(renderer, {
    id: "ba-url-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.borderFocused,
    title: "Add URL",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  urlInput = new InputRenderable(renderer, {
    id: "ba-url-input",
    width: "auto",
    placeholder: "Paste URL and press ENTER (or select Start Download below)",
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

  urlInput.on(InputRenderableEvents.ENTER, () => {
    const url = urlInput?.value?.trim()
    if (url && isValidUrl(url)) {
      // Check for duplicates
      if (queue.some((q) => q.url === url)) {
        setStatus("URL already in queue.", colors.textYellow)
      } else {
        queue.push({ url, status: "pending" })
        updateQueueDisplay()
        setStatus(`Added (${queue.length} in queue). Add more or select Start Download.`, colors.textGreen)
      }
      // Clear input for next URL
      if (urlInput) {
        urlInput.value = ""
      }
    } else if (url) {
      setStatus("Invalid URL. Must start with http:// or https://", colors.textRed)
    }
  })

  urlInputBox.add(urlInput)
  contentBox.add(urlInputBox)

  // Action buttons
  showActionMenu()

  urlInput.focus()
  urlInputBox.focus()
}

function showActionMenu() {
  if (!renderer || !contentBox) return

  // Remove old action select
  if (actionSelect) { actionSelect.destroy(); actionSelect = null }
  if (actionSelectBox) { contentBox.remove(actionSelectBox.id); actionSelectBox = null }

  const options: SelectOption[] = []

  if (queue.length > 0) {
    options.push({
      name: `Start Download (${queue.length} URL${queue.length !== 1 ? "s" : ""})`,
      description: "Begin downloading all queued URLs",
      value: "start",
    })
    options.push({
      name: "Clear Queue",
      description: "Remove all URLs from the queue",
      value: "clear",
    })
  }
  options.push({
    name: "Back to Main Menu",
    description: "Return without downloading",
    value: "back",
  })

  actionSelectBox = new BoxRenderable(renderer, {
    id: "ba-action-box",
    width: "auto",
    height: "auto",
    minHeight: 4,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentGreen,
    title: "Actions",
    titleAlignment: "center",
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  actionSelect = new SelectRenderable(renderer, {
    id: "ba-action-select",
    width: "auto",
    height: "auto",
    minHeight: 3,
    options,
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
    flexGrow: 0,
    flexShrink: 0,
  })

  actionSelect.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    const val = option.value as string
    if (val === "start" && queue.length > 0) {
      clearDynamicContent()
      showFormatSelect()
    } else if (val === "clear") {
      queue = []
      clearDynamicContent()
      if (queueText && contentBox) { contentBox.remove(queueText.id); queueText = null }
      showUrlInput()
    } else if (val === "back") {
      if (resolveScreen) { resolveScreen(); resolveScreen = null }
    }
  })

  actionSelectBox.add(actionSelect)
  contentBox.add(actionSelectBox)
}

// ============================================================================
// Phase: Format Selection
// ============================================================================

function showFormatSelect() {
  if (!renderer || !contentBox) return
  currentPhase = "format_select"

  setStatus(
    `Select download format for all ${queue.length} URLs:`,
    colors.textYellow,
  )

  const settings = loadSettings()
  const formatOptions: SelectOption[] = [
    { name: "Best Quality", description: "Best combined video+audio", value: "best" },
    { name: "MP4", description: "Download as MP4 video", value: "mp4" },
    { name: "MP3", description: "Extract audio as MP3 (requires FFmpeg)", value: "mp3" },
    { name: "High Quality", description: "Best video + best audio merged (requires FFmpeg)", value: "high" },
    { name: "Best Video Only", description: "Highest resolution video stream", value: "bestvideo" },
    { name: "Best Audio Only", description: "Highest quality audio stream", value: "bestaudio" },
  ]

  formatSelectBox = new BoxRenderable(renderer, {
    id: "ba-format-box",
    width: "auto",
    height: "auto",
    minHeight: 8,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentGreen,
    title: "Format Selection",
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  formatSelect = new SelectRenderable(renderer, {
    id: "ba-format-select",
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
    const format = option.value as string
    clearDynamicContent()
    await startBatchDownload(format)
  })

  formatSelectBox.add(formatSelect)
  contentBox.add(formatSelectBox)
  formatSelect.focus()
  formatSelectBox.focus()
}

// ============================================================================
// Phase: Batch Download
// ============================================================================

async function startBatchDownload(format: string) {
  if (!renderer || !contentBox) return
  currentPhase = "downloading"

  const settings = loadSettings()
  const total = queue.length

  // Overall progress bar
  progressBarText = new TextRenderable(renderer, {
    id: "ba-progress-bar",
    content: renderProgressBar(0),
    fg: colors.textCyan,
    bg: "transparent",
    flexGrow: 0,
    flexShrink: 0,
  })
  contentBox.add(progressBarText)

  progressText = new TextRenderable(renderer, {
    id: "ba-progress",
    content: `Starting batch download (0/${total})...`,
    fg: colors.textDim,
    bg: "transparent",
    flexGrow: 0,
    flexShrink: 0,
  })
  contentBox.add(progressText)

  let completed = 0
  let succeeded = 0

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]
    item.status = "downloading"
    updateQueueDisplay()

    const overallPercent = (completed / total) * 100
    if (progressBarText) progressBarText.content = renderProgressBar(overallPercent)

    let shortUrl = item.url
    if (shortUrl.length > 50) shortUrl = shortUrl.slice(0, 47) + "..."
    if (progressText) progressText.content = `Downloading ${i + 1}/${total}: ${shortUrl}`

    setStatus(
      `Batch Progress: ${completed}/${total} completed | ${succeeded} succeeded\nCurrent: ${shortUrl}`,
      colors.textYellow,
    )

    const result = await downloadVideoWithProgress(
      {
        url: item.url,
        format,
        outputDir: settings.outputDir,
        downloadSubs: settings.downloadSubs,
        subLangs: settings.downloadSubs ? settings.subtitleLang : undefined,
      },
      (progress: DownloadProgress) => {
        // Update current item progress in the detail line
        if (progressText) {
          const itemProgress = progress.percent >= 0 ? ` (${progress.percent.toFixed(1)}%)` : ""
          progressText.content = `Downloading ${i + 1}/${total}: ${shortUrl}${itemProgress}`
        }
      },
    )

    completed++
    if (result.success) {
      item.status = "success"
      item.message = "Downloaded"
      succeeded++

      // Try metadata embedding
      if (result.outputDir) {
        try {
          const latestFile = findLatestFile(result.outputDir)
          if (latestFile) {
            await embedMetadata(latestFile, { title: item.url }, { embedThumbnail: false })
          }
        } catch { /* non-critical */ }

        try {
          await runHook("post-download", {
            file: findLatestFile(result.outputDir) || undefined,
            url: item.url,
            format,
            outputDir: result.outputDir,
            success: true,
          })
        } catch { /* non-critical */ }
      }
    } else {
      item.status = "failed"
      item.message = result.message.slice(0, 60)
    }

    updateQueueDisplay()
    const newOverallPercent = (completed / total) * 100
    if (progressBarText) progressBarText.content = renderProgressBar(newOverallPercent)
  }

  // Done
  currentPhase = "done"

  if (progressBarText) progressBarText.content = renderProgressBar(100)
  if (progressText) progressText.content = `Batch complete: ${succeeded}/${total} succeeded, ${total - succeeded} failed`

  setStatus(
    `Batch download complete!\n\nSucceeded: ${succeeded}/${total}\nFailed: ${total - succeeded}/${total}\nOutput: ${settings.outputDir}`,
    succeeded === total ? colors.textGreen : colors.textYellow,
  )

  if (footer) footer.content = "Press ESC or Q to return to main menu"
}

// ============================================================================
// Screen lifecycle
// ============================================================================

export function run(rendererInstance: CliRenderer): Promise<void> {
  return new Promise((resolve) => {
    resolveScreen = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    // Reset state
    queue = []

    headerBox = new BoxRenderable(renderer, {
      id: "ba-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: "#7c3aed",
      borderStyle: "single",
      borderColor: "#6d28d9",
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    header = new TextRenderable(renderer, {
      id: "ba-header",
      content: "Batch Download",
      fg: "#ffffff",
      bg: "transparent",
      flexGrow: 1,
    })
    headerBox.add(header)

    contentBox = new BoxRenderable(renderer, {
      id: "ba-content",
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
      id: "ba-footer-box",
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
      id: "ba-footer",
      content: "ENTER: Add URL | TAB: Switch focus | ESC: Back",
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

    showUrlInput()
  })
}

export function destroy(rendererInstance: CliRenderer): void {
  if (keyHandler) rendererInstance.keyInput.off("keypress", keyHandler)
  if (urlInput) urlInput.destroy()
  if (actionSelect) actionSelect.destroy()
  if (formatSelect) formatSelect.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; urlInput = null; urlInputBox = null; queueText = null
  actionSelect = null; actionSelectBox = null; formatSelect = null; formatSelectBox = null
  progressText = null; progressBarText = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "url_input"; queue = []
}
