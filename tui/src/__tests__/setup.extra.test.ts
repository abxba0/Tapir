/**
 * Additional tests for services/setup.ts - installDependency and edge cases
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"

import {
  installDependency,
  uninstallDependency,
  getDependencies,
  getConfigDir,
  cleanupTapirConfig,
  type OSType,
} from "../services/setup"

let originalSpawn: typeof Bun.spawn

beforeEach(() => {
  originalSpawn = Bun.spawn
})

afterEach(() => {
  Bun.spawn = originalSpawn
})

// ============================================================================
// installDependency
// ============================================================================

describe("installDependency", () => {
  test("returns failure for unknown dependency", async () => {
    const result = await installDependency("nonexistent_dep", "ubuntu")
    expect(result.success).toBe(false)
    expect(result.output).toContain("Unknown dependency")
  })

  test("returns failure for unsupported OS", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("command not found"))
          c.close()
        },
      }),
      exited: Promise.resolve(127),
    })) as any

    const result = await installDependency("yt-dlp", "unsupported" as any)
    expect(result.success).toBe(false)
  })

  test("returns success when install command succeeds", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("Successfully installed"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await installDependency("yt-dlp", "ubuntu")
    expect(result.success).toBe(true)
    expect(result.output).toContain("Successfully installed")
  })

  test("tries next command when first fails", async () => {
    let callCount = 0
    Bun.spawn = ((args: string[], opts?: any) => {
      callCount++
      if (callCount === 1) {
        return {
          stdout: new ReadableStream({ start(c) { c.close() } }),
          stderr: new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode("command not found"))
              c.close()
            },
          }),
          exited: Promise.resolve(1),
        }
      }
      return {
        stdout: new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode("installed via pip"))
            c.close()
          },
        }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    // yt-dlp on macOS has two commands: brew and pip3
    const result = await installDependency("yt-dlp", "macos")
    expect(result.success).toBe(true)
  })

  test("returns failure when all install commands fail", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("install failed"))
          c.close()
        },
      }),
      exited: Promise.resolve(1),
    })) as any

    const result = await installDependency("yt-dlp", "ubuntu")
    expect(result.success).toBe(false)
    expect(result.output).toContain("install failed")
  })

  test("handles spawn exception", async () => {
    Bun.spawn = (() => { throw new Error("spawn error") }) as any

    const result = await installDependency("yt-dlp", "ubuntu")
    expect(result.success).toBe(false)
  })

  test("installs python3 on different OSes", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ok"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const osTypes: OSType[] = ["ubuntu", "debian", "fedora", "arch", "alpine", "macos", "windows_wsl"]

    for (const os of osTypes) {
      const result = await installDependency("python3", os)
      expect(result.success).toBe(true)
    }
  })

  test("installs ffmpeg on different OSes", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ok"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const osTypes: OSType[] = ["ubuntu", "fedora", "arch", "opensuse", "alpine"]
    for (const os of osTypes) {
      const result = await installDependency("ffmpeg", os)
      expect(result.success).toBe(true)
    }
  })

  test("installs whisper", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ok"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await installDependency("whisper", "ubuntu")
    expect(result.success).toBe(true)
  })

  test("installs pip", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ok"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await installDependency("pip", "macos")
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// uninstallDependency
// ============================================================================

describe("uninstallDependency", () => {
  test("returns failure for unknown dependency", async () => {
    const result = await uninstallDependency("nonexistent_dep", "ubuntu")
    expect(result.success).toBe(false)
    expect(result.output).toContain("Unknown dependency")
  })

  test("returns success when uninstall command succeeds", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("Successfully uninstalled"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await uninstallDependency("yt-dlp", "ubuntu")
    expect(result.success).toBe(true)
    expect(result.output).toContain("uninstalled")
  })

  test("returns failure when uninstall command fails", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("permission denied"))
          c.close()
        },
      }),
      exited: Promise.resolve(1),
    })) as any

    const result = await uninstallDependency("whisper", "ubuntu")
    expect(result.success).toBe(false)
    expect(result.output).toContain("permission denied")
  })

  test("handles spawn exception", async () => {
    Bun.spawn = (() => { throw new Error("spawn error") }) as any

    const result = await uninstallDependency("ffmpeg", "ubuntu")
    expect(result.success).toBe(false)
  })

  test("uninstalls ffmpeg on different OSes", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ok"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const osTypes: OSType[] = ["ubuntu", "fedora", "arch", "opensuse", "alpine", "macos", "windows_wsl"]
    for (const os of osTypes) {
      const result = await uninstallDependency("ffmpeg", os)
      expect(result.success).toBe(true)
    }
  })

  test("uninstalls whisper on different OSes", async () => {
    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ok"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const osTypes: OSType[] = ["ubuntu", "macos", "arch"]
    for (const os of osTypes) {
      const result = await uninstallDependency("whisper", os)
      expect(result.success).toBe(true)
    }
  })

  test("returns failure for dep without uninstall commands", async () => {
    // python3 and pip don't have uninstallCommands
    const result = await uninstallDependency("python3", "ubuntu")
    expect(result.success).toBe(false)
    expect(result.output).toContain("No uninstall command")
  })
})

// ============================================================================
// cleanupTapirConfig & getConfigDir
// ============================================================================

describe("getConfigDir", () => {
  test("returns a path containing tapir", () => {
    const dir = getConfigDir()
    expect(dir).toContain("tapir")
  })
})

describe("cleanupTapirConfig", () => {
  test("returns removed and errors arrays", () => {
    const result = cleanupTapirConfig()
    expect(Array.isArray(result.removed)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
  })
})

// ============================================================================
// getDependencies - checkFn coverage
// ============================================================================

describe("getDependencies checkFn", () => {
  test("each dependency checkFn returns a boolean", async () => {
    const deps = getDependencies()
    for (const dep of deps) {
      const result = await dep.checkFn()
      expect(typeof result).toBe("boolean")
    }
  })

  test("uninstallable deps have uninstallCommands", () => {
    const deps = getDependencies()
    const uninstallable = deps.filter((d) => d.name === "yt-dlp" || d.name === "ffmpeg" || d.name === "whisper")
    for (const dep of uninstallable) {
      expect(dep.uninstallCommands).toBeDefined()
      expect(Object.keys(dep.uninstallCommands!).length).toBeGreaterThan(0)
    }
  })
})
