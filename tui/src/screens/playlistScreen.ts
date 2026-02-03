/**
 * Playlist Browser Screen - Fetch a playlist, browse videos, pick which to download
 *
 * Steps:
 *   1. Enter playlist URL
 *   2. Fetch playlist info
 *   3. Show all videos with toggle selection
 *   4. Choose format
 *   5. Download selected videos with progress
 *   6. Summary
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
import { getVideoInfo, downloadVideoWithProgress } from "../services/downloader"
import { embedMetadata, extractMetadata, findLatestFile } from "../services/metadata"
import { runHook } from "../services/plugins"
import { loadSettings } from "../services/settings"
import { isValidUrl, formatDuration, formatCount } from "../utils"
import type { VideoInfo, DownloadProgress } from "../types"

type Phase = "url_input" | "fetching" | "selection" | "format_select" | "downloading" | "done"

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let statusText: TextRenderable | null = null
let urlInput: InputRenderable | null = null
let urlInputBox: BoxRenderable | null = null
let videoSelect: SelectRenderable | null = null
let videoSelectBox: BoxRenderable | null = null
let formatSelect: SelectRenderable | null = null
let formatSelectBox: BoxRenderable | null = null
let progressText: TextRenderable | null = null
let progressBarText: TextRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: (() => void) | null = null
let currentPhase: Phase = "url_input"
let playlistUrl = ""
let playlistInfo: VideoInfo | null = null
let playlistEntries: VideoInfo[] = []
let selected: Set<number> = new Set()

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
      id: "pl-status",
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

function clearDynamicContent() {
  if (!contentBox) return

  if (urlInput) { urlInput.destroy(); urlInput = null }
  if (urlInputBox) { contentBox.remove(urlInputBox.id); urlInputBox = null }
  if (videoSelect) { videoSelect.destroy(); videoSelect = null }
  if (videoSelectBox) { contentBox.remove(videoSelectBox.id); videoSelectBox = null }
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
    "Playlist Browser - Enter a playlist or channel URL to browse videos.\n\nSupports YouTube playlists, channels, and more.",
    colors.textCyan,
  )

  urlInputBox = new BoxRenderable(renderer, {
    id: "pl-url-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.borderFocused,
    title: "Playlist URL",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  urlInput = new InputRenderable(renderer, {
    id: "pl-url-input",
    width: "auto",
    placeholder: "https://youtube.com/playlist?list=... or channel URL",
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

  urlInput.on(InputRenderableEvents.ENTER, async () => {
    const url = urlInput?.value?.trim()
    if (url && isValidUrl(url)) {
      await fetchPlaylist(url)
    } else {
      setStatus("Invalid URL. Please enter a valid playlist URL.", colors.textRed)
    }
  })

  urlInputBox.add(urlInput)
  contentBox.add(urlInputBox)
  urlInput.focus()
  urlInputBox.focus()
}

// ============================================================================
// Phase: Fetch Playlist
// ============================================================================

async function fetchPlaylist(url: string) {
  if (!renderer || !contentBox) return
  currentPhase = "fetching"
  playlistUrl = url

  if (urlInput) urlInput.blur()
  setStatus(`Fetching playlist information...\n${url}`, colors.textYellow)

  const info = await getVideoInfo(url)

  // Clean up URL input
  if (urlInput) { urlInput.destroy(); urlInput = null }
  if (urlInputBox) { contentBox.remove(urlInputBox.id); urlInputBox = null }

  if (!info) {
    setStatus("Failed to retrieve playlist information. Please check the URL.", colors.textRed)
    showUrlInput()
    return
  }

  playlistInfo = info

  // Extract entries
  if (info._type === "playlist" || info._type === "multi_video") {
    playlistEntries = info.entries || []
  } else {
    // Single video - still show it
    playlistEntries = [info]
  }

  if (playlistEntries.length === 0) {
    setStatus("No videos found in this playlist.", colors.textRed)
    showUrlInput()
    return
  }

  // Select all by default
  selected = new Set(playlistEntries.map((_, i) => i))

  showVideoSelection()
}

// ============================================================================
// Phase: Video Selection (toggle multi-select)
// ============================================================================

function showVideoSelection() {
  if (!renderer || !contentBox) return
  currentPhase = "selection"

  const title = playlistInfo?.title || "Playlist"
  const channel = playlistInfo?.channel || playlistInfo?.uploader || "Unknown"
  const total = playlistEntries.length

  setStatus(
    `${title}\nChannel: ${channel} | ${total} video${total !== 1 ? "s" : ""}\n\nToggle selection with ENTER. Choose an action to proceed.`,
    colors.textGreen,
  )

  // Remove old select
  if (videoSelect) { videoSelect.destroy(); videoSelect = null }
  if (videoSelectBox) { contentBox.remove(videoSelectBox.id); videoSelectBox = null }

  // Build options
  const options: SelectOption[] = []

  // Action items at top
  options.push({
    name: `>>> Download Selected (${selected.size}/${total}) <<<`,
    description: "Start downloading the selected videos",
    value: "__download__",
  })
  options.push({
    name: selected.size === total ? "Deselect All" : "Select All",
    description: selected.size === total ? "Remove all videos from selection" : "Add all videos to selection",
    value: "__toggle_all__",
  })

  // Video entries
  for (let i = 0; i < playlistEntries.length; i++) {
    const entry = playlistEntries[i]
    const isSelected = selected.has(i)
    const mark = isSelected ? "[x]" : "[ ]"
    const dur = formatDuration(entry.duration)
    const views = formatCount(entry.view_count)
    const idx = String(i + 1).padStart(String(total).length, " ")
    const entryTitle = entry.title || "Unknown"
    const shortTitle = entryTitle.length > 60 ? entryTitle.slice(0, 57) + "..." : entryTitle

    options.push({
      name: `${mark} ${idx}. ${shortTitle}`,
      description: `${entry.channel || entry.uploader || channel} | ${dur} | ${views} views`,
      value: `__video_${i}__`,
    })
  }

  videoSelectBox = new BoxRenderable(renderer, {
    id: "pl-video-box",
    width: "auto",
    height: "auto",
    minHeight: 10,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accent,
    title: `Playlist Videos (${selected.size} selected)`,
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  videoSelect = new SelectRenderable(renderer, {
    id: "pl-video-select",
    width: "auto",
    height: "auto",
    minHeight: 8,
    options,
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accent,
    selectedTextColor: "#ffffff",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textCyan,
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 1,
    flexShrink: 1,
  })

  videoSelect.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    const val = option.value as string

    if (val === "__download__") {
      if (selected.size === 0) {
        setStatus("No videos selected. Toggle selection with ENTER.", colors.textRed)
        return
      }
      clearDynamicContent()
      showFormatSelect()
      return
    }

    if (val === "__toggle_all__") {
      if (selected.size === playlistEntries.length) {
        selected.clear()
      } else {
        selected = new Set(playlistEntries.map((_, i) => i))
      }
      // Rebuild the list
      showVideoSelection()
      return
    }

    // Toggle individual video
    const match = val.match(/__video_(\d+)__/)
    if (match) {
      const idx = parseInt(match[1])
      if (selected.has(idx)) {
        selected.delete(idx)
      } else {
        selected.add(idx)
      }
      // Rebuild the list
      showVideoSelection()
    }
  })

  videoSelectBox.add(videoSelect)
  contentBox.add(videoSelectBox)
  videoSelect.focus()
  videoSelectBox.focus()

  if (footer) footer.content = "ENTER: Toggle/Action | ESC: Back to menu"
}

// ============================================================================
// Phase: Format Selection
// ============================================================================

function showFormatSelect() {
  if (!renderer || !contentBox) return
  currentPhase = "format_select"

  setStatus(
    `${selected.size} video${selected.size !== 1 ? "s" : ""} selected. Choose download format:`,
    colors.textYellow,
  )

  const formatOptions: SelectOption[] = [
    { name: "Best Quality", description: "Best combined video+audio", value: "best" },
    { name: "MP4", description: "Download as MP4 video", value: "mp4" },
    { name: "MP3", description: "Extract audio as MP3 (requires FFmpeg)", value: "mp3" },
    { name: "High Quality", description: "Best video + best audio merged (requires FFmpeg)", value: "high" },
    { name: "Best Video Only", description: "Highest resolution video stream", value: "bestvideo" },
    { name: "Best Audio Only", description: "Highest quality audio stream", value: "bestaudio" },
  ]

  formatSelectBox = new BoxRenderable(renderer, {
    id: "pl-format-box",
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
    id: "pl-format-select",
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
    clearDynamicContent()
    await startPlaylistDownload(option.value as string)
  })

  formatSelectBox.add(formatSelect)
  contentBox.add(formatSelectBox)
  formatSelect.focus()
  formatSelectBox.focus()
}

// ============================================================================
// Phase: Download Selected
// ============================================================================

async function startPlaylistDownload(format: string) {
  if (!renderer || !contentBox) return
  currentPhase = "downloading"

  const settings = loadSettings()
  const indices = Array.from(selected).sort((a, b) => a - b)
  const total = indices.length

  // Overall progress bar
  progressBarText = new TextRenderable(renderer, {
    id: "pl-progress-bar",
    content: renderProgressBar(0),
    fg: colors.textCyan,
    bg: "transparent",
    flexGrow: 0,
    flexShrink: 0,
  })
  contentBox.add(progressBarText)

  progressText = new TextRenderable(renderer, {
    id: "pl-progress",
    content: `Starting download (0/${total})...`,
    fg: colors.textDim,
    bg: "transparent",
    flexGrow: 0,
    flexShrink: 0,
  })
  contentBox.add(progressText)

  let completed = 0
  let succeeded = 0

  for (const idx of indices) {
    const entry = playlistEntries[idx]
    const title = entry.title || `Video ${idx + 1}`
    const shortTitle = title.length > 50 ? title.slice(0, 47) + "..." : title

    const overallPercent = (completed / total) * 100
    if (progressBarText) progressBarText.content = renderProgressBar(overallPercent)
    if (progressText) progressText.content = `Downloading ${completed + 1}/${total}: ${shortTitle}`

    setStatus(
      `Playlist Progress: ${completed}/${total} completed | ${succeeded} succeeded\nCurrent: ${shortTitle}`,
      colors.textYellow,
    )

    // Build the URL for this entry
    const entryUrl = (entry as any).url || (entry as any).webpage_url
      || `https://www.youtube.com/watch?v=${(entry as any).id}`

    const result = await downloadVideoWithProgress(
      {
        url: entryUrl,
        format,
        outputDir: settings.outputDir,
        downloadSubs: settings.downloadSubs,
        subLangs: settings.downloadSubs ? settings.subtitleLang : undefined,
      },
      (progress: DownloadProgress) => {
        if (progressText) {
          const pct = progress.percent >= 0 ? ` (${progress.percent.toFixed(1)}%)` : ""
          progressText.content = `Downloading ${completed + 1}/${total}: ${shortTitle}${pct}`
        }
      },
    )

    completed++
    if (result.success) {
      succeeded++

      // Metadata embedding
      if (result.outputDir) {
        const latestFile = findLatestFile(result.outputDir)
        try {
          const meta = extractMetadata(entry, entryUrl)
          if (latestFile) {
            await embedMetadata(latestFile, meta, { embedThumbnail: true })
          }
        } catch { /* non-critical */ }

        try {
          await runHook("post-download", {
            file: latestFile || undefined,
            title: entry.title,
            url: entryUrl,
            format,
            outputDir: result.outputDir,
            success: true,
          })
        } catch { /* non-critical */ }
      }
    }
  }

  // Done
  currentPhase = "done"

  if (progressBarText) progressBarText.content = renderProgressBar(100)
  if (progressText) progressText.content = `Complete: ${succeeded}/${total} downloaded successfully`

  const playlistTitle = playlistInfo?.title || "Playlist"
  setStatus(
    `Playlist download complete!\n\n${playlistTitle}\nSucceeded: ${succeeded}/${total}\nFailed: ${total - succeeded}/${total}\nOutput: ${settings.outputDir}`,
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
    playlistUrl = ""
    playlistInfo = null
    playlistEntries = []
    selected = new Set()

    headerBox = new BoxRenderable(renderer, {
      id: "pl-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: "#0891b2",
      borderStyle: "single",
      borderColor: "#0e7490",
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    header = new TextRenderable(renderer, {
      id: "pl-header",
      content: "Playlist Browser",
      fg: "#ffffff",
      bg: "transparent",
      flexGrow: 1,
    })
    headerBox.add(header)

    contentBox = new BoxRenderable(renderer, {
      id: "pl-content",
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
      id: "pl-footer-box",
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
      id: "pl-footer",
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

    showUrlInput()
  })
}

export function destroy(rendererInstance: CliRenderer): void {
  if (keyHandler) rendererInstance.keyInput.off("keypress", keyHandler)
  if (urlInput) urlInput.destroy()
  if (videoSelect) videoSelect.destroy()
  if (formatSelect) formatSelect.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; urlInput = null; urlInputBox = null
  videoSelect = null; videoSelectBox = null; formatSelect = null; formatSelectBox = null
  progressText = null; progressBarText = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "url_input"; playlistUrl = ""; playlistInfo = null
  playlistEntries = []; selected = new Set()
}
