/**
 * Tests for services/settings.ts
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, unlinkSync, mkdirSync, readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

import {
  loadSettings,
  saveSettings,
  getDefaultSettings,
  getSettingsPath,
  type UserSettings,
} from "../services/settings"

const SETTINGS_DIR = join(homedir(), ".config", "tapir")
const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json")

let hadExistingFile = false
let existingContent: string | null = null

beforeEach(() => {
  // Backup existing settings file if present
  if (existsSync(SETTINGS_FILE)) {
    hadExistingFile = true
    existingContent = readFileSync(SETTINGS_FILE, "utf-8")
  } else {
    hadExistingFile = false
    existingContent = null
  }
})

afterEach(() => {
  // Restore original settings file
  if (hadExistingFile && existingContent !== null) {
    const { writeFileSync } = require("fs")
    writeFileSync(SETTINGS_FILE, existingContent, "utf-8")
  } else if (!hadExistingFile && existsSync(SETTINGS_FILE)) {
    unlinkSync(SETTINGS_FILE)
  }
})

// ============================================================================
// getDefaultSettings
// ============================================================================

describe("getDefaultSettings", () => {
  test("returns an object with all expected keys", () => {
    const defaults = getDefaultSettings()
    expect(defaults.outputDir).toBe("youtube_downloads")
    expect(defaults.preferredFormat).toBe("best")
    expect(defaults.subtitleLang).toBe("en")
    expect(defaults.downloadSubs).toBe(false)
    expect(defaults.whisperModel).toBe("base")
    expect(defaults.apiPort).toBe(8384)
    expect(defaults.autoCheckUpdates).toBe(true)
  })

  test("returns a fresh copy each time", () => {
    const a = getDefaultSettings()
    const b = getDefaultSettings()
    expect(a).toEqual(b)
    a.outputDir = "changed"
    expect(b.outputDir).toBe("youtube_downloads")
  })
})

// ============================================================================
// getSettingsPath
// ============================================================================

describe("getSettingsPath", () => {
  test("returns the settings file path", () => {
    const path = getSettingsPath()
    expect(path).toContain(".config")
    expect(path).toContain("tapir")
    expect(path).toContain("settings.json")
  })
})

// ============================================================================
// saveSettings / loadSettings
// ============================================================================

describe("saveSettings and loadSettings", () => {
  test("saves and loads settings correctly", () => {
    const custom: UserSettings = {
      outputDir: "my_videos",
      preferredFormat: "mp4",
      subtitleLang: "es",
      downloadSubs: true,
      whisperModel: "small",
      apiPort: 9000,
      autoCheckUpdates: false,
    }
    saveSettings(custom)
    const loaded = loadSettings()
    expect(loaded).toEqual(custom)
  })

  test("loadSettings returns defaults when no file exists", () => {
    if (existsSync(SETTINGS_FILE)) unlinkSync(SETTINGS_FILE)
    const loaded = loadSettings()
    expect(loaded).toEqual(getDefaultSettings())
  })

  test("loadSettings merges with defaults for partial files", () => {
    const { writeFileSync } = require("fs")
    mkdirSync(SETTINGS_DIR, { recursive: true })
    writeFileSync(SETTINGS_FILE, JSON.stringify({ outputDir: "custom_dir" }), "utf-8")
    const loaded = loadSettings()
    expect(loaded.outputDir).toBe("custom_dir")
    expect(loaded.preferredFormat).toBe("best") // default
    expect(loaded.apiPort).toBe(8384) // default
  })

  test("loadSettings returns defaults for malformed JSON", () => {
    const { writeFileSync } = require("fs")
    mkdirSync(SETTINGS_DIR, { recursive: true })
    writeFileSync(SETTINGS_FILE, "not json", "utf-8")
    const loaded = loadSettings()
    expect(loaded).toEqual(getDefaultSettings())
  })
})
