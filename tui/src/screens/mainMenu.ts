/**
 * Main Menu Screen - Entry point for the TUI app
 *
 * Options:
 *   1. Download video from supported sites
 *   2. Convert audio/music file
 *   3. Transcribe media (URL or local file)
 *   4. Exit
 */

import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core"
import type { SelectOption } from "@opentui/core"
import { colors, layout } from "../components/theme"
import { VERSION } from "../utils"

export interface MainMenuResult {
  choice: "download" | "search" | "convert" | "transcribe" | "setup" | "exit"
}

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let menuSelect: SelectRenderable | null = null
let menuBox: BoxRenderable | null = null
let infoText: TextRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let resolveChoice: ((result: MainMenuResult) => void) | null = null

const menuOptions: SelectOption[] = [
  {
    name: "Download Video",
    description: "Download from YouTube, Instagram, TikTok, Vimeo & 1800+ sites",
    value: "download",
  },
  {
    name: "Search YouTube",
    description: "Search YouTube and download directly from search results",
    value: "search",
  },
  {
    name: "Convert Audio",
    description: "Convert between MP3, AAC, M4A, OGG, WAV, FLAC formats",
    value: "convert",
  },
  {
    name: "Transcribe Media",
    description: "Get transcriptions from URLs or local audio/video files",
    value: "transcribe",
  },
  {
    name: "Setup / Install Dependencies",
    description: "Check and install required & optional packages",
    value: "setup",
  },
  {
    name: "Exit",
    description: "Close the application",
    value: "exit",
  },
]

export function run(
  rendererInstance: CliRenderer,
  state: { ffmpegInstalled: boolean; ytDlpInstalled: boolean; whisperAvailable: boolean },
): Promise<MainMenuResult> {
  return new Promise((resolve) => {
    resolveChoice = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    // Header
    headerBox = new BoxRenderable(renderer, {
      id: "mm-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: colors.headerBg,
      borderStyle: "single",
      borderColor: colors.headerBorder,
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    const title = `Tapir - Media Downloader, Converter & Transcriber  v${VERSION}`
    header = new TextRenderable(renderer, {
      id: "mm-header",
      content: title,
      fg: colors.textBright,
      bg: "transparent",
      flexGrow: 1,
      flexShrink: 1,
    })
    headerBox.add(header)

    // Content area
    contentBox = new BoxRenderable(renderer, {
      id: "mm-content",
      width: "auto",
      height: "auto",
      flexGrow: 1,
      flexShrink: 1,
      backgroundColor: colors.bgPanel,
      borderStyle: "single",
      borderColor: colors.border,
      border: true,
      flexDirection: "column",
      gap: 1,
    })

    // Info text
    const depStatus = [
      `yt-dlp: ${state.ytDlpInstalled ? "Installed" : "Not Found"}`,
      `FFmpeg: ${state.ffmpegInstalled ? "Installed" : "Not Found"}`,
      `Whisper: ${state.whisperAvailable ? "Available" : "Not Installed"}`,
    ].join("  |  ")

    infoText = new TextRenderable(renderer, {
      id: "mm-info",
      content: `${depStatus}\n\nSelect an option:`,
      fg: colors.textDim,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(infoText)

    // Menu select with border box
    menuBox = new BoxRenderable(renderer, {
      id: "mm-menu-box",
      width: "auto",
      height: "auto",
      minHeight: 8,
      borderStyle: "single",
      borderColor: colors.border,
      focusedBorderColor: colors.borderFocused,
      title: "Main Menu",
      titleAlignment: "center",
      flexGrow: 1,
      flexShrink: 1,
      backgroundColor: "transparent",
      border: true,
    })

    menuSelect = new SelectRenderable(renderer, {
      id: "mm-menu-select",
      width: "auto",
      height: "auto",
      minHeight: 6,
      options: menuOptions,
      backgroundColor: colors.bgPanel,
      focusedBackgroundColor: colors.bgInput,
      textColor: colors.text,
      focusedTextColor: colors.textBright,
      selectedBackgroundColor: colors.bgSelected,
      selectedTextColor: "#ffffff",
      descriptionColor: colors.textDim,
      selectedDescriptionColor: colors.textCyan,
      showScrollIndicator: true,
      wrapSelection: true,
      showDescription: true,
      flexGrow: 1,
      flexShrink: 1,
    })

    menuSelect.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
      const val = option.value as string
      if (resolveChoice) {
        resolveChoice({ choice: val as MainMenuResult["choice"] })
        resolveChoice = null
      }
    })

    menuBox.add(menuSelect)
    contentBox.add(menuBox)

    // Footer
    footerBox = new BoxRenderable(renderer, {
      id: "mm-footer-box",
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
      id: "mm-footer",
      content: "UP/DOWN: Navigate | ENTER: Select | Q: Quit",
      fg: colors.textDim,
      bg: "transparent",
      flexGrow: 1,
      flexShrink: 1,
    })
    footerBox.add(footer)

    // Assemble layout
    renderer.root.add(headerBox)
    renderer.root.add(contentBox)
    renderer.root.add(footerBox)

    // Focus the menu
    menuSelect.focus()
    menuBox.focus()
  })
}

export function destroy(rendererInstance: CliRenderer): void {
  if (menuSelect) menuSelect.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null
  header = null
  contentBox = null
  menuSelect = null
  menuBox = null
  infoText = null
  footerBox = null
  footer = null
  renderer = null
  resolveChoice = null
}
