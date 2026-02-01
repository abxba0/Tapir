/**
 * Setup Screen - First-run dependency checker and installer.
 *
 * Shows the user which dependencies are installed and which are missing.
 * Offers to install each missing dependency with OS-appropriate commands.
 * Persists completion state so it only appears on first launch (or when
 * revisited from the main menu).
 */

import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type SelectOption,
} from "@opentui/core"
import { colors, layout } from "../components/theme"
import { VERSION } from "../utils"
import {
  detectOS,
  osDisplayName,
  checkAllDependencies,
  installDependency,
  getDependencies,
  markSetupComplete,
  type OSType,
  type DependencyStatus,
} from "../services/setup"

// ============================================================================
// State
// ============================================================================

export interface SetupResult {
  action: "continue" | "exit"
  ytDlpInstalled: boolean
  ffmpegInstalled: boolean
  whisperAvailable: boolean
}

let rendererRef: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let actionSelect: SelectRenderable | null = null
let statusText: TextRenderable | null = null
let resolveResult: ((result: SetupResult) => void) | null = null

let currentOS: OSType = "linux_unknown"
let depStatuses: DependencyStatus[] = []

// ============================================================================
// Helpers
// ============================================================================

function statusIcon(installed: boolean): string {
  return installed ? "[OK]" : "[  ]"
}

function buildStatusContent(): string {
  const osLabel = osDisplayName(currentOS)
  const lines: string[] = [
    `Detected OS: ${osLabel}`,
    "",
    "Dependency Status:",
    "-------------------------------------------",
  ]

  for (const dep of depStatuses) {
    const icon = statusIcon(dep.installed)
    const tag = dep.required ? "(required)" : "(optional)"
    const state = dep.installed ? "Installed" : "Missing"
    lines.push(`  ${icon}  ${dep.name.padEnd(10)} ${state.padEnd(12)} ${tag}`)
    lines.push(`         ${dep.description}`)
  }

  const allRequiredOk = depStatuses
    .filter((d) => d.required)
    .every((d) => d.installed)

  lines.push("")
  if (allRequiredOk) {
    lines.push("All required dependencies are installed.")
  } else {
    lines.push("Some required dependencies are missing. Install them to use Tapir.")
  }

  return lines.join("\n")
}

function buildMenuOptions(): SelectOption[] {
  const options: SelectOption[] = []

  // Add install option for each missing dependency
  const missing = depStatuses.filter((d) => !d.installed)
  if (missing.length > 0) {
    options.push({
      name: "Install All Missing",
      description: `Install ${missing.length} missing package(s) automatically`,
      value: "install_all",
    })

    for (const dep of missing) {
      const tag = dep.required ? " (required)" : " (optional)"
      const depDef = getDependencies().find((d) => d.name === dep.name)
      const cmds = depDef?.installCommands[currentOS] ?? []
      const cmdHint = cmds.length > 0 ? cmds[0] : "no command available"
      options.push({
        name: `Install ${dep.name}${tag}`,
        description: cmdHint,
        value: `install:${dep.name}`,
      })
    }
  }

  options.push({
    name: "Re-check Dependencies",
    description: "Scan for installed packages again",
    value: "recheck",
  })

  options.push({
    name: "Continue to Tapir",
    description: "Proceed to the main menu",
    value: "continue",
  })

  options.push({
    name: "Exit",
    description: "Quit the application",
    value: "exit",
  })

  return options
}

// ============================================================================
// Screen lifecycle
// ============================================================================

export function run(rendererInstance: CliRenderer): Promise<SetupResult> {
  return new Promise(async (resolve) => {
    resolveResult = resolve
    rendererRef = rendererInstance
    rendererRef.setBackgroundColor(colors.bg)

    currentOS = detectOS()
    depStatuses = await checkAllDependencies()

    buildUI()
  })
}

function buildUI(): void {
  if (!rendererRef) return

  // Clean old UI if rebuilding
  destroyUI()

  // Header
  headerBox = new BoxRenderable(rendererRef, {
    id: "setup-header-box",
    width: "auto",
    height: layout.headerHeight,
    backgroundColor: colors.accentPurple,
    borderStyle: "single",
    borderColor: colors.accentPurple,
    border: true,
    flexGrow: 0,
    flexShrink: 0,
  })

  const headerText = new TextRenderable(rendererRef, {
    id: "setup-header-text",
    content: `Tapir Setup  v${VERSION}`,
    fg: colors.textBright,
    bg: "transparent",
    flexGrow: 1,
    flexShrink: 1,
  })
  headerBox.add(headerText)

  // Content
  contentBox = new BoxRenderable(rendererRef, {
    id: "setup-content",
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

  statusText = new TextRenderable(rendererRef, {
    id: "setup-status",
    content: buildStatusContent(),
    fg: colors.text,
    bg: "transparent",
    flexGrow: 0,
    flexShrink: 0,
  })
  contentBox.add(statusText)

  // Action menu
  const menuBox = new BoxRenderable(rendererRef, {
    id: "setup-menu-box",
    width: "auto",
    height: "auto",
    minHeight: 8,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.borderFocused,
    title: "Actions",
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: "transparent",
    border: true,
  })

  actionSelect = new SelectRenderable(rendererRef, {
    id: "setup-action-select",
    width: "auto",
    height: "auto",
    minHeight: 6,
    options: buildMenuOptions(),
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

  actionSelect.on(SelectRenderableEvents.ITEM_SELECTED, handleSelection)

  menuBox.add(actionSelect)
  contentBox.add(menuBox)

  // Footer
  footerBox = new BoxRenderable(rendererRef, {
    id: "setup-footer-box",
    width: "auto",
    height: layout.footerHeight,
    backgroundColor: colors.footerBg,
    borderStyle: "single",
    borderColor: colors.footerBorder,
    border: true,
    flexGrow: 0,
    flexShrink: 0,
  })

  const footerText = new TextRenderable(rendererRef, {
    id: "setup-footer-text",
    content: "UP/DOWN: Navigate | ENTER: Select | Q: Quit",
    fg: colors.textDim,
    bg: "transparent",
    flexGrow: 1,
    flexShrink: 1,
  })
  footerBox.add(footerText)

  // Assemble
  rendererRef.root.add(headerBox)
  rendererRef.root.add(contentBox)
  rendererRef.root.add(footerBox)

  actionSelect.focus()
}

async function handleSelection(_index: number, option: SelectOption): Promise<void> {
  const value = option.value as string

  if (value === "continue") {
    markSetupComplete()
    finishWithResult("continue")
    return
  }

  if (value === "exit") {
    finishWithResult("exit")
    return
  }

  if (value === "recheck") {
    await refreshStatus("Checking dependencies...")
    return
  }

  if (value === "install_all") {
    const missing = depStatuses.filter((d) => !d.installed)
    updateStatusLine("Installing packages... this may take a moment.")

    for (const dep of missing) {
      updateStatusLine(`Installing ${dep.name}...`)
      await installDependency(dep.name, currentOS)
    }

    await refreshStatus("Installation complete. Re-checking...")
    return
  }

  if (value.startsWith("install:")) {
    const depName = value.slice("install:".length)
    updateStatusLine(`Installing ${depName}...`)
    const result = await installDependency(depName, currentOS)

    if (result.success) {
      await refreshStatus(`${depName} installed successfully. Re-checking...`)
    } else {
      await refreshStatus(`Failed to install ${depName}. You may need to install it manually.`)
    }
    return
  }
}

function updateStatusLine(message: string): void {
  if (statusText && rendererRef) {
    (statusText as any).content = buildStatusContent() + `\n\n${message}`
  }
}

async function refreshStatus(message?: string): Promise<void> {
  depStatuses = await checkAllDependencies()
  // Rebuild the entire UI to reflect new state
  buildUI()
  if (message && statusText) {
    (statusText as any).content = buildStatusContent() + `\n\n${message}`
  }
}

function finishWithResult(action: "continue" | "exit"): void {
  const ytDlp = depStatuses.find((d) => d.name === "yt-dlp")?.installed ?? false
  const ffmpeg = depStatuses.find((d) => d.name === "ffmpeg")?.installed ?? false
  const whisper = depStatuses.find((d) => d.name === "whisper")?.installed ?? false

  if (resolveResult) {
    resolveResult({
      action,
      ytDlpInstalled: ytDlp,
      ffmpegInstalled: ffmpeg,
      whisperAvailable: whisper,
    })
    resolveResult = null
  }
}

// ============================================================================
// Cleanup
// ============================================================================

function destroyUI(): void {
  if (!rendererRef) return
  if (actionSelect) actionSelect.destroy()
  if (headerBox) try { rendererRef.root.remove(headerBox.id) } catch { /* ok */ }
  if (contentBox) try { rendererRef.root.remove(contentBox.id) } catch { /* ok */ }
  if (footerBox) try { rendererRef.root.remove(footerBox.id) } catch { /* ok */ }
  headerBox = null
  contentBox = null
  footerBox = null
  actionSelect = null
  statusText = null
}

export function destroy(rendererInstance: CliRenderer): void {
  destroyUI()
  rendererRef = null
  resolveResult = null
}
