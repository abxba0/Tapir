/**
 * Plugin system - Let users drop scripts into ~/.config/tapir/plugins/
 * that hook into lifecycle events.
 *
 * Directory structure:
 *   ~/.config/tapir/plugins/
 *     post-download/       Runs after a video/audio download completes
 *     post-convert/        Runs after an audio conversion completes
 *     post-transcribe/     Runs after a transcription completes
 *
 * Supported script types: .sh, .js, .ts, .py
 *
 * Each plugin receives context via environment variables:
 *   TAPIR_HOOK          - The hook name (post-download, post-convert, post-transcribe)
 *   TAPIR_FILE          - Path to the output file
 *   TAPIR_TITLE         - Media title (if available)
 *   TAPIR_URL           - Source URL (if available)
 *   TAPIR_FORMAT        - Output format (mp4, mp3, etc.)
 *   TAPIR_OUTPUT_DIR    - Output directory path
 *   TAPIR_SUCCESS       - "true" or "false"
 *
 * Additionally, full context is passed as JSON on stdin for .js/.ts/.py scripts.
 */

import { existsSync, mkdirSync, readdirSync, statSync, chmodSync } from "fs"
import { homedir } from "os"
import { join, extname } from "path"

// ============================================================================
// Types
// ============================================================================

export type PluginHook = "post-download" | "post-convert" | "post-transcribe"

export interface PluginContext {
  hook: PluginHook
  file?: string
  title?: string
  url?: string
  format?: string
  outputDir?: string
  success: boolean
  metadata?: Record<string, unknown>
}

export interface PluginInfo {
  name: string
  path: string
  hook: PluginHook
  ext: string
}

export interface PluginResult {
  plugin: string
  success: boolean
  output: string
  error?: string
  durationMs: number
}

// ============================================================================
// Constants
// ============================================================================

const PLUGINS_DIR = join(homedir(), ".config", "tapir", "plugins")
const VALID_EXTENSIONS = [".sh", ".js", ".ts", ".py"]
const PLUGIN_TIMEOUT = 30_000 // 30 seconds per plugin
const HOOK_DIRS: PluginHook[] = ["post-download", "post-convert", "post-transcribe"]

// ============================================================================
// Directory management
// ============================================================================

/**
 * Ensure the plugin directories exist.
 */
export function ensurePluginDirs(): void {
  try {
    mkdirSync(PLUGINS_DIR, { recursive: true })
    for (const hook of HOOK_DIRS) {
      mkdirSync(join(PLUGINS_DIR, hook), { recursive: true })
    }
  } catch {
    // Non-critical
  }
}

/**
 * Get the plugins directory path.
 */
export function getPluginsDir(): string {
  return PLUGINS_DIR
}

// ============================================================================
// Plugin discovery
// ============================================================================

/**
 * Discover all plugins for a specific hook.
 */
export function discoverPlugins(hook: PluginHook): PluginInfo[] {
  const hookDir = join(PLUGINS_DIR, hook)
  if (!existsSync(hookDir)) return []

  const plugins: PluginInfo[] = []

  try {
    const entries = readdirSync(hookDir)
    for (const entry of entries) {
      const fullPath = join(hookDir, entry)
      const ext = extname(entry).toLowerCase()

      // Skip non-script files and hidden files
      if (!VALID_EXTENSIONS.includes(ext)) continue
      if (entry.startsWith(".")) continue

      try {
        const stat = statSync(fullPath)
        if (!stat.isFile()) continue
      } catch {
        continue
      }

      plugins.push({
        name: entry,
        path: fullPath,
        hook,
        ext,
      })
    }
  } catch {
    // Directory read failed
  }

  // Sort alphabetically for deterministic execution order
  plugins.sort((a, b) => a.name.localeCompare(b.name))
  return plugins
}

/**
 * Discover all plugins across all hooks.
 */
export function discoverAllPlugins(): Map<PluginHook, PluginInfo[]> {
  const result = new Map<PluginHook, PluginInfo[]>()
  for (const hook of HOOK_DIRS) {
    result.set(hook, discoverPlugins(hook))
  }
  return result
}

// ============================================================================
// Plugin execution
// ============================================================================

/**
 * Build environment variables for a plugin from context.
 */
function buildPluginEnv(context: PluginContext): Record<string, string> {
  return {
    ...process.env as Record<string, string>,
    TAPIR_HOOK: context.hook,
    TAPIR_FILE: context.file || "",
    TAPIR_TITLE: context.title || "",
    TAPIR_URL: context.url || "",
    TAPIR_FORMAT: context.format || "",
    TAPIR_OUTPUT_DIR: context.outputDir || "",
    TAPIR_SUCCESS: context.success ? "true" : "false",
  }
}

/**
 * Get the command to run a plugin based on its extension.
 */
function getPluginCommand(plugin: PluginInfo): string[] {
  switch (plugin.ext) {
    case ".sh":
      return ["bash", plugin.path]
    case ".js":
      return ["node", plugin.path]
    case ".ts":
      return ["bun", "run", plugin.path]
    case ".py":
      return ["python3", plugin.path]
    default:
      return ["bash", plugin.path]
  }
}

/**
 * Execute a single plugin.
 */
async function executePlugin(
  plugin: PluginInfo,
  context: PluginContext,
): Promise<PluginResult> {
  const start = Date.now()
  const cmd = getPluginCommand(plugin)
  const env = buildPluginEnv(context)
  const contextJson = JSON.stringify(context)

  try {
    // Make sure shell scripts are executable
    if (plugin.ext === ".sh") {
      try { chmodSync(plugin.path, 0o755) } catch { /* ignore */ }
    }

    const proc = Bun.spawn(cmd, {
      env,
      stdin: new Blob([contextJson]),
      stdout: "pipe",
      stderr: "pipe",
    })

    // Race between process completion and timeout
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => {
        proc.kill()
        reject(new Error(`Plugin timed out after ${PLUGIN_TIMEOUT}ms`))
      }, PLUGIN_TIMEOUT),
    )

    const completion = (async () => {
      const exitCode = await proc.exited
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      return { exitCode, stdout, stderr }
    })()

    const result = await Promise.race([completion, timeout])

    return {
      plugin: plugin.name,
      success: result.exitCode === 0,
      output: result.stdout.trim(),
      error: result.stderr.trim() || undefined,
      durationMs: Date.now() - start,
    }
  } catch (err: any) {
    return {
      plugin: plugin.name,
      success: false,
      output: "",
      error: err.message || String(err),
      durationMs: Date.now() - start,
    }
  }
}

/**
 * Run all plugins for a given hook. Plugins run sequentially in
 * alphabetical order so earlier plugins can modify files before
 * later ones process them.
 */
export async function runHook(
  hook: PluginHook,
  context: Omit<PluginContext, "hook">,
  onPluginStart?: (plugin: PluginInfo) => void,
  onPluginDone?: (plugin: PluginInfo, result: PluginResult) => void,
): Promise<PluginResult[]> {
  const plugins = discoverPlugins(hook)
  if (plugins.length === 0) return []

  const fullContext: PluginContext = { ...context, hook }
  const results: PluginResult[] = []

  for (const plugin of plugins) {
    onPluginStart?.(plugin)
    const result = await executePlugin(plugin, fullContext)
    results.push(result)
    onPluginDone?.(plugin, result)
  }

  return results
}

/**
 * Get a summary of installed plugins.
 */
export function getPluginSummary(): { hook: PluginHook; count: number; names: string[] }[] {
  return HOOK_DIRS.map((hook) => {
    const plugins = discoverPlugins(hook)
    return {
      hook,
      count: plugins.length,
      names: plugins.map((p) => p.name),
    }
  })
}
