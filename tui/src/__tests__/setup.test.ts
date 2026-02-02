/**
 * Tests for services/setup.ts - OS detection, config persistence, dependencies
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "fs"
import { join } from "path"
import { tmpdir, homedir } from "os"

import {
  detectOS,
  osDisplayName,
  loadConfig,
  saveConfig,
  markSetupComplete,
  isFirstRun,
  getDependencies,
  checkAllDependencies,
  type OSType,
  type TapirConfig,
} from "../services/setup"

// ============================================================================
// detectOS
// ============================================================================

describe("detectOS", () => {
  test("returns a valid OS type", () => {
    const os = detectOS()
    const validTypes: OSType[] = [
      "macos", "ubuntu", "debian", "fedora", "arch",
      "opensuse", "alpine", "linux_unknown", "windows_wsl", "unsupported",
    ]
    expect(validTypes).toContain(os)
  })

  test("returns string type", () => {
    expect(typeof detectOS()).toBe("string")
  })
})

// ============================================================================
// osDisplayName
// ============================================================================

describe("osDisplayName", () => {
  test("maps macos correctly", () => {
    expect(osDisplayName("macos")).toBe("macOS")
  })

  test("maps ubuntu correctly", () => {
    expect(osDisplayName("ubuntu")).toBe("Ubuntu/Debian")
  })

  test("maps debian correctly", () => {
    expect(osDisplayName("debian")).toBe("Debian")
  })

  test("maps fedora correctly", () => {
    expect(osDisplayName("fedora")).toBe("Fedora/RHEL")
  })

  test("maps arch correctly", () => {
    expect(osDisplayName("arch")).toBe("Arch Linux")
  })

  test("maps opensuse correctly", () => {
    expect(osDisplayName("opensuse")).toBe("openSUSE")
  })

  test("maps alpine correctly", () => {
    expect(osDisplayName("alpine")).toBe("Alpine Linux")
  })

  test("maps linux_unknown correctly", () => {
    expect(osDisplayName("linux_unknown")).toBe("Linux")
  })

  test("maps windows_wsl correctly", () => {
    expect(osDisplayName("windows_wsl")).toBe("Windows (WSL)")
  })

  test("maps unsupported correctly", () => {
    expect(osDisplayName("unsupported")).toBe("Unsupported OS")
  })
})

// ============================================================================
// Config persistence
// ============================================================================

describe("Config persistence", () => {
  const CONFIG_DIR = join(homedir(), ".config", "tapir")
  const CONFIG_FILE = join(CONFIG_DIR, "config.json")
  let originalConfig: string | null = null

  beforeEach(() => {
    // Back up existing config
    try {
      originalConfig = readFileSync(CONFIG_FILE, "utf-8")
    } catch {
      originalConfig = null
    }
  })

  afterEach(() => {
    // Restore original config
    if (originalConfig !== null) {
      writeFileSync(CONFIG_FILE, originalConfig)
    }
  })

  test("saveConfig writes a JSON file", () => {
    const config: TapirConfig = {
      setupCompleted: true,
      lastCheckTimestamp: Date.now(),
      os: "ubuntu",
    }
    saveConfig(config)
    expect(existsSync(CONFIG_FILE)).toBe(true)

    const loaded = loadConfig()
    expect(loaded).not.toBeNull()
    expect(loaded!.setupCompleted).toBe(true)
    expect(loaded!.os).toBe("ubuntu")
  })

  test("loadConfig returns null when no config exists", () => {
    // Temporarily remove config
    try { rmSync(CONFIG_FILE) } catch {}

    const result = loadConfig()
    expect(result).toBeNull()
  })

  test("markSetupComplete sets setupCompleted to true", () => {
    markSetupComplete()
    const config = loadConfig()
    expect(config).not.toBeNull()
    expect(config!.setupCompleted).toBe(true)
  })

  test("isFirstRun returns false after markSetupComplete", () => {
    markSetupComplete()
    expect(isFirstRun()).toBe(false)
  })

  test("isFirstRun returns true when config is missing", () => {
    try { rmSync(CONFIG_FILE) } catch {}
    expect(isFirstRun()).toBe(true)
  })
})

// ============================================================================
// getDependencies
// ============================================================================

describe("getDependencies", () => {
  test("returns 5 dependencies", () => {
    const deps = getDependencies()
    expect(deps.length).toBe(5)
  })

  test("has python3, pip, yt-dlp, ffmpeg, whisper", () => {
    const deps = getDependencies()
    const names = deps.map((d) => d.name)
    expect(names).toContain("python3")
    expect(names).toContain("pip")
    expect(names).toContain("yt-dlp")
    expect(names).toContain("ffmpeg")
    expect(names).toContain("whisper")
  })

  test("required dependencies are marked correctly", () => {
    const deps = getDependencies()
    const python = deps.find((d) => d.name === "python3")!
    const ffmpeg = deps.find((d) => d.name === "ffmpeg")!
    const whisper = deps.find((d) => d.name === "whisper")!

    expect(python.required).toBe(true)
    expect(ffmpeg.required).toBe(false)
    expect(whisper.required).toBe(false)
  })

  test("each dependency has install commands for major OS types", () => {
    const deps = getDependencies()
    const requiredOS: OSType[] = ["macos", "ubuntu", "debian", "fedora", "arch"]

    for (const dep of deps) {
      for (const os of requiredOS) {
        expect(dep.installCommands[os]).toBeDefined()
        expect(dep.installCommands[os]!.length).toBeGreaterThan(0)
      }
    }
  })

  test("each dependency has a checkFn", () => {
    const deps = getDependencies()
    for (const dep of deps) {
      expect(typeof dep.checkFn).toBe("function")
    }
  })

  test("each dependency has description", () => {
    const deps = getDependencies()
    for (const dep of deps) {
      expect(dep.description.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================================
// checkAllDependencies
// ============================================================================

describe("checkAllDependencies", () => {
  test("returns status for all dependencies", async () => {
    const statuses = await checkAllDependencies()
    expect(statuses.length).toBe(5)

    for (const status of statuses) {
      expect(typeof status.name).toBe("string")
      expect(typeof status.installed).toBe("boolean")
      expect(typeof status.required).toBe("boolean")
      expect(typeof status.description).toBe("string")
    }
  })

  test("yt-dlp check returns a boolean", async () => {
    const statuses = await checkAllDependencies()
    const ytdlp = statuses.find((s) => s.name === "yt-dlp")
    expect(ytdlp).toBeDefined()
    expect(typeof ytdlp!.installed).toBe("boolean")
  })
})
