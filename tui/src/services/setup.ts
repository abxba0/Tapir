/**
 * Setup service - OS detection, dependency checking, and package installation.
 *
 * Detects the current operating system and provides the correct install
 * commands for each dependency. Handles first-run config persistence
 * so the setup prompt only appears once.
 */

import { $ } from "bun"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { homedir, platform, release } from "os"
import { join } from "path"

// ============================================================================
// Types
// ============================================================================

export type OSType =
  | "macos"
  | "ubuntu"
  | "debian"
  | "fedora"
  | "arch"
  | "opensuse"
  | "alpine"
  | "linux_unknown"
  | "windows_wsl"
  | "unsupported"

export interface DependencyInfo {
  name: string
  description: string
  required: boolean
  checkFn: () => Promise<boolean>
  installCommands: Partial<Record<OSType, string[]>>
  uninstallCommands?: Partial<Record<OSType, string[]>>
}

export interface DependencyStatus {
  name: string
  installed: boolean
  required: boolean
  description: string
}

export interface TapirConfig {
  setupCompleted: boolean
  lastCheckTimestamp: number
  os: OSType
}

// ============================================================================
// Config persistence
// ============================================================================

const CONFIG_DIR = join(homedir(), ".config", "tapir")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

export function loadConfig(): TapirConfig | null {
  try {
    if (!existsSync(CONFIG_FILE)) return null
    const raw = readFileSync(CONFIG_FILE, "utf-8")
    return JSON.parse(raw) as TapirConfig
  } catch {
    return null
  }
}

export function saveConfig(config: TapirConfig): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")
  } catch {
    // Silently fail - non-critical
  }
}

export function markSetupComplete(): void {
  const existing = loadConfig()
  saveConfig({
    setupCompleted: true,
    lastCheckTimestamp: Date.now(),
    os: existing?.os ?? detectOS(),
  })
}

export function isFirstRun(): boolean {
  const config = loadConfig()
  return config === null || !config.setupCompleted
}

// ============================================================================
// OS Detection
// ============================================================================

export function detectOS(): OSType {
  const p = platform()

  if (p === "darwin") return "macos"

  if (p === "win32") return "unsupported"

  if (p === "linux") {
    // Check for WSL
    try {
      const rel = release().toLowerCase()
      if (rel.includes("microsoft") || rel.includes("wsl")) return "windows_wsl"
    } catch { /* ignore */ }

    // Read /etc/os-release to detect distro
    try {
      if (existsSync("/etc/os-release")) {
        const osRelease = readFileSync("/etc/os-release", "utf-8").toLowerCase()
        if (osRelease.includes("ubuntu")) return "ubuntu"
        if (osRelease.includes("debian")) return "debian"
        if (osRelease.includes("fedora")) return "fedora"
        if (osRelease.includes("arch")) return "arch"
        if (osRelease.includes("opensuse") || osRelease.includes("suse")) return "opensuse"
        if (osRelease.includes("alpine")) return "alpine"
      }
    } catch { /* ignore */ }

    return "linux_unknown"
  }

  return "unsupported"
}

export function osDisplayName(os: OSType): string {
  const names: Record<OSType, string> = {
    macos: "macOS",
    ubuntu: "Ubuntu/Debian",
    debian: "Debian",
    fedora: "Fedora/RHEL",
    arch: "Arch Linux",
    opensuse: "openSUSE",
    alpine: "Alpine Linux",
    linux_unknown: "Linux",
    windows_wsl: "Windows (WSL)",
    unsupported: "Unsupported OS",
  }
  return names[os]
}

// ============================================================================
// Dependency definitions
// ============================================================================

async function checkCmd(cmd: string, args: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn([cmd, ...args], { stdout: "ignore", stderr: "ignore" })
    const code = await proc.exited
    return code === 0
  } catch {
    return false
  }
}

async function checkPython(): Promise<boolean> {
  return (await checkCmd("python3", ["--version"])) || (await checkCmd("python", ["--version"]))
}

async function checkYtDlp(): Promise<boolean> {
  return checkCmd("yt-dlp", ["--version"])
}

async function checkFfmpeg(): Promise<boolean> {
  return checkCmd("ffmpeg", ["-version"])
}

async function checkWhisper(): Promise<boolean> {
  if (await checkCmd("whisper", ["--help"])) return true
  // Fallback: check Python module
  try {
    const proc = Bun.spawn(["python3", "-c", "import whisper; print('ok')"], {
      stdout: "ignore",
      stderr: "ignore",
    })
    return (await proc.exited) === 0
  } catch {
    return false
  }
}

async function checkPip(): Promise<boolean> {
  return (await checkCmd("pip3", ["--version"])) || (await checkCmd("pip", ["--version"]))
}

export function getDependencies(): DependencyInfo[] {
  return [
    {
      name: "python3",
      description: "Python runtime (needed for yt-dlp and whisper)",
      required: true,
      checkFn: checkPython,
      installCommands: {
        macos: ["brew install python3"],
        ubuntu: ["sudo apt update && sudo apt install -y python3 python3-pip"],
        debian: ["sudo apt update && sudo apt install -y python3 python3-pip"],
        fedora: ["sudo dnf install -y python3 python3-pip"],
        arch: ["sudo pacman -S --noconfirm python python-pip"],
        opensuse: ["sudo zypper install -y python3 python3-pip"],
        alpine: ["sudo apk add python3 py3-pip"],
        linux_unknown: ["# Install python3 using your package manager"],
        windows_wsl: ["sudo apt update && sudo apt install -y python3 python3-pip"],
      },
    },
    {
      name: "pip",
      description: "Python package installer",
      required: true,
      checkFn: checkPip,
      installCommands: {
        macos: ["python3 -m ensurepip --upgrade"],
        ubuntu: ["sudo apt install -y python3-pip"],
        debian: ["sudo apt install -y python3-pip"],
        fedora: ["sudo dnf install -y python3-pip"],
        arch: ["sudo pacman -S --noconfirm python-pip"],
        opensuse: ["sudo zypper install -y python3-pip"],
        alpine: ["sudo apk add py3-pip"],
        linux_unknown: ["python3 -m ensurepip --upgrade"],
        windows_wsl: ["sudo apt install -y python3-pip"],
      },
    },
    {
      name: "yt-dlp",
      description: "Video/audio downloader supporting 1800+ sites",
      required: true,
      checkFn: checkYtDlp,
      installCommands: {
        macos: ["brew install yt-dlp", "pip3 install yt-dlp"],
        ubuntu: ["pip3 install yt-dlp"],
        debian: ["pip3 install yt-dlp"],
        fedora: ["pip3 install yt-dlp"],
        arch: ["sudo pacman -S --noconfirm yt-dlp", "pip3 install yt-dlp"],
        opensuse: ["pip3 install yt-dlp"],
        alpine: ["pip3 install yt-dlp"],
        linux_unknown: ["pip3 install yt-dlp"],
        windows_wsl: ["pip3 install yt-dlp"],
      },
      uninstallCommands: {
        macos: ["brew uninstall yt-dlp || pip3 uninstall -y yt-dlp"],
        ubuntu: ["pip3 uninstall -y yt-dlp"],
        debian: ["pip3 uninstall -y yt-dlp"],
        fedora: ["pip3 uninstall -y yt-dlp"],
        arch: ["sudo pacman -R --noconfirm yt-dlp || pip3 uninstall -y yt-dlp"],
        opensuse: ["pip3 uninstall -y yt-dlp"],
        alpine: ["pip3 uninstall -y yt-dlp"],
        linux_unknown: ["pip3 uninstall -y yt-dlp"],
        windows_wsl: ["pip3 uninstall -y yt-dlp"],
      },
    },
    {
      name: "ffmpeg",
      description: "Audio/video processing (conversion, merging, MP3 extraction)",
      required: false,
      checkFn: checkFfmpeg,
      installCommands: {
        macos: ["brew install ffmpeg"],
        ubuntu: ["sudo apt update && sudo apt install -y ffmpeg"],
        debian: ["sudo apt update && sudo apt install -y ffmpeg"],
        fedora: ["sudo dnf install -y ffmpeg"],
        arch: ["sudo pacman -S --noconfirm ffmpeg"],
        opensuse: ["sudo zypper install -y ffmpeg"],
        alpine: ["sudo apk add ffmpeg"],
        linux_unknown: ["# Install ffmpeg using your package manager"],
        windows_wsl: ["sudo apt update && sudo apt install -y ffmpeg"],
      },
      uninstallCommands: {
        macos: ["brew uninstall ffmpeg"],
        ubuntu: ["sudo apt remove -y ffmpeg && sudo apt autoremove -y"],
        debian: ["sudo apt remove -y ffmpeg && sudo apt autoremove -y"],
        fedora: ["sudo dnf remove -y ffmpeg"],
        arch: ["sudo pacman -R --noconfirm ffmpeg"],
        opensuse: ["sudo zypper remove -y ffmpeg"],
        alpine: ["sudo apk del ffmpeg"],
        linux_unknown: ["# Remove ffmpeg using your package manager"],
        windows_wsl: ["sudo apt remove -y ffmpeg && sudo apt autoremove -y"],
      },
    },
    {
      name: "whisper",
      description: "OpenAI Whisper for speech-to-text transcription",
      required: false,
      checkFn: checkWhisper,
      installCommands: {
        macos: ["pip3 install openai-whisper"],
        ubuntu: ["pip3 install openai-whisper"],
        debian: ["pip3 install openai-whisper"],
        fedora: ["pip3 install openai-whisper"],
        arch: ["pip3 install openai-whisper"],
        opensuse: ["pip3 install openai-whisper"],
        alpine: ["pip3 install openai-whisper"],
        linux_unknown: ["pip3 install openai-whisper"],
        windows_wsl: ["pip3 install openai-whisper"],
      },
      uninstallCommands: {
        macos: ["pip3 uninstall -y openai-whisper"],
        ubuntu: ["pip3 uninstall -y openai-whisper"],
        debian: ["pip3 uninstall -y openai-whisper"],
        fedora: ["pip3 uninstall -y openai-whisper"],
        arch: ["pip3 uninstall -y openai-whisper"],
        opensuse: ["pip3 uninstall -y openai-whisper"],
        alpine: ["pip3 uninstall -y openai-whisper"],
        linux_unknown: ["pip3 uninstall -y openai-whisper"],
        windows_wsl: ["pip3 uninstall -y openai-whisper"],
      },
    },
  ]
}

// ============================================================================
// Check all dependencies at once
// ============================================================================

export async function checkAllDependencies(): Promise<DependencyStatus[]> {
  const deps = getDependencies()
  const results = await Promise.all(
    deps.map(async (dep) => ({
      name: dep.name,
      installed: await dep.checkFn(),
      required: dep.required,
      description: dep.description,
    })),
  )
  return results
}

// ============================================================================
// Install a single dependency
// ============================================================================

export async function installDependency(
  depName: string,
  os: OSType,
): Promise<{ success: boolean; output: string }> {
  const dep = getDependencies().find((d) => d.name === depName)
  if (!dep) return { success: false, output: `Unknown dependency: ${depName}` }

  const commands = dep.installCommands[os] ?? dep.installCommands.linux_unknown
  if (!commands || commands.length === 0) {
    return { success: false, output: `No install command available for ${osDisplayName(os)}` }
  }

  // Try each command in order until one succeeds
  for (const cmd of commands) {
    // Skip comment-only commands
    if (cmd.startsWith("#")) continue

    try {
      const proc = Bun.spawn(["sh", "-c", cmd], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const exitCode = await proc.exited
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      if (exitCode === 0) {
        return { success: true, output: stdout || "Installed successfully" }
      }
      // If this command failed, try the next one
      if (commands.indexOf(cmd) === commands.length - 1) {
        return { success: false, output: stderr || stdout || `Command failed with exit code ${exitCode}` }
      }
    } catch (err: any) {
      if (commands.indexOf(cmd) === commands.length - 1) {
        return { success: false, output: err.message || "Installation failed" }
      }
    }
  }

  return { success: false, output: "All install methods failed" }
}

// ============================================================================
// Uninstall a single dependency
// ============================================================================

export async function uninstallDependency(
  depName: string,
  os: OSType,
): Promise<{ success: boolean; output: string }> {
  const dep = getDependencies().find((d) => d.name === depName)
  if (!dep) return { success: false, output: `Unknown dependency: ${depName}` }

  const commands = dep.uninstallCommands?.[os] ?? dep.uninstallCommands?.linux_unknown
  if (!commands || commands.length === 0) {
    return { success: false, output: `No uninstall command available for ${osDisplayName(os)}` }
  }

  for (const cmd of commands) {
    if (cmd.startsWith("#")) continue

    try {
      const proc = Bun.spawn(["sh", "-c", cmd], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const exitCode = await proc.exited
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()

      if (exitCode === 0) {
        return { success: true, output: stdout || "Uninstalled successfully" }
      }
      if (commands.indexOf(cmd) === commands.length - 1) {
        return { success: false, output: stderr || stdout || `Command failed with exit code ${exitCode}` }
      }
    } catch (err: any) {
      if (commands.indexOf(cmd) === commands.length - 1) {
        return { success: false, output: err.message || "Uninstall failed" }
      }
    }
  }

  return { success: false, output: "All uninstall methods failed" }
}

// ============================================================================
// Remove Tapir config, settings, and plugins
// ============================================================================

export function getConfigDir(): string {
  return CONFIG_DIR
}

export function cleanupTapirConfig(): { removed: string[]; errors: string[] } {
  const { rmSync } = require("fs")
  const removed: string[] = []
  const errors: string[] = []

  // Remove config directory (~/.config/tapir/)
  try {
    if (existsSync(CONFIG_DIR)) {
      rmSync(CONFIG_DIR, { recursive: true, force: true })
      removed.push(CONFIG_DIR)
    }
  } catch (err: any) {
    errors.push(`Failed to remove ${CONFIG_DIR}: ${err.message}`)
  }

  // Remove whisper model cache (~/.cache/whisper/)
  const whisperCache = join(homedir(), ".cache", "whisper")
  try {
    if (existsSync(whisperCache)) {
      rmSync(whisperCache, { recursive: true, force: true })
      removed.push(whisperCache)
    }
  } catch (err: any) {
    errors.push(`Failed to remove ${whisperCache}: ${err.message}`)
  }

  return { removed, errors }
}
