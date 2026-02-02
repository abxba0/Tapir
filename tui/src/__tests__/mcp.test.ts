/**
 * Tests for mcp.ts - MCP protocol handler and tool execution
 *
 * Tests the JSON-RPC message handling and tool implementations
 * by spawning the MCP server as a subprocess and communicating via stdio.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"

let originalSpawn: typeof Bun.spawn

beforeEach(() => {
  originalSpawn = Bun.spawn
})

afterEach(() => {
  Bun.spawn = originalSpawn
})

// ============================================================================
// Helper: send JSON-RPC messages to the MCP server via subprocess
// ============================================================================

async function sendMcpMessage(
  message: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const proc = Bun.spawn(["bun", "run", "src/mcp.ts"], {
    cwd: "/home/user/YT-video-downloader/tui",
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })

  // Bun.spawn with stdin:"pipe" gives a FileSink with write() and end()
  const stdin = proc.stdin as any
  stdin.write(JSON.stringify(message) + "\n")
  stdin.end()

  const stdout = await new Response(proc.stdout).text()
  await proc.exited

  const lines = stdout.trim().split("\n").filter(Boolean)
  if (lines.length > 0) {
    return JSON.parse(lines[0])
  }
  return {}
}

async function sendMcpMessages(
  messages: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const proc = Bun.spawn(["bun", "run", "src/mcp.ts"], {
    cwd: "/home/user/YT-video-downloader/tui",
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdin = proc.stdin as any
  for (const msg of messages) {
    stdin.write(JSON.stringify(msg) + "\n")
  }
  stdin.end()

  const stdout = await new Response(proc.stdout).text()
  await proc.exited

  const lines = stdout.trim().split("\n").filter(Boolean)
  return lines.map((line) => JSON.parse(line))
}

// ============================================================================
// Initialize
// ============================================================================

describe("MCP initialize", () => {
  test("responds with server info and capabilities", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    })

    expect(response.jsonrpc).toBe("2.0")
    expect(response.id).toBe(1)
    expect((response.result as any).protocolVersion).toBeTruthy()
    expect((response.result as any).serverInfo.name).toBe("tapir")
    expect((response.result as any).capabilities.tools).toBeDefined()
  })
})

// ============================================================================
// tools/list
// ============================================================================

describe("MCP tools/list", () => {
  test("returns list of available tools", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    })

    expect(response.id).toBe(2)
    const tools = (response.result as any).tools
    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBeGreaterThanOrEqual(5)

    const toolNames = tools.map((t: any) => t.name)
    expect(toolNames).toContain("search_youtube")
    expect(toolNames).toContain("get_video_info")
    expect(toolNames).toContain("download_video")
    expect(toolNames).toContain("convert_audio")
    expect(toolNames).toContain("embed_metadata")
    expect(toolNames).toContain("list_plugins")
  })

  test("each tool has name, description, and inputSchema", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {},
    })

    const tools = (response.result as any).tools
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
      expect(tool.inputSchema.type).toBe("object")
      expect(tool.inputSchema.properties).toBeDefined()
    }
  })
})

// ============================================================================
// ping
// ============================================================================

describe("MCP ping", () => {
  test("responds to ping", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "ping",
    })

    expect(response.id).toBe(4)
    expect(response.result).toBeDefined()
  })
})

// ============================================================================
// Unknown method
// ============================================================================

describe("MCP unknown method", () => {
  test("returns error for unknown method", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "nonexistent/method",
    })

    expect(response.id).toBe(5)
    expect(response.error).toBeDefined()
    expect((response.error as any).code).toBe(-32601)
    expect((response.error as any).message).toContain("Unknown method")
  })
})

// ============================================================================
// tools/call - list_plugins
// ============================================================================

describe("MCP tools/call list_plugins", () => {
  test("returns plugin information", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "list_plugins",
        arguments: {},
      },
    })

    expect(response.id).toBe(6)
    const result = response.result as any
    expect(result.content).toBeDefined()
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.content[0].type).toBe("text")

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.plugins_dir).toBeTruthy()
    expect(parsed.hooks).toBeDefined()
  })
})

// ============================================================================
// tools/call - embed_metadata (non-existent file)
// ============================================================================

describe("MCP tools/call embed_metadata", () => {
  test("returns error for non-existent file", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "embed_metadata",
        arguments: {
          file: "/nonexistent/file.mp4",
          title: "Test",
        },
      },
    })

    expect(response.id).toBe(7)
    const result = response.result as any
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(false)
  })
})

// ============================================================================
// tools/call - unknown tool
// ============================================================================

describe("MCP tools/call unknown tool", () => {
  test("returns error for unknown tool name", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "nonexistent_tool",
        arguments: {},
      },
    })

    expect(response.id).toBe(8)
    expect(response.error).toBeDefined()
    expect((response.error as any).code).toBe(-32602)
  })
})

// ============================================================================
// tools/call - missing tool name
// ============================================================================

describe("MCP tools/call missing name", () => {
  test("returns error when name is missing", async () => {
    const response = await sendMcpMessage({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        arguments: {},
      },
    })

    expect(response.id).toBe(9)
    expect(response.error).toBeDefined()
  })
})

// ============================================================================
// Multiple messages in sequence
// ============================================================================

describe("MCP multiple messages", () => {
  test("handles initialize then tools/list", async () => {
    const responses = await sendMcpMessages([
      { jsonrpc: "2.0", id: 10, method: "initialize", params: {} },
      { jsonrpc: "2.0", id: 11, method: "tools/list", params: {} },
    ])

    expect(responses.length).toBe(2)
    expect(responses[0].id).toBe(10)
    expect(responses[1].id).toBe(11)
    expect((responses[1].result as any).tools).toBeDefined()
  })
})

// ============================================================================
// Notification handling (no id)
// ============================================================================

describe("MCP notifications", () => {
  test("notifications without id do not produce response", async () => {
    const proc = Bun.spawn(["bun", "run", "src/mcp.ts"], {
      cwd: "/home/user/YT-video-downloader/tui",
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })

    const stdin = proc.stdin as any
    // Send notification (no id) followed by a normal request
    stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n" +
      JSON.stringify({ jsonrpc: "2.0", id: 99, method: "ping" }) + "\n"
    )
    stdin.end()

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    const lines = stdout.trim().split("\n").filter(Boolean)
    // Should only have one response (for the ping, not the notification)
    expect(lines.length).toBe(1)
    const response = JSON.parse(lines[0])
    expect(response.id).toBe(99)
  })
})

// ============================================================================
// Invalid JSON handling
// ============================================================================

describe("MCP invalid JSON", () => {
  test("returns parse error for invalid JSON", async () => {
    const proc = Bun.spawn(["bun", "run", "src/mcp.ts"], {
      cwd: "/home/user/YT-video-downloader/tui",
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    })

    const stdin = proc.stdin as any
    stdin.write("not valid json\n")
    // Send a valid message after to ensure server still works
    stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 100, method: "ping" }) + "\n")
    stdin.end()

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    const lines = stdout.trim().split("\n").filter(Boolean)
    expect(lines.length).toBe(2)

    // First should be parse error
    const error = JSON.parse(lines[0])
    expect(error.error).toBeDefined()
    expect(error.error.code).toBe(-32700)

    // Second should be successful ping
    const ping = JSON.parse(lines[1])
    expect(ping.id).toBe(100)
  })
})
