/**
 * Uninstall Screen - Remove dependencies and Tapir data
 *
 * Lets users selectively remove:
 *   - Individual dependencies (yt-dlp, ffmpeg, whisper)
 *   - Tapir config, settings, and plugin data
 *   - Whisper model cache
 *
 * Shows a confirmation prompt before each destructive action.
 */

import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core"
import type { SelectOption } from "@opentui/core"
import { colors, layout } from "../components/theme"
import { VERSION } from "../utils"
import {
  detectOS,
  osDisplayName,
  checkAllDependencies,
  uninstallDependency,
  getDependencies,
  getConfigDir,
  cleanupTapirConfig,
  type OSType,
  type DependencyStatus,
} from "../services/setup"

type Phase = "menu" | "confirm"

export interface UninstallResult {
  action: "back" | "exit_app"
}

let rendererRef: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let statusText: TextRenderable | null = null
let actionSelect: SelectRenderable | null = null
let confirmSelect: SelectRenderable | null = null
let confirmBox: BoxRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveResult: ((result: UninstallResult) => void) | null = null

let currentOS: OSType = "linux_unknown"
let depStatuses: DependencyStatus[] = []
let currentPhase: Phase = "menu"
let pendingAction: string | null = null

// ============================================================================
// Helpers
// ============================================================================

function setStatus(message: string, color: string = colors.text) {
  if (!rendererRef || !contentBox) return

  if (statusText) {
    statusText.content = message
    statusText.fg = color
  } else {
    statusText = new TextRenderable(rendererRef, {
      id: "un-status",
      content: message,
      fg: color,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(statusText)
  }
}

function clearConfirm() {
  if (!contentBox) return
  if (confirmSelect) { confirmSelect.destroy(); confirmSelect = null }
  if (confirmBox) { contentBox.remove(confirmBox.id); confirmBox = null }
}

function buildStatusContent(): string {
  const osLabel = osDisplayName(currentOS)
  const lines: string[] = [
    `OS: ${osLabel}`,
    "",
    "Installed packages that can be removed:",
    "-------------------------------------------",
  ]

  const removable = depStatuses.filter((d) => d.installed && d.name !== "python3" && d.name !== "pip")
  if (removable.length === 0) {
    lines.push("  No removable packages detected.")
  } else {
    for (const dep of removable) {
      const tag = dep.required ? "(required for Tapir)" : "(optional)"
      lines.push(`  [OK]  ${dep.name.padEnd(10)} ${tag}`)
      lines.push(`         ${dep.description}`)
    }
  }

  lines.push("")
  lines.push(`Tapir config: ${getConfigDir()}`)

  return lines.join("\n")
}

function buildMenuOptions(): SelectOption[] {
  const options: SelectOption[] = []

  // Uninstall individual installed deps (skip python3 and pip - too risky)
  const removable = depStatuses.filter((d) => d.installed && d.name !== "python3" && d.name !== "pip")

  for (const dep of removable) {
    const depDef = getDependencies().find((d) => d.name === dep.name)
    const cmds = depDef?.uninstallCommands?.[currentOS] ?? []
    const cmdHint = cmds.length > 0 ? cmds[0] : "no command available"
    options.push({
      name: `Uninstall ${dep.name}`,
      description: cmdHint,
      value: `uninstall:${dep.name}`,
    })
  }

  if (removable.length > 1) {
    options.push({
      name: "Uninstall All Optional Packages",
      description: "Remove whisper, ffmpeg (keeps yt-dlp, python, pip)",
      value: "uninstall_optional",
    })
  }

  options.push({
    name: "Remove Tapir Config & Data",
    description: `Delete ${getConfigDir()} (settings, plugins, config)`,
    value: "cleanup_tapir",
  })

  options.push({
    name: "Full Uninstall (Everything)",
    description: "Remove all packages + Tapir config, then exit",
    value: "full_uninstall",
  })

  options.push({
    name: "Re-check Packages",
    description: "Scan which packages are still installed",
    value: "recheck",
  })

  options.push({
    name: "Back to Main Menu",
    description: "Return without removing anything",
    value: "back",
  })

  return options
}

// ============================================================================
// Confirmation prompt
// ============================================================================

function showConfirmation(message: string, action: string) {
  if (!rendererRef || !contentBox) return
  currentPhase = "confirm"
  pendingAction = action

  clearConfirm()

  setStatus(message, colors.textRed)

  confirmBox = new BoxRenderable(rendererRef, {
    id: "un-confirm-box",
    width: "auto",
    height: "auto",
    minHeight: 4,
    borderStyle: "single",
    borderColor: colors.borderError,
    focusedBorderColor: colors.bgError,
    title: "Confirm",
    titleAlignment: "center",
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  confirmSelect = new SelectRenderable(rendererRef, {
    id: "un-confirm-select",
    width: "auto",
    height: "auto",
    minHeight: 3,
    options: [
      { name: "Yes, proceed", description: "This cannot be undone", value: "yes" },
      { name: "No, cancel", description: "Go back without removing", value: "no" },
    ],
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.bgError,
    selectedTextColor: "#ffffff",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textRed,
    showScrollIndicator: false,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 0,
    flexShrink: 0,
  })

  confirmSelect.on(SelectRenderableEvents.ITEM_SELECTED, async (_idx: number, option: SelectOption) => {
    clearConfirm()

    if (option.value === "yes" && pendingAction) {
      await executeAction(pendingAction)
    } else {
      setStatus("Cancelled.", colors.textDim)
      currentPhase = "menu"
      if (actionSelect) {
        actionSelect.focus()
      }
    }

    pendingAction = null
  })

  confirmBox.add(confirmSelect)
  contentBox.add(confirmBox)
  confirmSelect.focus()
  confirmBox.focus()
}

// ============================================================================
// Execute uninstall actions
// ============================================================================

async function executeAction(action: string): Promise<void> {
  if (action.startsWith("uninstall:")) {
    const depName = action.slice("uninstall:".length)
    setStatus(`Uninstalling ${depName}...`, colors.textYellow)

    const result = await uninstallDependency(depName, currentOS)

    if (result.success) {
      setStatus(`${depName} uninstalled successfully.`, colors.textGreen)
    } else {
      setStatus(`Failed to uninstall ${depName}: ${result.output.slice(0, 150)}`, colors.textRed)
    }

    await refreshAndRebuild()
    return
  }

  if (action === "uninstall_optional") {
    const optional = depStatuses.filter(
      (d) => d.installed && !d.required && d.name !== "python3" && d.name !== "pip",
    )

    for (const dep of optional) {
      setStatus(`Uninstalling ${dep.name}...`, colors.textYellow)
      await uninstallDependency(dep.name, currentOS)
    }

    setStatus("Optional packages removed.", colors.textGreen)
    await refreshAndRebuild()
    return
  }

  if (action === "cleanup_tapir") {
    setStatus("Removing Tapir config and data...", colors.textYellow)
    const result = cleanupTapirConfig()

    if (result.removed.length > 0) {
      setStatus(
        `Removed:\n${result.removed.map((r) => `  - ${r}`).join("\n")}` +
          (result.errors.length > 0
            ? `\n\nErrors:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`
            : ""),
        result.errors.length > 0 ? colors.textYellow : colors.textGreen,
      )
    } else if (result.errors.length > 0) {
      setStatus(`Errors:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`, colors.textRed)
    } else {
      setStatus("No Tapir data found to remove.", colors.textDim)
    }

    currentPhase = "menu"
    if (actionSelect) actionSelect.focus()
    return
  }

  if (action === "full_uninstall") {
    // Remove all installed deps (except python3 and pip)
    const removable = depStatuses.filter(
      (d) => d.installed && d.name !== "python3" && d.name !== "pip",
    )

    for (const dep of removable) {
      setStatus(`Uninstalling ${dep.name}...`, colors.textYellow)
      await uninstallDependency(dep.name, currentOS)
    }

    // Clean up Tapir config
    setStatus("Removing Tapir config and data...", colors.textYellow)
    cleanupTapirConfig()

    setStatus(
      "Full uninstall complete.\n\n" +
        "Removed packages: " + removable.map((d) => d.name).join(", ") + "\n" +
        "Removed config: " + getConfigDir() + "\n\n" +
        "To remove the Tapir application directory itself, run:\n" +
        `  rm -rf ${process.cwd()}\n\n` +
        "Press ESC to exit.",
      colors.textGreen,
    )

    // Signal that the app should exit after this screen
    currentPhase = "menu"
    // Replace the menu with just an exit option
    rebuildExitOnly()
    return
  }
}

async function refreshAndRebuild() {
  depStatuses = await checkAllDependencies()
  buildUI()
}

function rebuildExitOnly() {
  if (!rendererRef || !contentBox) return

  if (actionSelect) { actionSelect.destroy(); actionSelect = null }

  const exitBox = new BoxRenderable(rendererRef, {
    id: "un-exit-box",
    width: "auto",
    height: "auto",
    minHeight: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.borderFocused,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  const exitSelect = new SelectRenderable(rendererRef, {
    id: "un-exit-select",
    width: "auto",
    height: "auto",
    minHeight: 2,
    options: [
      { name: "Exit Tapir", description: "Close the application", value: "exit_app" },
    ],
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accent,
    selectedTextColor: "#ffffff",
    descriptionColor: colors.textDim,
    showDescription: true,
    flexGrow: 0,
    flexShrink: 0,
  })

  exitSelect.on(SelectRenderableEvents.ITEM_SELECTED, () => {
    if (resolveResult) {
      resolveResult({ action: "exit_app" })
      resolveResult = null
    }
  })

  exitBox.add(exitSelect)
  contentBox.add(exitBox)
  exitSelect.focus()
  exitBox.focus()
}

// ============================================================================
// Build UI
// ============================================================================

function buildUI(): void {
  if (!rendererRef) return

  destroyUI()

  // Header
  headerBox = new BoxRenderable(rendererRef, {
    id: "un-header-box",
    width: "auto",
    height: layout.headerHeight,
    backgroundColor: "#b91c1c",
    borderStyle: "single",
    borderColor: "#991b1b",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
  })

  const headerText = new TextRenderable(rendererRef, {
    id: "un-header-text",
    content: `Uninstall  v${VERSION}`,
    fg: colors.textBright,
    bg: "transparent",
    flexGrow: 1,
    flexShrink: 1,
  })
  headerBox.add(headerText)

  // Content
  contentBox = new BoxRenderable(rendererRef, {
    id: "un-content",
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
    id: "un-status",
    content: buildStatusContent(),
    fg: colors.text,
    bg: "transparent",
    flexGrow: 0,
    flexShrink: 0,
  })
  contentBox.add(statusText)

  // Action menu
  const menuBox = new BoxRenderable(rendererRef, {
    id: "un-menu-box",
    width: "auto",
    height: "auto",
    minHeight: 8,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.borderError,
    title: "Uninstall Options",
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    backgroundColor: "transparent",
    border: true,
  })

  actionSelect = new SelectRenderable(rendererRef, {
    id: "un-action-select",
    width: "auto",
    height: "auto",
    minHeight: 6,
    options: buildMenuOptions(),
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.bgError,
    selectedTextColor: "#ffffff",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textRed,
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
    id: "un-footer-box",
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
    id: "un-footer-text",
    content: "ENTER: Select | ESC: Back to main menu",
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

// ============================================================================
// Selection handler
// ============================================================================

async function handleSelection(_index: number, option: SelectOption): Promise<void> {
  const value = option.value as string

  if (value === "back") {
    if (resolveResult) {
      resolveResult({ action: "back" })
      resolveResult = null
    }
    return
  }

  if (value === "recheck") {
    setStatus("Checking packages...", colors.textYellow)
    await refreshAndRebuild()
    return
  }

  // Everything else gets a confirmation prompt
  if (value.startsWith("uninstall:")) {
    const depName = value.slice("uninstall:".length)
    showConfirmation(
      `Are you sure you want to uninstall ${depName}?\n\nThis will remove the package from your system.`,
      value,
    )
    return
  }

  if (value === "uninstall_optional") {
    const optional = depStatuses.filter(
      (d) => d.installed && !d.required && d.name !== "python3" && d.name !== "pip",
    )
    const names = optional.map((d) => d.name).join(", ")
    showConfirmation(
      `Are you sure you want to uninstall all optional packages?\n\nThis will remove: ${names}`,
      value,
    )
    return
  }

  if (value === "cleanup_tapir") {
    showConfirmation(
      `Are you sure you want to remove all Tapir data?\n\nThis will delete:\n  - ${getConfigDir()} (config, settings, plugins)\n  - ~/.cache/huggingface/ (model cache)`,
      value,
    )
    return
  }

  if (value === "full_uninstall") {
    const removable = depStatuses.filter(
      (d) => d.installed && d.name !== "python3" && d.name !== "pip",
    )
    const names = removable.map((d) => d.name).join(", ")
    showConfirmation(
      `FULL UNINSTALL\n\nThis will remove:\n  - Packages: ${names || "none"}\n  - Config: ${getConfigDir()}\n  - Cache: ~/.cache/huggingface/\n\nAre you sure?`,
      value,
    )
    return
  }
}

// ============================================================================
// Screen lifecycle
// ============================================================================

export function run(rendererInstance: CliRenderer): Promise<UninstallResult> {
  return new Promise(async (resolve) => {
    resolveResult = resolve
    rendererRef = rendererInstance
    rendererRef.setBackgroundColor(colors.bg)

    currentOS = detectOS()
    currentPhase = "menu"
    depStatuses = await checkAllDependencies()

    keyHandler = (key: KeyEvent) => {
      if (key.name === "escape") {
        if (currentPhase === "confirm") {
          clearConfirm()
          currentPhase = "menu"
          if (actionSelect) actionSelect.focus()
        } else {
          if (resolveResult) {
            resolveResult({ action: "back" })
            resolveResult = null
          }
        }
      }
    }
    rendererRef.keyInput.on("keypress", keyHandler)

    buildUI()
  })
}

// ============================================================================
// Cleanup
// ============================================================================

function destroyUI(): void {
  if (!rendererRef) return
  if (actionSelect) actionSelect.destroy()
  if (confirmSelect) confirmSelect.destroy()
  if (headerBox) try { rendererRef.root.remove(headerBox.id) } catch { /* ok */ }
  if (contentBox) try { rendererRef.root.remove(contentBox.id) } catch { /* ok */ }
  if (footerBox) try { rendererRef.root.remove(footerBox.id) } catch { /* ok */ }
  headerBox = null
  contentBox = null
  footerBox = null
  actionSelect = null
  confirmSelect = null
  confirmBox = null
  statusText = null
}

export function destroy(rendererInstance: CliRenderer): void {
  if (keyHandler) rendererInstance.keyInput.off("keypress", keyHandler)
  destroyUI()
  rendererRef = null
  resolveResult = null
  keyHandler = null
  currentPhase = "menu"
  pendingAction = null
}
