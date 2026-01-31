/**
 * Download Screen - Interactive video download workflow
 *
 * Steps:
 *   1. Enter URL
 *   2. Fetch video info
 *   3. Select format
 *   4. Download with progress
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
import { getVideoInfo, downloadVideoWithProgress, listFormats } from "../services/downloader"
import {
  detectSite,
  getSupportedSites,
  formatDuration,
  formatSize,
  formatCount,
  isValidUrl,
} from "../utils"
import type { VideoInfo } from "../types"

type ScreenPhase = "url_input" | "fetching" | "format_select" | "downloading" | "done"

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let statusText: TextRenderable | null = null
let urlInputBox: BoxRenderable | null = null
let urlInput: InputRenderable | null = null
let formatSelect: SelectRenderable | null = null
let formatSelectBox: BoxRenderable | null = null
let progressText: TextRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: (() => void) | null = null
let currentPhase: ScreenPhase = "url_input"

function setStatus(message: string, color: string = colors.text) {
  if (!renderer || !contentBox) return

  if (statusText) {
    statusText.content = message
    statusText.fg = color
  } else {
    statusText = new TextRenderable(renderer, {
      id: "dl-status",
      content: message,
      fg: color,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(statusText)
  }
}

function showUrlInput() {
  if (!renderer || !contentBox) return
  currentPhase = "url_input"

  setStatus(
    "Supported: YouTube, Instagram, TikTok, Vimeo, SoundCloud, and 1800+ sites\n\nEnter the video URL below:",
    colors.textCyan,
  )

  urlInputBox = new BoxRenderable(renderer, {
    id: "dl-url-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.borderFocused,
    title: "Video URL",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  urlInput = new InputRenderable(renderer, {
    id: "dl-url-input",
    width: "auto",
    placeholder: "https://youtube.com/watch?v=... or any supported URL",
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
      await handleUrlSubmit(url)
    } else {
      setStatus("Invalid URL. Please enter a valid URL starting with http:// or https://", colors.textRed)
    }
  })

  urlInputBox.add(urlInput)
  contentBox.add(urlInputBox)
  urlInput.focus()
  urlInputBox.focus()
}

async function handleUrlSubmit(url: string) {
  if (!renderer || !contentBox) return
  currentPhase = "fetching"

  const site = detectSite(url)
  const siteInfo = getSupportedSites()[site] || { name: "Unknown" }

  setStatus(`Detected: ${siteInfo.name}\nFetching video information...`, colors.textYellow)

  if (urlInput) urlInput.blur()

  const info = await getVideoInfo(url)

  if (!info) {
    setStatus("Failed to retrieve video information. Please check the URL.", colors.textRed)
    currentPhase = "url_input"
    if (urlInput) urlInput.focus()
    return
  }

  const title = info.title || "Unknown"
  const channel = info.channel || info.uploader || "Unknown"
  const duration = formatDuration(info.duration)
  const views = formatCount(info.view_count)
  const isPlaylist = info._type === "playlist" || info._type === "multi_video"

  if (isPlaylist) {
    const count = info.entries?.length || 0
    setStatus(
      `Playlist: ${title}\nChannel: ${channel}\nVideos: ${count}\n\nSelect download format:`,
      colors.textGreen,
    )
  } else {
    setStatus(
      `Title: ${title}\nChannel: ${channel}\nDuration: ${duration} | Views: ${views}\n\nSelect download format:`,
      colors.textGreen,
    )
  }

  showFormatSelect(url, info)
}

function showFormatSelect(url: string, info: VideoInfo) {
  if (!renderer || !contentBox) return
  currentPhase = "format_select"

  const formatOptions: SelectOption[] = [
    { name: "Best Quality", description: "Best combined video+audio", value: "best" },
    { name: "MP4", description: "Download as MP4 video", value: "mp4" },
    { name: "MP3", description: "Extract audio as MP3 (requires FFmpeg)", value: "mp3" },
    { name: "High Quality", description: "Best video + best audio merged (requires FFmpeg)", value: "high" },
    { name: "Best Video Only", description: "Highest resolution video stream", value: "bestvideo" },
    { name: "Best Audio Only", description: "Highest quality audio stream", value: "bestaudio" },
  ]

  if (info.formats) {
    const combined = info.formats
      .filter((f) => f.vcodec !== "none" && f.acodec !== "none")
      .sort((a, b) => (b.height || 0) - (a.height || 0))
      .slice(0, 8)

    for (const f of combined) {
      const res = f.height ? `${f.height}p` : "N/A"
      const size = formatSize(f.filesize || f.filesize_approx)
      formatOptions.push({
        name: `${f.format_id} (${f.ext} ${res})`,
        description: `${size} - ${f.vcodec || "?"}/${f.acodec || "?"}`,
        value: f.format_id,
      })
    }
  }

  formatSelectBox = new BoxRenderable(renderer, {
    id: "dl-format-box",
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
    id: "dl-format-select",
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
    await handleDownload(url, option.value as string, info)
  })

  formatSelectBox.add(formatSelect)
  contentBox.add(formatSelectBox)
  formatSelect.focus()
  formatSelectBox.focus()
}

async function handleDownload(url: string, format: string, info: VideoInfo) {
  if (!renderer || !contentBox) return
  currentPhase = "downloading"

  if (formatSelect) { formatSelect.destroy(); formatSelect = null }
  if (formatSelectBox) { contentBox.remove(formatSelectBox.id); formatSelectBox = null }

  setStatus(`Downloading: ${info.title || url}\nFormat: ${format}\n`, colors.textYellow)

  progressText = new TextRenderable(renderer, {
    id: "dl-progress",
    content: "Starting download...",
    fg: colors.textCyan,
    bg: "transparent",
    flexGrow: 1,
    flexShrink: 1,
  })
  contentBox.add(progressText)

  const isPlaylist = info._type === "playlist" || info._type === "multi_video"

  const result = await downloadVideoWithProgress(
    { url, format, outputDir: "youtube_downloads", isPlaylist },
    (line: string) => {
      if (progressText) {
        const lines = (String(progressText.content) || "").split("\n")
        if (lines.length > 12) lines.splice(0, lines.length - 12)
        lines.push(line)
        progressText.content = lines.join("\n")
      }
    },
  )

  currentPhase = "done"

  if (result.success) {
    setStatus(
      `Download completed!\n\nTitle: ${info.title}\nSaved to: ${result.outputDir || "youtube_downloads"}`,
      colors.textGreen,
    )
    if (progressText) progressText.content = "Download finished successfully."
  } else {
    setStatus(`Download failed: ${result.message}`, colors.textRed)
  }

  if (footer) footer.content = "Press ESC or Q to return to main menu"
}

export function run(rendererInstance: CliRenderer): Promise<void> {
  return new Promise((resolve) => {
    resolveScreen = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    headerBox = new BoxRenderable(renderer, {
      id: "dl-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: colors.accent,
      borderStyle: "single",
      borderColor: colors.borderFocused,
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    header = new TextRenderable(renderer, {
      id: "dl-header",
      content: "Video Download",
      fg: "#ffffff",
      bg: "transparent",
      flexGrow: 1,
    })
    headerBox.add(header)

    contentBox = new BoxRenderable(renderer, {
      id: "dl-content",
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
      id: "dl-footer-box",
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
      id: "dl-footer",
      content: "ENTER: Submit | ESC: Back to menu | TAB: Navigate",
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
  if (formatSelect) formatSelect.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; urlInputBox = null; urlInput = null
  formatSelect = null; formatSelectBox = null; progressText = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "url_input"
}
