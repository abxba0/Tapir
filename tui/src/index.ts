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

import { createCliRenderer, type CliRenderer, type KeyEvent } from "@opentui/core"
import { VERSION, VERSION_DATE, checkYtDlp, checkFfmpeg, checkWhisper } from "./utils"
import type { AppState, AppScreen } from "./types"

import * as mainMenu from "./screens/mainMenu"
import * as downloadScreen from "./screens/downloadScreen"
import * as convertScreen from "./screens/convertScreen"
import * as transcribeScreen from "./screens/transcribeScreen"

// ============================================================================
// CLI Argument Parsing
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

  // Check dependencies
  console.log("Checking dependencies...")
  const [ytDlpInstalled, ffmpegInstalled, whisperAvailable] = await Promise.all([
    checkYtDlp(),
    checkFfmpeg(),
    checkWhisper(),
  ])

  if (!ytDlpInstalled) {
    console.error("Error: yt-dlp is not installed.")
    console.error("Install it with: pip install yt-dlp")
    process.exit(1)
  }

  console.log(`  yt-dlp:  ${ytDlpInstalled ? "OK" : "NOT FOUND"}`)
  console.log(`  ffmpeg:  ${ffmpegInstalled ? "OK" : "NOT FOUND"}`)
  console.log(`  whisper: ${whisperAvailable ? "OK" : "NOT FOUND"}`)

  const state: AppState = {
    currentScreen: mode,
    ffmpegInstalled,
    ytDlpInstalled,
    whisperAvailable,
    outputDir: "youtube_downloads",
    statusMessage: "",
    isProcessing: false,
  }

  // Create the renderer
  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    targetFps: 30,
  })

  // Global quit handler
  const globalKeyHandler = (key: KeyEvent) => {
    if (key.name === "q" && state.currentScreen === "main_menu") {
      cleanup(renderer)
      process.exit(0)
    }
  }
  renderer.keyInput.on("keypress", globalKeyHandler)

  // Main application loop
  let running = true

  while (running) {
    switch (state.currentScreen) {
      case "main_menu": {
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
          case "exit":
            running = false
            break
        }
        break
      }

      case "download": {
        await downloadScreen.run(renderer)
        downloadScreen.destroy(renderer)
        state.currentScreen = "main_menu"
        break
      }

      case "audio_convert": {
        await convertScreen.run(renderer)
        convertScreen.destroy(renderer)
        state.currentScreen = "main_menu"
        break
      }

      case "transcribe": {
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

function cleanup(renderer: CliRenderer) {
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
