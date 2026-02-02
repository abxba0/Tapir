/**
 * User settings service - Persistent preferences for Tapir.
 *
 * Stored in ~/.config/tapir/settings.json alongside config.json.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { homedir } from "os"
import { join } from "path"

// ============================================================================
// Types
// ============================================================================

export interface UserSettings {
  outputDir: string
  preferredFormat: string
  subtitleLang: string
  downloadSubs: boolean
  whisperModel: string
  apiPort: number
  autoCheckUpdates: boolean
}

// ============================================================================
// Defaults
// ============================================================================

const SETTINGS_DIR = join(homedir(), ".config", "tapir")
const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json")

const DEFAULT_SETTINGS: UserSettings = {
  outputDir: "youtube_downloads",
  preferredFormat: "best",
  subtitleLang: "en",
  downloadSubs: false,
  whisperModel: "base",
  apiPort: 8384,
  autoCheckUpdates: true,
}

// ============================================================================
// Load / Save
// ============================================================================

export function loadSettings(): UserSettings {
  try {
    if (!existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS }
    const raw = readFileSync(SETTINGS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    mkdirSync(SETTINGS_DIR, { recursive: true })
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8")
  } catch {
    // Silently fail - non-critical
  }
}

export function getDefaultSettings(): UserSettings {
  return { ...DEFAULT_SETTINGS }
}

export function getSettingsPath(): string {
  return SETTINGS_FILE
}
