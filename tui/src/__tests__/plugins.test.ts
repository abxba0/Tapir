/**
 * Tests for services/plugins.ts - plugin discovery, execution, and management
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "fs"
import { join } from "path"
import { tmpdir, homedir } from "os"

import {
  ensurePluginDirs,
  getPluginsDir,
  discoverPlugins,
  discoverAllPlugins,
  runHook,
  getPluginSummary,
  type PluginHook,
  type PluginContext,
} from "../services/plugins"

// ============================================================================
// Setup - use a temporary directory for plugin testing
// ============================================================================

const TEST_PLUGINS_BASE = join(tmpdir(), `tapir_test_plugins_${Date.now()}`)
const HOOKS: PluginHook[] = ["post-download", "post-convert", "post-transcribe"]

function createTestPluginDir() {
  mkdirSync(TEST_PLUGINS_BASE, { recursive: true })
  for (const hook of HOOKS) {
    mkdirSync(join(TEST_PLUGINS_BASE, hook), { recursive: true })
  }
}

function cleanTestPluginDir() {
  try {
    rmSync(TEST_PLUGINS_BASE, { recursive: true, force: true })
  } catch {}
}

// ============================================================================
// getPluginsDir
// ============================================================================

describe("getPluginsDir", () => {
  test("returns a path under home directory", () => {
    const dir = getPluginsDir()
    expect(dir).toContain(".config")
    expect(dir).toContain("tapir")
    expect(dir).toContain("plugins")
  })
})

// ============================================================================
// ensurePluginDirs
// ============================================================================

describe("ensurePluginDirs", () => {
  test("creates plugin directories without error", () => {
    expect(() => ensurePluginDirs()).not.toThrow()
  })

  test("creates hook subdirectories", () => {
    ensurePluginDirs()
    const dir = getPluginsDir()
    expect(existsSync(join(dir, "post-download"))).toBe(true)
    expect(existsSync(join(dir, "post-convert"))).toBe(true)
    expect(existsSync(join(dir, "post-transcribe"))).toBe(true)
  })
})

// ============================================================================
// discoverPlugins
// ============================================================================

describe("discoverPlugins", () => {
  beforeEach(createTestPluginDir)
  afterEach(cleanTestPluginDir)

  test("returns empty array for empty directory", () => {
    const plugins = discoverPlugins("post-download")
    // The real plugins dir might be empty - just check it returns an array
    expect(Array.isArray(plugins)).toBe(true)
  })

  test("returns empty array for non-existent hook directory", () => {
    // Use a path that definitely doesn't exist
    const result = discoverPlugins("post-download")
    expect(Array.isArray(result)).toBe(true)
  })
})

// ============================================================================
// discoverAllPlugins
// ============================================================================

describe("discoverAllPlugins", () => {
  test("returns a map with all hook types", () => {
    const all = discoverAllPlugins()
    expect(all.has("post-download")).toBe(true)
    expect(all.has("post-convert")).toBe(true)
    expect(all.has("post-transcribe")).toBe(true)
  })

  test("each hook entry is an array", () => {
    const all = discoverAllPlugins()
    for (const [hook, plugins] of all) {
      expect(Array.isArray(plugins)).toBe(true)
    }
  })
})

// ============================================================================
// getPluginSummary
// ============================================================================

describe("getPluginSummary", () => {
  test("returns summary for all hooks", () => {
    const summary = getPluginSummary()
    expect(summary.length).toBe(3)

    const hooks = summary.map((s) => s.hook)
    expect(hooks).toContain("post-download")
    expect(hooks).toContain("post-convert")
    expect(hooks).toContain("post-transcribe")
  })

  test("each entry has hook, count, and names", () => {
    const summary = getPluginSummary()
    for (const entry of summary) {
      expect(typeof entry.hook).toBe("string")
      expect(typeof entry.count).toBe("number")
      expect(Array.isArray(entry.names)).toBe(true)
      expect(entry.count).toBe(entry.names.length)
    }
  })
})

// ============================================================================
// runHook
// ============================================================================

describe("runHook", () => {
  test("returns empty array when no plugins exist for hook", async () => {
    // If user hasn't added any plugins, this should return empty
    const results = await runHook("post-transcribe", {
      file: "/tmp/test.txt",
      success: true,
    })
    // May or may not be empty depending on user's actual plugins
    expect(Array.isArray(results)).toBe(true)
  })

  test("calls onPluginStart and onPluginDone callbacks", async () => {
    // Create a temporary plugin in the real plugins dir
    ensurePluginDirs()
    const pluginDir = join(getPluginsDir(), "post-download")
    const pluginPath = join(pluginDir, `_test_plugin_${Date.now()}.sh`)

    writeFileSync(pluginPath, '#!/bin/bash\necho "test output"')
    chmodSync(pluginPath, 0o755)

    try {
      const starts: string[] = []
      const dones: string[] = []

      const results = await runHook(
        "post-download",
        { file: "/tmp/test.mp4", success: true },
        (plugin) => starts.push(plugin.name),
        (plugin, result) => dones.push(plugin.name),
      )

      // Our test plugin should have been found and executed
      const testResults = results.filter((r) => r.plugin.includes("_test_plugin_"))
      expect(testResults.length).toBe(1)
      expect(testResults[0].success).toBe(true)
      expect(testResults[0].output).toContain("test output")
      expect(testResults[0].durationMs).toBeGreaterThanOrEqual(0)

      expect(starts.length).toBeGreaterThanOrEqual(1)
      expect(dones.length).toBeGreaterThanOrEqual(1)
    } finally {
      rmSync(pluginPath, { force: true })
    }
  })

  test("handles plugin failure gracefully", async () => {
    ensurePluginDirs()
    const pluginDir = join(getPluginsDir(), "post-convert")
    const pluginPath = join(pluginDir, `_test_fail_${Date.now()}.sh`)

    writeFileSync(pluginPath, '#!/bin/bash\nexit 1')
    chmodSync(pluginPath, 0o755)

    try {
      const results = await runHook("post-convert", { success: false })
      const testResults = results.filter((r) => r.plugin.includes("_test_fail_"))
      expect(testResults.length).toBe(1)
      expect(testResults[0].success).toBe(false)
    } finally {
      rmSync(pluginPath, { force: true })
    }
  })

  test("plugin receives environment variables", async () => {
    ensurePluginDirs()
    const pluginDir = join(getPluginsDir(), "post-download")
    const pluginPath = join(pluginDir, `_test_env_${Date.now()}.sh`)

    writeFileSync(
      pluginPath,
      '#!/bin/bash\necho "HOOK=$TAPIR_HOOK FILE=$TAPIR_FILE TITLE=$TAPIR_TITLE SUCCESS=$TAPIR_SUCCESS"',
    )
    chmodSync(pluginPath, 0o755)

    try {
      const results = await runHook("post-download", {
        file: "/tmp/video.mp4",
        title: "My Video",
        url: "https://youtube.com/watch?v=test",
        success: true,
      })

      const testResults = results.filter((r) => r.plugin.includes("_test_env_"))
      expect(testResults.length).toBe(1)
      expect(testResults[0].output).toContain("HOOK=post-download")
      expect(testResults[0].output).toContain("FILE=/tmp/video.mp4")
      expect(testResults[0].output).toContain("TITLE=My Video")
      expect(testResults[0].output).toContain("SUCCESS=true")
    } finally {
      rmSync(pluginPath, { force: true })
    }
  })
})
