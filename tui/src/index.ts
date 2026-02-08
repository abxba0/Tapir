#!/usr/bin/env bun
/**
 * Tapir TUI - Main Entry Point
 *
 * A terminal user interface for:
 *   - Downloading videos from YouTube, Instagram, TikTok, Vimeo & 1800+ sites
 *   - Converting audio between MP3, AAC, M4A, OGG, WAV, FLAC formats
 *   - Transcribing media from URLs or local files using Whisper
 *   - Batch downloading multiple URLs with queue management
 *   - Browsing playlists and selecting individual videos
 *
 * Also supports:
 *   - REST API daemon mode (--server)
 *   - MCP server for AI agents (--mcp)
 *   - Plugin system (~/.config/tapir/plugins/)
 *   - Metadata embedding (automatic on download)
 *   - Persistent user settings (~/.config/tapir/settings.json)
 *   - Auto-update checking for yt-dlp
 *
 * Built with OpenTUI (@opentui/core) and TypeScript.
 */

import { VERSION, VERSION_DATE } from "./utils"
import type { AppState, AppScreen } from "./types"
import { isFirstRun } from "./services/setup"
import { loadSettings } from "./services/settings"

// ============================================================================
// CLI Argument Parsing (runs immediately - no heavy imports)
// ============================================================================

interface ParsedArgs {
  mode: AppScreen | "server" | "mcp"
  target?: string
  port?: number
  host?: string
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Tapir v${VERSION} (${VERSION_DATE})

Usage:
  bun run src/index.ts                    Interactive TUI mode
  bun run src/index.ts --download <URL>   Download a video directly
  bun run src/index.ts --convert <FILE>   Convert audio file directly
  bun run src/index.ts --transcribe <SRC> Transcribe a URL or local file
  bun run src/index.ts --tts <FILE>       Convert a document to speech audio
  bun run src/index.ts --setup            Run dependency setup
  bun run src/index.ts --server [--port N] [--host ADDR] Start REST API server
  bun run src/index.ts --mcp              Start MCP server for AI agents (stdio)
  bun run src/index.ts --help             Show this help message

Keyboard Controls (TUI mode):
  UP/DOWN    Navigate menu options
  ENTER      Select / confirm
  TAB        Switch focus between elements
  ESC        Go back / exit current screen
  Q          Quit application (from main menu)

Server mode (REST API):
  POST /api/download        Queue a download
  POST /api/search          YouTube search
  POST /api/info            Get video info
  POST /api/convert         Queue audio conversion
  GET  /api/jobs            List all jobs
  GET  /api/jobs/:id        Get job status
  POST /api/metadata/embed  Embed metadata into file
  GET  /api/plugins         List installed plugins
  GET  /api/health          Health check

MCP mode (AI agents):
  Tools: search_youtube, get_video_info, download_video,
         convert_audio, embed_metadata, list_plugins

Plugins:
  Drop scripts into ~/.config/tapir/plugins/{hook}/ to run automatically.
  Hooks: post-download, post-convert, post-transcribe
  Supported: .sh, .js, .ts, .py

Settings:
  Stored in ~/.config/tapir/settings.json
  Configure via TUI Settings screen or edit directly.

Dependencies:
  Required:  yt-dlp, bun
  Optional:  ffmpeg (for conversion, metadata embedding & high-quality downloads)
  Optional:  faster-whisper (for transcription)
`)
    process.exit(0)
  }

  // Server mode
  if (args.includes("--server")) {
    const portIdx = args.indexOf("--port")
    const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1]) : undefined
    const hostIdx = args.indexOf("--host")
    const host = hostIdx !== -1 && args[hostIdx + 1] ? args[hostIdx + 1] : undefined
    const settings = loadSettings()
    return { mode: "server", port: port ?? settings.apiPort, host }
  }

  // MCP mode
  if (args.includes("--mcp")) {
    return { mode: "mcp" }
  }

  if (args.includes("--setup")) {
    return { mode: "setup" }
  }

  const downloadIdx = args.indexOf("--download")
  if (downloadIdx !== -1 && args[downloadIdx + 1]) {
    return { mode: "download", target: args[downloadIdx + 1] }
  }

  const convertIdx = args.indexOf("--convert")
  if (convertIdx !== -1 && args[convertIdx + 1]) {
    return { mode: "audio_convert", target: args[convertIdx + 1] }
  }

  const transcribeIdx = args.indexOf("--transcribe")
  if (transcribeIdx !== -1 && args[transcribeIdx + 1]) {
    return { mode: "transcribe", target: args[transcribeIdx + 1] }
  }

  const ttsIdx = args.indexOf("--tts")
  if (ttsIdx !== -1 && args[ttsIdx + 1]) {
    return { mode: "text_to_speech", target: args[ttsIdx + 1] }
  }

  return { mode: "main_menu" }
}

// ============================================================================
// Application
// ============================================================================

async function main() {
  const { mode, target, port, host } = parseArgs()

  // Non-TUI modes: server and MCP
  if (mode === "server") {
    const { startServer } = await import("./server")
    startServer(port, host)
    return
  }

  if (mode === "mcp") {
    const { startMcpServer } = await import("./mcp")
    await startMcpServer()
    return
  }

  // On first run (or --setup), show the setup screen before anything else.
  // Otherwise go straight to the requested screen.
  const firstRun = isFirstRun()
  const startScreen: AppScreen = (firstRun && mode === "main_menu") ? "setup" : mode

  // Lazy-import the renderer only when we actually need it.
  // This avoids loading @opentui/core for --help.
  const { createCliRenderer } = await import("@opentui/core")

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
  })

  // Run dependency checks in parallel while renderer initialises
  const { checkYtDlp, checkFfmpeg, checkWhisper } = await import("./utils")
  const [ytDlpInstalled, ffmpegInstalled, whisperAvailable] = await Promise.all([
    checkYtDlp(),
    checkFfmpeg(),
    checkWhisper(),
  ])

  // Auto-update check (non-blocking, runs in background)
  const settings = loadSettings()
  let updateAvailable = false
  let currentVersion: string | null = null
  let latestVersion: string | null = null

  if (settings.autoCheckUpdates && ytDlpInstalled) {
    // Fire and forget - don't block startup
    import("./services/updater").then(async ({ checkForUpdates }) => {
      try {
        const info = await checkForUpdates()
        updateAvailable = info.updateAvailable
        currentVersion = info.currentVersion
        latestVersion = info.latestVersion
      } catch {
        // Non-critical
      }
    })
  }

  const state: AppState = {
    currentScreen: startScreen,
    ffmpegInstalled,
    ytDlpInstalled,
    whisperAvailable,
    outputDir: settings.outputDir,
    statusMessage: "",
    isProcessing: false,
  }

  // Global quit handler
  renderer.keyInput.on("keypress", (key: any) => {
    if (key.name === "q" && state.currentScreen === "main_menu") {
      cleanup(renderer)
      process.exit(0)
    }
  })

  // Lazy screen loaders - only import when navigating to a screen
  const loadMainMenu = () => import("./screens/mainMenu")
  const loadSetupScreen = () => import("./screens/setupScreen")
  const loadDownloadScreen = () => import("./screens/downloadScreen")
  const loadSearchScreen = () => import("./screens/searchScreen")
  const loadConvertScreen = () => import("./screens/convertScreen")
  const loadTranscribeScreen = () => import("./screens/transcribeScreen")
  const loadSettingsScreen = () => import("./screens/settingsScreen")
  const loadBatchScreen = () => import("./screens/batchScreen")
  const loadPlaylistScreen = () => import("./screens/playlistScreen")
  const loadUninstallScreen = () => import("./screens/uninstallScreen")
  const loadTtsScreen = () => import("./screens/ttsScreen")

  // Main application loop
  let running = true
  let pendingDownloadUrl: string | undefined

  while (running) {
    switch (state.currentScreen) {
      case "setup": {
        const setupScreen = await loadSetupScreen()
        const setupResult = await setupScreen.run(renderer)
        setupScreen.destroy(renderer)

        if (setupResult.action === "exit") {
          running = false
          break
        }

        // Update dependency state from setup results
        state.ytDlpInstalled = setupResult.ytDlpInstalled
        state.ffmpegInstalled = setupResult.ffmpegInstalled
        state.whisperAvailable = setupResult.whisperAvailable
        state.currentScreen = "main_menu"
        break
      }

      case "main_menu": {
        const mainMenu = await loadMainMenu()
        const result = await mainMenu.run(renderer, {
          ffmpegInstalled: state.ffmpegInstalled,
          ytDlpInstalled: state.ytDlpInstalled,
          whisperAvailable: state.whisperAvailable,
          updateAvailable,
          currentVersion,
          latestVersion,
        })
        mainMenu.destroy(renderer)

        switch (result.choice) {
          case "download":
            state.currentScreen = "download"
            break
          case "search":
            state.currentScreen = "search"
            break
          case "playlist":
            state.currentScreen = "playlist_browse"
            break
          case "batch":
            state.currentScreen = "batch"
            break
          case "convert":
            state.currentScreen = "audio_convert"
            break
          case "transcribe":
            state.currentScreen = "transcribe"
            break
          case "tts":
            state.currentScreen = "text_to_speech"
            break
          case "settings":
            state.currentScreen = "settings"
            break
          case "setup":
            state.currentScreen = "setup"
            break
          case "uninstall":
            state.currentScreen = "uninstall"
            break
          case "exit":
            running = false
            break
        }
        break
      }

      case "search": {
        const searchScreen = await loadSearchScreen()
        const searchResult = await searchScreen.run(renderer)
        searchScreen.destroy(renderer)

        if (searchResult.action === "download" && searchResult.url) {
          // Go straight to download with the selected URL
          pendingDownloadUrl = searchResult.url
          state.currentScreen = "download"
        } else {
          state.currentScreen = "main_menu"
        }
        break
      }

      case "download": {
        const downloadScreen = await loadDownloadScreen()
        await downloadScreen.run(renderer, pendingDownloadUrl)
        downloadScreen.destroy(renderer)
        pendingDownloadUrl = undefined
        state.currentScreen = "main_menu"
        break
      }

      case "batch": {
        const batchScreen = await loadBatchScreen()
        await batchScreen.run(renderer)
        batchScreen.destroy(renderer)
        state.currentScreen = "main_menu"
        break
      }

      case "playlist_browse": {
        const playlistScreen = await loadPlaylistScreen()
        await playlistScreen.run(renderer)
        playlistScreen.destroy(renderer)
        state.currentScreen = "main_menu"
        break
      }

      case "audio_convert": {
        const convertScreen = await loadConvertScreen()
        await convertScreen.run(renderer)
        convertScreen.destroy(renderer)
        state.currentScreen = "main_menu"
        break
      }

      case "transcribe": {
        const transcribeScreen = await loadTranscribeScreen()
        await transcribeScreen.run(renderer)
        transcribeScreen.destroy(renderer)
        state.currentScreen = "main_menu"
        break
      }

      case "text_to_speech": {
        const ttsScreen = await loadTtsScreen()
        await ttsScreen.run(renderer)
        ttsScreen.destroy(renderer)
        state.currentScreen = "main_menu"
        break
      }

      case "settings": {
        const settingsScreen = await loadSettingsScreen()
        await settingsScreen.run(renderer)
        settingsScreen.destroy(renderer)
        // Reload settings after changes
        const newSettings = loadSettings()
        state.outputDir = newSettings.outputDir
        state.currentScreen = "main_menu"
        break
      }

      case "uninstall": {
        const uninstallScreen = await loadUninstallScreen()
        const uninstallResult = await uninstallScreen.run(renderer)
        uninstallScreen.destroy(renderer)

        if (uninstallResult.action === "exit_app") {
          running = false
        } else {
          // Re-check deps after potential removals
          const [yt, ff, wh] = await Promise.all([
            checkYtDlp(),
            checkFfmpeg(),
            checkWhisper(),
          ])
          state.ytDlpInstalled = yt
          state.ffmpegInstalled = ff
          state.whisperAvailable = wh
          state.currentScreen = "main_menu"
        }
        break
      }

      default:
        running = false
        break
    }
  }

  cleanup(renderer)
}

function cleanup(renderer: any) {
  renderer.stop()
  console.log("\nGoodbye!")
  console.log("\nDISCLAIMER:")
  console.log("This tool is for personal and educational use only.")
  console.log("Please respect copyright laws and the Terms of Service of each platform.")
  console.log("Only download/transcribe content you have permission to access.")
}

// Run
main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
