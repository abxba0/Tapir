/**
 * Settings Screen - Configure Tapir defaults
 *
 * Lets users change:
 *   - Default output directory
 *   - Preferred download format
 *   - Subtitle language
 *   - Download subtitles by default
 *   - Whisper model size
 *   - REST API port
 *   - Auto-update checking
 */

import {
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  InputRenderableEvents,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core"
import type { SelectOption } from "@opentui/core"
import { colors, layout } from "../components/theme"
import { loadSettings, saveSettings, getSettingsPath, type UserSettings } from "../services/settings"

type Phase = "menu" | "editing"

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let statusText: TextRenderable | null = null
let settingSelect: SelectRenderable | null = null
let settingSelectBox: BoxRenderable | null = null
let editSelect: SelectRenderable | null = null
let editSelectBox: BoxRenderable | null = null
let editInput: InputRenderable | null = null
let editInputBox: BoxRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: (() => void) | null = null
let currentPhase: Phase = "menu"
let currentSettings: UserSettings = loadSettings()

// ============================================================================
// Helpers
// ============================================================================

function setStatus(message: string, color: string = colors.text) {
  if (!renderer || !contentBox) return

  if (statusText) {
    statusText.content = message
    statusText.fg = color
  } else {
    statusText = new TextRenderable(renderer, {
      id: "set-status",
      content: message,
      fg: color,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(statusText)
  }
}

function clearEditors() {
  if (!contentBox) return
  if (editSelect) { editSelect.destroy(); editSelect = null }
  if (editSelectBox) { contentBox.remove(editSelectBox.id); editSelectBox = null }
  if (editInput) { editInput.destroy(); editInput = null }
  if (editInputBox) { contentBox.remove(editInputBox.id); editInputBox = null }
}

// ============================================================================
// Build settings menu options with current values
// ============================================================================

function buildMenuOptions(): SelectOption[] {
  return [
    {
      name: `Output Directory: ${currentSettings.outputDir}`,
      description: "Default directory for downloaded files",
      value: "outputDir",
    },
    {
      name: `Preferred Format: ${currentSettings.preferredFormat}`,
      description: "Default download format (best, mp4, mp3, high, bestvideo, bestaudio)",
      value: "preferredFormat",
    },
    {
      name: `Download Subtitles: ${currentSettings.downloadSubs ? "Yes" : "No"}`,
      description: "Automatically download subtitles with videos",
      value: "downloadSubs",
    },
    {
      name: `Subtitle Language: ${currentSettings.subtitleLang}`,
      description: "Default subtitle language code (e.g. en, es, fr, ja)",
      value: "subtitleLang",
    },
    {
      name: `Whisper Model: ${currentSettings.whisperModel}`,
      description: "Default Whisper model for transcription (tiny, base, small, medium, large)",
      value: "whisperModel",
    },
    {
      name: `API Port: ${currentSettings.apiPort}`,
      description: "Port for the REST API server (--server mode)",
      value: "apiPort",
    },
    {
      name: `Auto-check Updates: ${currentSettings.autoCheckUpdates ? "Yes" : "No"}`,
      description: "Check for yt-dlp updates on startup",
      value: "autoCheckUpdates",
    },
    {
      name: "Reset to Defaults",
      description: "Restore all settings to their default values",
      value: "__reset__",
    },
    {
      name: "Back to Main Menu",
      description: `Settings saved to ${getSettingsPath()}`,
      value: "__back__",
    },
  ]
}

// ============================================================================
// Settings menu
// ============================================================================

function showSettingsMenu() {
  if (!renderer || !contentBox) return
  currentPhase = "menu"

  clearEditors()

  // Remove old select if exists
  if (settingSelect) { settingSelect.destroy(); settingSelect = null }
  if (settingSelectBox) { contentBox.remove(settingSelectBox.id); settingSelectBox = null }

  setStatus("Configure Tapir defaults. Changes are saved automatically.", colors.textCyan)

  settingSelectBox = new BoxRenderable(renderer, {
    id: "set-menu-box",
    width: "auto",
    height: "auto",
    minHeight: 10,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentYellow,
    title: "Settings",
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  settingSelect = new SelectRenderable(renderer, {
    id: "set-menu-select",
    width: "auto",
    height: "auto",
    minHeight: 8,
    options: buildMenuOptions(),
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accentYellow,
    selectedTextColor: "#000000",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textYellow,
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 1,
    flexShrink: 1,
  })

  settingSelect.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    const key = option.value as string

    if (key === "__back__") {
      if (resolveScreen) { resolveScreen(); resolveScreen = null }
      return
    }

    if (key === "__reset__") {
      const { getDefaultSettings } = require("../services/settings")
      currentSettings = getDefaultSettings()
      saveSettings(currentSettings)
      setStatus("All settings reset to defaults.", colors.textGreen)
      showSettingsMenu()
      return
    }

    handleEditSetting(key as keyof UserSettings)
  })

  settingSelectBox.add(settingSelect)
  contentBox.add(settingSelectBox)
  settingSelect.focus()
  settingSelectBox.focus()

  if (footer) footer.content = "ENTER: Edit setting | ESC: Back to menu"
}

// ============================================================================
// Edit a setting
// ============================================================================

function handleEditSetting(key: keyof UserSettings) {
  if (!renderer || !contentBox) return
  currentPhase = "editing"

  // Toggle boolean values immediately
  if (key === "downloadSubs" || key === "autoCheckUpdates") {
    currentSettings[key] = !currentSettings[key]
    saveSettings(currentSettings)
    setStatus(`${key === "downloadSubs" ? "Download Subtitles" : "Auto-check Updates"} set to ${currentSettings[key] ? "Yes" : "No"}`, colors.textGreen)
    showSettingsMenu()
    return
  }

  // Options-based settings use a select
  if (key === "preferredFormat") {
    showSelectEditor(key, "Download Format", [
      { name: "Best Quality", description: "Best combined video+audio", value: "best" },
      { name: "MP4", description: "Download as MP4 video", value: "mp4" },
      { name: "MP3", description: "Extract audio as MP3", value: "mp3" },
      { name: "High Quality", description: "Best video + best audio merged", value: "high" },
      { name: "Best Video Only", description: "Highest resolution video stream", value: "bestvideo" },
      { name: "Best Audio Only", description: "Highest quality audio stream", value: "bestaudio" },
    ])
    return
  }

  if (key === "whisperModel") {
    showSelectEditor(key, "Whisper Model", [
      { name: "Tiny", description: "Fastest, lowest accuracy (~1GB VRAM)", value: "tiny" },
      { name: "Base", description: "Fast with decent accuracy (~1GB VRAM)", value: "base" },
      { name: "Small", description: "Good balance of speed & accuracy (~2GB VRAM)", value: "small" },
      { name: "Medium", description: "High accuracy, slower (~5GB VRAM)", value: "medium" },
      { name: "Large", description: "Best accuracy, slowest (~10GB VRAM)", value: "large" },
    ])
    return
  }

  // Text/number-based settings use an input
  const labels: Record<string, string> = {
    outputDir: "Output Directory",
    subtitleLang: "Subtitle Language",
    apiPort: "API Port",
  }
  const placeholders: Record<string, string> = {
    outputDir: "e.g. youtube_downloads, /home/user/videos, ~/Downloads",
    subtitleLang: "e.g. en, es, fr, ja, en.*,en (comma-separated)",
    apiPort: "e.g. 8384",
  }

  showInputEditor(key, labels[key] || key, placeholders[key] || "", String(currentSettings[key]))
}

function showSelectEditor(key: keyof UserSettings, title: string, options: SelectOption[]) {
  if (!renderer || !contentBox) return

  // Hide the settings menu
  if (settingSelect) { settingSelect.destroy(); settingSelect = null }
  if (settingSelectBox) { contentBox.remove(settingSelectBox.id); settingSelectBox = null }

  setStatus(`Select new value for ${title}:`, colors.textYellow)

  editSelectBox = new BoxRenderable(renderer, {
    id: "set-edit-select-box",
    width: "auto",
    height: "auto",
    minHeight: 6,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentYellow,
    title,
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  editSelect = new SelectRenderable(renderer, {
    id: "set-edit-select",
    width: "auto",
    height: "auto",
    minHeight: 5,
    options,
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accentYellow,
    selectedTextColor: "#000000",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textYellow,
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 1,
    flexShrink: 1,
  })

  editSelect.on(SelectRenderableEvents.ITEM_SELECTED, (_idx: number, option: SelectOption) => {
    ;(currentSettings as any)[key] = option.value as string
    saveSettings(currentSettings)
    setStatus(`${title} set to: ${option.value}`, colors.textGreen)
    clearEditors()
    showSettingsMenu()
  })

  editSelectBox.add(editSelect)
  contentBox.add(editSelectBox)
  editSelect.focus()
  editSelectBox.focus()

  if (footer) footer.content = "ENTER: Select | ESC: Cancel"
}

function showInputEditor(key: keyof UserSettings, title: string, placeholder: string, currentValue: string) {
  if (!renderer || !contentBox) return

  // Hide the settings menu
  if (settingSelect) { settingSelect.destroy(); settingSelect = null }
  if (settingSelectBox) { contentBox.remove(settingSelectBox.id); settingSelectBox = null }

  setStatus(`Enter new value for ${title} (current: ${currentValue}):`, colors.textYellow)

  editInputBox = new BoxRenderable(renderer, {
    id: "set-edit-input-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accentYellow,
    title,
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  editInput = new InputRenderable(renderer, {
    id: "set-edit-input",
    width: "auto",
    placeholder,
    backgroundColor: colors.bgInput,
    focusedBackgroundColor: colors.bgInputFocused,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    placeholderColor: colors.textDim,
    cursorColor: colors.textBright,
    maxLength: 200,
    flexGrow: 1,
    flexShrink: 1,
  })

  editInput.on(InputRenderableEvents.ENTER, () => {
    const val = editInput?.value?.trim()
    if (val) {
      if (key === "apiPort") {
        const num = parseInt(val)
        if (isNaN(num) || num < 1 || num > 65535) {
          setStatus("Invalid port number. Must be 1-65535.", colors.textRed)
          return
        }
        currentSettings.apiPort = num
      } else {
        ;(currentSettings as any)[key] = val
      }
      saveSettings(currentSettings)
      setStatus(`${title} set to: ${val}`, colors.textGreen)
    }
    clearEditors()
    showSettingsMenu()
  })

  editInputBox.add(editInput)
  contentBox.add(editInputBox)
  editInput.focus()
  editInputBox.focus()

  if (footer) footer.content = "ENTER: Save | ESC: Cancel"
}

// ============================================================================
// Screen lifecycle
// ============================================================================

export function run(rendererInstance: CliRenderer): Promise<void> {
  return new Promise((resolve) => {
    resolveScreen = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    currentSettings = loadSettings()

    headerBox = new BoxRenderable(renderer, {
      id: "set-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: colors.accentYellow,
      borderStyle: "single",
      borderColor: "#ca8a04",
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    header = new TextRenderable(renderer, {
      id: "set-header",
      content: "Settings",
      fg: "#000000",
      bg: "transparent",
      flexGrow: 1,
    })
    headerBox.add(header)

    contentBox = new BoxRenderable(renderer, {
      id: "set-content",
      width: "auto",
      height: "auto",
      flexGrow: 1,
      flexShrink: 1,
      backgroundColor: colors.bgPanel,
      borderStyle: "single",
      borderColor: colors.border,
      border: true,
      flexDirection: "column",
    })

    footerBox = new BoxRenderable(renderer, {
      id: "set-footer-box",
      width: "auto",
      height: layout.footerHeight,
      backgroundColor: colors.footerBg,
      borderStyle: "single",
      borderColor: colors.footerBorder,
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    footer = new TextRenderable(renderer, {
      id: "set-footer",
      content: "ENTER: Edit setting | ESC: Back to menu",
      fg: colors.textDim,
      bg: "transparent",
      flexGrow: 1,
    })
    footerBox.add(footer)

    renderer.root.add(headerBox)
    renderer.root.add(contentBox)
    renderer.root.add(footerBox)

    keyHandler = (key: KeyEvent) => {
      if (key.name === "escape") {
        if (currentPhase === "editing") {
          clearEditors()
          showSettingsMenu()
        } else {
          if (resolveScreen) { resolveScreen(); resolveScreen = null }
        }
      }
    }
    renderer.keyInput.on("keypress", keyHandler)

    showSettingsMenu()
  })
}

export function destroy(rendererInstance: CliRenderer): void {
  if (keyHandler) rendererInstance.keyInput.off("keypress", keyHandler)
  if (settingSelect) settingSelect.destroy()
  if (editSelect) editSelect.destroy()
  if (editInput) editInput.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; settingSelect = null; settingSelectBox = null
  editSelect = null; editSelectBox = null; editInput = null; editInputBox = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "menu"
}
