#!/usr/bin/env bun
/**
 * Tapir TUI - Main Entry Point
 *
 * A terminal user interface for:
 *   - Downloading videos from YouTube, Instagram, TikTok, Vimeo & 1800+ sites
 *   - Converting audio between MP3, AAC, M4A, OGG, WAV, FLAC formats
 *   - Transcribing media from URLs or local files using Whisper
 *
 * Built with OpenTUI (@opentui/core) and TypeScript.
 *
 * Usage:
 *   bun run src/index.ts                  # Interactive TUI
 *   bun run src/index.ts --download URL   # Direct download
 *   bun run src/index.ts --convert FILE   # Direct conversion
 *   bun run src/index.ts --transcribe SRC # Direct transcription
 */

import { VERSION, VERSION_DATE } from "./utils"
import type { AppState, AppScreen } from "./types"
import { isFirstRun } from "./services/setup"

// ============================================================================
// CLI Argument Parsing (runs immediately - no heavy imports)
// ============================================================================

function parseArgs(): { mode: AppScreen; target?: string } {
  const args = process.argv.slice(2)

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Tapir TUI v${VERSION} (${VERSION_DATE})

Usage:
  bun run src/index.ts                    Interactive TUI mode
  bun run src/index.ts --download <URL>   Download a video directly
  bun run src/index.ts --convert <FILE>   Convert audio file directly
  bun run src/index.ts --transcribe <SRC> Transcribe a URL or local file
  bun run src/index.ts --setup            Run dependency setup
  bun run src/index.ts --help             Show this help message

Keyboard Controls (TUI mode):
  UP/DOWN    Navigate menu options
  ENTER      Select / confirm
  TAB        Switch focus between elements
  ESC        Go back / exit current screen
  Q          Quit application (from main menu)

Dependencies:
  Required:  yt-dlp, bun
  Optional:  ffmpeg (for conversion & high-quality downloads)
  Optional:  openai-whisper (for transcription)
`)
    process.exit(0)
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

  return { mode: "main_menu" }
}

// ============================================================================
// Application
// ============================================================================

async function main() {
  const { mode, target } = parseArgs()

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

  const state: AppState = {
    currentScreen: startScreen,
    ffmpegInstalled,
    ytDlpInstalled,
    whisperAvailable,
    outputDir: "youtube_downloads",
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
  const loadConvertScreen = () => import("./screens/convertScreen")
  const loadTranscribeScreen = () => import("./screens/transcribeScreen")

  // Main application loop
  let running = true

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
        })
        mainMenu.destroy(renderer)

        switch (result.choice) {
          case "download":
            state.currentScreen = "download"
            break
          case "convert":
            state.currentScreen = "audio_convert"
            break
          case "transcribe":
            state.currentScreen = "transcribe"
            break
          case "setup":
            state.currentScreen = "setup"
            break
          case "exit":
            running = false
            break
        }
        break
      }

      case "download": {
        const downloadScreen = await loadDownloadScreen()
        await downloadScreen.run(renderer)
        downloadScreen.destroy(renderer)
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
