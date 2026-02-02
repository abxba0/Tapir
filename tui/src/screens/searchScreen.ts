/**
 * Search Screen - Search YouTube directly from the TUI
 *
 * Steps:
 *   1. Enter search query
 *   2. Display results
 *   3. Select a result to download
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
import { searchYouTube } from "../services/downloader"
import { formatDuration, formatCount } from "../utils"
import type { SearchResult } from "../types"

export interface SearchScreenResult {
  action: "download" | "back"
  url?: string
}

type Phase = "query_input" | "searching" | "results" | "no_results"

let renderer: CliRenderer | null = null
let headerBox: BoxRenderable | null = null
let header: TextRenderable | null = null
let contentBox: BoxRenderable | null = null
let footerBox: BoxRenderable | null = null
let footer: TextRenderable | null = null
let statusText: TextRenderable | null = null
let queryInputBox: BoxRenderable | null = null
let queryInput: InputRenderable | null = null
let resultSelect: SelectRenderable | null = null
let resultSelectBox: BoxRenderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let resolveScreen: ((result: SearchScreenResult) => void) | null = null
let currentPhase: Phase = "query_input"
let currentResults: SearchResult[] = []

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
      id: "sr-status",
      content: message,
      fg: color,
      bg: "transparent",
      flexGrow: 0,
      flexShrink: 0,
    })
    contentBox.add(statusText)
  }
}

function clearDynamicContent() {
  if (!contentBox) return

  if (queryInput) { queryInput.destroy(); queryInput = null }
  if (queryInputBox) { contentBox.remove(queryInputBox.id); queryInputBox = null }
  if (resultSelect) { resultSelect.destroy(); resultSelect = null }
  if (resultSelectBox) { contentBox.remove(resultSelectBox.id); resultSelectBox = null }
}

// ============================================================================
// Phase: Query Input
// ============================================================================

function showQueryInput() {
  if (!renderer || !contentBox) return
  currentPhase = "query_input"

  setStatus(
    "Search YouTube for videos, music, and more.\n\nEnter your search query below:",
    colors.textCyan,
  )

  queryInputBox = new BoxRenderable(renderer, {
    id: "sr-query-box",
    width: "auto",
    height: 3,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.borderFocused,
    title: "Search Query",
    border: true,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 1,
    backgroundColor: "transparent",
  })

  queryInput = new InputRenderable(renderer, {
    id: "sr-query-input",
    width: "auto",
    placeholder: "e.g. lofi hip hop, cooking tutorial, piano lessons...",
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

  queryInput.on(InputRenderableEvents.ENTER, async () => {
    const query = queryInput?.value?.trim()
    if (query && query.length > 0) {
      await handleSearch(query)
    } else {
      setStatus("Please enter a search query.", colors.textRed)
    }
  })

  queryInputBox.add(queryInput)
  contentBox.add(queryInputBox)
  queryInput.focus()
  queryInputBox.focus()
}

// ============================================================================
// Phase: Search
// ============================================================================

async function handleSearch(query: string) {
  if (!renderer || !contentBox) return
  currentPhase = "searching"

  if (queryInput) queryInput.blur()

  setStatus(`Searching YouTube for: "${query}"...`, colors.textYellow)

  const results = await searchYouTube(query, 15)
  currentResults = results

  // Clean up query input
  if (queryInput) { queryInput.destroy(); queryInput = null }
  if (queryInputBox) { contentBox.remove(queryInputBox.id); queryInputBox = null }

  if (results.length === 0) {
    currentPhase = "no_results"
    setStatus(
      `No results found for "${query}".\n\nPress ESC to go back and try a different search.`,
      colors.textRed,
    )
    if (footer) footer.content = "ESC: Back to menu"
    return
  }

  showResults(query, results)
}

// ============================================================================
// Phase: Results
// ============================================================================

function showResults(query: string, results: SearchResult[]) {
  if (!renderer || !contentBox) return
  currentPhase = "results"

  setStatus(
    `Found ${results.length} results for "${query}"\n\nSelect a video to download:`,
    colors.textGreen,
  )

  const resultOptions: SelectOption[] = results.map((r) => {
    const dur = formatDuration(r.duration)
    const views = formatCount(r.viewCount)
    return {
      name: r.title,
      description: `${r.channel}  |  ${dur}  |  ${views} views`,
      value: r.url,
    }
  })

  // Add a "Search again" option at the end
  resultOptions.push({
    name: "Search again...",
    description: "Enter a new search query",
    value: "__search_again__",
  })

  resultSelectBox = new BoxRenderable(renderer, {
    id: "sr-result-box",
    width: "auto",
    height: "auto",
    minHeight: 10,
    borderStyle: "single",
    borderColor: colors.border,
    focusedBorderColor: colors.accent,
    title: "Search Results",
    titleAlignment: "center",
    flexGrow: 1,
    flexShrink: 1,
    marginTop: 1,
    backgroundColor: "transparent",
    border: true,
  })

  resultSelect = new SelectRenderable(renderer, {
    id: "sr-result-select",
    width: "auto",
    height: "auto",
    minHeight: 8,
    options: resultOptions,
    backgroundColor: colors.bgPanel,
    focusedBackgroundColor: colors.bgInput,
    textColor: colors.text,
    focusedTextColor: colors.textBright,
    selectedBackgroundColor: colors.accent,
    selectedTextColor: "#ffffff",
    descriptionColor: colors.textDim,
    selectedDescriptionColor: colors.textCyan,
    showScrollIndicator: true,
    wrapSelection: true,
    showDescription: true,
    flexGrow: 1,
    flexShrink: 1,
  })

  resultSelect.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    const val = option.value as string

    if (val === "__search_again__") {
      // Clean up and restart search
      clearDynamicContent()
      showQueryInput()
      return
    }

    // User selected a video - resolve with the URL for download
    if (resolveScreen) {
      resolveScreen({ action: "download", url: val })
      resolveScreen = null
    }
  })

  resultSelectBox.add(resultSelect)
  contentBox.add(resultSelectBox)
  resultSelect.focus()
  resultSelectBox.focus()

  if (footer) footer.content = "UP/DOWN: Navigate | ENTER: Select | ESC: Back to menu"
}

// ============================================================================
// Screen lifecycle
// ============================================================================

export function run(rendererInstance: CliRenderer): Promise<SearchScreenResult> {
  return new Promise((resolve) => {
    resolveScreen = resolve
    renderer = rendererInstance
    renderer.setBackgroundColor(colors.bg)

    // Reset state
    currentResults = []

    headerBox = new BoxRenderable(renderer, {
      id: "sr-header-box",
      width: "auto",
      height: layout.headerHeight,
      backgroundColor: colors.accentPurple,
      borderStyle: "single",
      borderColor: "#7c3aed",
      border: true,
      flexGrow: 0,
      flexShrink: 0,
    })

    header = new TextRenderable(renderer, {
      id: "sr-header",
      content: "YouTube Search",
      fg: "#ffffff",
      bg: "transparent",
      flexGrow: 1,
    })
    headerBox.add(header)

    contentBox = new BoxRenderable(renderer, {
      id: "sr-content",
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
      id: "sr-footer-box",
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
      id: "sr-footer",
      content: "ENTER: Search | ESC: Back to menu",
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
        if (resolveScreen) {
          resolveScreen({ action: "back" })
          resolveScreen = null
        }
      }
    }
    renderer.keyInput.on("keypress", keyHandler)

    showQueryInput()
  })
}

export function destroy(rendererInstance: CliRenderer): void {
  if (keyHandler) rendererInstance.keyInput.off("keypress", keyHandler)
  if (queryInput) queryInput.destroy()
  if (resultSelect) resultSelect.destroy()
  if (headerBox) rendererInstance.root.remove(headerBox.id)
  if (contentBox) rendererInstance.root.remove(contentBox.id)
  if (footerBox) rendererInstance.root.remove(footerBox.id)

  headerBox = null; header = null; contentBox = null; footerBox = null; footer = null
  statusText = null; queryInputBox = null; queryInput = null
  resultSelect = null; resultSelectBox = null
  keyHandler = null; renderer = null; resolveScreen = null
  currentPhase = "query_input"; currentResults = []
}
