/**
 * Download Screen - Interactive video download workflow
 *
 * Steps:
 *   1. Enter URL
 *   2. Fetch video info
 *   3. Toggle subtitle download & choose language
 *   4. Select format
 *   5. Download with real-time progress bar
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
import { embedMetadata, extractMetadata, findLatestFile } from "../services/metadata"
import { runHook } from "../services/plugins"
import {
  detectSite,
  getSupportedSites,
  formatDuration,
  formatSize,
  formatCount,
  isValidUrl,
} from "../utils"
import type { VideoInfo, DownloadProgress } from "../types"

type ScreenPhase =
  | "url_input"
  | "fetching"
  | "subtitle_options"
  | "format_select"
  | "downloading"
  | "done"

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
let subtitleSelect: SelectRenderable | null = null
let subtitleSelectBox: BoxRenderable | null = null
let subLangInputBox: BoxRenderable | null = null
let subLangInput: InputRenderable | null = null
let progressText: TextRenderable | null = null
let progressBarText: TextRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: (() => void) | null = null
let currentPhase: ScreenPhase = "url_input"

// State for subtitle options
let wantSubs = false
let subLangs = "en.*,en"
let currentUrl = ""
let currentInfo: VideoInfo | null = null

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

function renderProgressBar(percent: number, width: number = 40): string {
  if (percent < 0) return "[" + " ".repeat(width) + "]   0%"
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round((clamped / 100) * width)
  const empty = width - filled
  const bar = "#".repeat(filled) + "-".repeat(empty)
  return `[${bar}] ${clamped.toFixed(1)}%`
}

function clearDynamicContent() {
  if (!contentBox) return

  if (urlInput) { urlInput.destroy(); urlInput = null }
  if (urlInputBox) { contentBox.remove(urlInputBox.id); urlInputBox = null }
  if (formatSelect) { formatSelect.destroy(); formatSelect = null }
  if (formatSelectBox) { contentBox.remove(formatSelectBox.id); formatSelectBox = null }
  if (subtitleSelect) { subtitleSelect.destroy(); subtitleSelect = null }
  if (subtitleSelectBox) { contentBox.remove(subtitleSelectBox.id); subtitleSelectBox = null }
  if (subLangInput) { subLangInput.destroy(); subLangInput = null }
  if (subLangInputBox) { contentBox.remove(subLangInputBox.id); subLangInputBox = null }
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

// ============================================================================
// Phase: Fetch Info
// ============================================================================

async function handleUrlSubmit(url: string) {
  if (!renderer || !contentBox) return
  currentPhase = "fetching"
  currentUrl = url

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

  currentInfo = info
  const title = info.title || "Unknown"
  const channel = info.channel || info.uploader || "Unknown"
  const duration = formatDuration(info.duration)
  const views = formatCount(info.view_count)
  const isPlaylist = info._type === "playlist" || info._type === "multi_video"

  // Check if subtitles are available
  const hasSubs = info.subtitles && Object.keys(info.subtitles).length > 0
  const hasAutoCaptions = info.automatic_captions && Object.keys(info.automatic_captions).length > 0
  const subInfo = hasSubs || hasAutoCaptions
    ? "Subtitles available"
    : "No subtitles found (auto-captions may still be generated)"

  if (isPlaylist) {
    const count = info.entries?.length || 0
    setStatus(
      `Playlist: ${title}\nChannel: ${channel}\nVideos: ${count}\n${subInfo}`,
      colors.textGreen,
    )
  } else {
    setStatus(
      `Title: ${title}\nChannel: ${channel}\nDuration: ${duration} | Views: ${views}\n${subInfo}`,
      colors.textGreen,
    )
  }

  // Clean up URL input before showing subtitle options
  if (urlInput) { urlInput.destroy(); urlInput = null }
  if (urlInputBox) { contentBox.remove(urlInputBox.id); urlInputBox = null }

  showSubtitleOptions()
}

// ============================================================================
// Phase: Subtitle Options
// ============================================================================

function showSubtitleOptions() {
  if (!renderer || !contentBox) return
  currentPhase = "subtitle_options"

  const subOptions: SelectOption[] = [
    {
      name: "Skip subtitles",
      description: "Download video/audio only",
      value: "no_subs",
    },
    {
      name: "Download subtitles (English)",
      description: "Download .srt subtitle files alongside video (en)",
      value: "subs_en",
    },
    {
      name: "Download subtitles (custom languages)",
      description: "Specify subtitle languages (e.g. en,es,fr,ja)",
      value: "subs_custom",
    },
  ]

  subtitleSelectBox = new BoxRenderable(renderer, {
    id: "dl-sub-box",
    width: "auto",
    height: "auto",
    minHeight: 5,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentPurple,
    title: "Subtitle Download",
    titleAlignment: "center",
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  subtitleSelect = new SelectRenderable(renderer, {
    id: "dl-sub-select",
    width: "auto",
    height: "auto",
    minHeight: 4,
    options: subOptions,
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

  subtitleSelect.on(SelectRenderableEvents.ITEM_SELECTED, async (_index: number, option: SelectOption) => {
    const val = option.value as string

    // Clean up subtitle select
    if (subtitleSelect) { subtitleSelect.destroy(); subtitleSelect = null }
    if (subtitleSelectBox) { contentBox!.remove(subtitleSelectBox.id); subtitleSelectBox = null }

    if (val === "no_subs") {
      wantSubs = false
      showFormatSelect()
    } else if (val === "subs_en") {
      wantSubs = true
      subLangs = "en.*,en"
      showFormatSelect()
    } else if (val === "subs_custom") {
      wantSubs = true
      showSubLangInput()
    }
  })

  subtitleSelectBox.add(subtitleSelect)
  contentBox.add(subtitleSelectBox)
  subtitleSelect.focus()
  subtitleSelectBox.focus()
}

function showSubLangInput() {
  if (!renderer || !contentBox) return

  subLangInputBox = new BoxRenderable(renderer, {
    id: "dl-sublang-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentPurple,
    title: "Subtitle Languages",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  subLangInput = new InputRenderable(renderer, {
    id: "dl-sublang-input",
    width: "auto",
    placeholder: "en,es,fr,de,ja (comma-separated language codes)",
    backgroundColor: colors.bgInput,
    focusedBackgroundColor: colors.bgInputFocused,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    placeholderColor: colors.textDim,
    cursorColor: colors.textBright,
    maxLength: 200,
    flexGrow: 1,
    flexShrink: 1,
  })

  subLangInput.on(InputRenderableEvents.ENTER, () => {
    const langs = subLangInput?.value?.trim()
    if (langs) {
      subLangs = langs
    } else {
      subLangs = "en.*,en"
    }

    // Clean up
    if (subLangInput) { subLangInput.destroy(); subLangInput = null }
    if (subLangInputBox) { contentBox!.remove(subLangInputBox.id); subLangInputBox = null }

    showFormatSelect()
  })

  subLangInputBox.add(subLangInput)
  contentBox.add(subLangInputBox)
  subLangInput.focus()
  subLangInputBox.focus()
}

// ============================================================================
// Phase: Format Selection
// ============================================================================

function showFormatSelect() {
  if (!renderer || !contentBox || !currentInfo) return
  currentPhase = "format_select"

  const subsLabel = wantSubs ? ` | Subtitles: ${subLangs}` : ""
  setStatus(
    (statusText?.content || "") + `\n\nSelect download format:${subsLabel}`,
    colors.textGreen,
  )

  const formatOptions: SelectOption[] = [
    { name: "Best Quality", description: "Best combined video+audio", value: "best" },
    { name: "MP4", description: "Download as MP4 video", value: "mp4" },
    { name: "MP3", description: "Extract audio as MP3 (requires FFmpeg)", value: "mp3" },
    { name: "High Quality", description: "Best video + best audio merged (requires FFmpeg)", value: "high" },
    { name: "Best Video Only", description: "Highest resolution video stream", value: "bestvideo" },
    { name: "Best Audio Only", description: "Highest quality audio stream", value: "bestaudio" },
  ]

  if (currentInfo.formats) {
    const combined = currentInfo.formats
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
    await handleDownload(option.value as string)
  })

  formatSelectBox.add(formatSelect)
  contentBox.add(formatSelectBox)
  formatSelect.focus()
  formatSelectBox.focus()
}

// ============================================================================
// Phase: Download with Progress Bar
// ============================================================================

async function handleDownload(format: string) {
  if (!renderer || !contentBox || !currentInfo) return
  currentPhase = "downloading"

  // Clean up format select
  if (formatSelect) { formatSelect.destroy(); formatSelect = null }
  if (formatSelectBox) { contentBox.remove(formatSelectBox.id); formatSelectBox = null }

  const title = currentInfo.title || currentUrl
  const subsLabel = wantSubs ? `Subtitles: ${subLangs}\n` : ""
  setStatus(`Downloading: ${title}\nFormat: ${format}\n${subsLabel}`, colors.textYellow)

  // Progress bar
  progressBarText = new TextRenderable(renderer, {
    id: "dl-progress-bar",
    content: renderProgressBar(0),
    fg: colors.textCyan,
    bg: "transparent",
    flexGrow: 0,
    flexShrink: 0,
  })
  contentBox.add(progressBarText)

  // Progress detail
  progressText = new TextRenderable(renderer, {
    id: "dl-progress",
    content: "Starting download...",
    fg: colors.textDim,
    bg: "transparent",
    flexGrow: 1,
    flexShrink: 1,
  })
  contentBox.add(progressText)

  const isPlaylist = currentInfo._type === "playlist" || currentInfo._type === "multi_video"

  const result = await downloadVideoWithProgress(
    {
      url: currentUrl,
      format,
      outputDir: "youtube_downloads",
      isPlaylist,
      downloadSubs: wantSubs,
      subLangs: wantSubs ? subLangs : undefined,
    },
    (progress: DownloadProgress) => {
      // Update progress bar
      if (progressBarText && progress.percent >= 0) {
        progressBarText.content = renderProgressBar(progress.percent)
      }

      // Update detail line
      if (progressText) {
        let detail = ""
        switch (progress.phase) {
          case "downloading":
            if (progress.speed && progress.eta) {
              detail = `Speed: ${progress.speed}  |  ETA: ${progress.eta}  |  Size: ${progress.totalSize || "?"}`
            } else if (progress.percent === 100) {
              detail = "Download complete, processing..."
            } else {
              detail = progress.raw
            }
            break
          case "merging":
            detail = "Merging video and audio streams..."
            if (progressBarText) progressBarText.content = renderProgressBar(100)
            break
          case "post_processing":
            detail = "Post-processing (converting format)..."
            if (progressBarText) progressBarText.content = renderProgressBar(100)
            break
          case "subtitles":
            detail = "Downloading subtitles..."
            break
          case "done":
            detail = "Already downloaded."
            if (progressBarText) progressBarText.content = renderProgressBar(100)
            break
          default:
            detail = progress.raw
        }
        progressText.content = detail
      }
    },
  )

  currentPhase = "done"

  if (result.success) {
    if (progressBarText) progressBarText.content = renderProgressBar(100)
    if (progressText) progressText.content = "Download finished. Embedding metadata..."

    // Post-download: embed metadata (title, artist, thumbnail)
    let metaNote = ""
    if (result.outputDir && currentInfo) {
      try {
        const meta = extractMetadata(currentInfo, currentUrl)
        const latestFile = findLatestFile(result.outputDir)
        if (latestFile) {
          const embedResult = await embedMetadata(latestFile, meta, { embedThumbnail: true })
          if (embedResult.success) {
            metaNote = "\nMetadata: embedded (title, artist, thumbnail)"
          }
        }
      } catch {
        // Non-critical - metadata embedding failure doesn't affect download
      }
    }

    // Post-download: run plugin hooks
    let pluginNote = ""
    if (result.outputDir) {
      try {
        if (progressText) progressText.content = "Running post-download plugins..."
        const latestFile = findLatestFile(result.outputDir)
        const pluginResults = await runHook("post-download", {
          file: latestFile || undefined,
          title: currentInfo?.title,
          url: currentUrl,
          format,
          outputDir: result.outputDir,
          success: true,
        })
        if (pluginResults.length > 0) {
          const passed = pluginResults.filter((r) => r.success).length
          pluginNote = `\nPlugins: ${passed}/${pluginResults.length} ran successfully`
        }
      } catch {
        // Non-critical
      }
    }

    const subsNote = wantSubs ? `\nSubtitles: saved alongside video (${subLangs})` : ""
    setStatus(
      `Download completed!\n\nTitle: ${currentInfo.title}\nSaved to: ${result.outputDir || "youtube_downloads"}${subsNote}${metaNote}${pluginNote}`,
      colors.textGreen,
    )
    if (progressText) progressText.content = "Download finished successfully."
  } else {
    setStatus(`Download failed: ${result.message}`, colors.textRed)
  }

  if (footer) footer.content = "Press ESC or Q to return to main menu"
}

// ============================================================================
// Screen lifecycle
// ============================================================================

export function run(rendererInstance: CliRenderer, initialUrl?: string): Promise<void> {
  return new Promise((resolve) => {
    resolveScreen = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    // Reset state
    wantSubs = false
    subLangs = "en.*,en"
    currentUrl = ""
    currentInfo = null

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

    // If an initial URL was provided (e.g. from search), skip URL input
    if (initialUrl) {
      handleUrlSubmit(initialUrl)
    } else {
      showUrlInput()
    }
  })
}

export function destroy(rendererInstance: CliRenderer): void {
  if (keyHandler) rendererInstance.keyInput.off("keypress", keyHandler)
  if (urlInput) urlInput.destroy()
  if (formatSelect) formatSelect.destroy()
  if (subtitleSelect) subtitleSelect.destroy()
  if (subLangInput) subLangInput.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; urlInputBox = null; urlInput = null
  formatSelect = null; formatSelectBox = null; progressText = null; progressBarText = null
  subtitleSelect = null; subtitleSelectBox = null; subLangInput = null; subLangInputBox = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "url_input"
  wantSubs = false; subLangs = "en.*,en"; currentUrl = ""; currentInfo = null
}
