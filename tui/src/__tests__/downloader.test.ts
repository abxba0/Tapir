/**
 * Tests for services/downloader.ts - progress parsing, search, download logic
 */
import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test"

import { parseProgressLine } from "../services/downloader"
import type { DownloadProgress } from "../types"

// ============================================================================
// parseProgressLine - pure function, extensive testing
// ============================================================================

describe("parseProgressLine", () => {
  test("parses percentage with size, speed, and ETA", () => {
    const line = "[download]  45.2% of  120.50MiB at  5.23MiB/s ETA 00:12"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("downloading")
    expect(result.percent).toBeCloseTo(45.2, 1)
    expect(result.totalSize).toBe("120.50MiB")
    expect(result.speed).toBe("5.23MiB/s")
    expect(result.eta).toBe("00:12")
    expect(result.raw).toBe(line)
  })

  test("parses 100% completion line", () => {
    const line = "[download] 100% of 120.50MiB in 00:23"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("downloading")
    expect(result.percent).toBe(100)
    expect(result.totalSize).toBe("120.50MiB")
  })

  test("parses 100% with tilde prefix", () => {
    const line = "[download] 100% of ~120.50MiB in 00:23"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("downloading")
    expect(result.percent).toBe(100)
    expect(result.totalSize).toBe("120.50MiB")
  })

  test("parses percentage with tilde prefix on size", () => {
    const line = "[download]  50.0% of ~250.00MiB at  10.0MiB/s ETA 00:13"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("downloading")
    expect(result.percent).toBeCloseTo(50.0, 1)
    expect(result.totalSize).toBe("250.00MiB")
  })

  test("detects destination line", () => {
    const line = "[download] Destination: /home/user/video.mp4"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("downloading")
    expect(result.percent).toBe(0)
  })

  test("detects merger phase", () => {
    const line = '[Merger] Merging formats into "/home/user/video.mp4"'
    const result = parseProgressLine(line)
    expect(result.phase).toBe("merging")
    expect(result.percent).toBe(100)
  })

  test("detects merging formats text", () => {
    const line = "Merging formats into output.mp4"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("merging")
  })

  test("detects ExtractAudio phase", () => {
    const line = '[ExtractAudio] Destination: /home/user/audio.mp3'
    const result = parseProgressLine(line)
    expect(result.phase).toBe("post_processing")
    expect(result.percent).toBe(100)
  })

  test("detects Post-process line", () => {
    const line = "Post-process file /home/user/video.mp4"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("post_processing")
  })

  test("detects subtitle writing", () => {
    const line = "[info] Writing video subtitles to: /home/user/video.en.srt"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("subtitles")
    expect(result.percent).toBe(100)
  })

  test("detects download writing subtitles", () => {
    const line = "[download] Writing video subtitles to: /home/user/video.en.srt"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("subtitles")
  })

  test("detects already downloaded", () => {
    const line = "[download] video.mp4 has already been downloaded"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("done")
    expect(result.percent).toBe(100)
  })

  test("returns downloading with -1 percent for unknown lines", () => {
    const line = "[info] Some informational message"
    const result = parseProgressLine(line)
    expect(result.phase).toBe("downloading")
    expect(result.percent).toBe(-1)
    expect(result.raw).toBe(line)
  })

  test("parses low percentage", () => {
    const line = "[download]   0.1% of  500.00MiB at  1.00MiB/s ETA 08:20"
    const result = parseProgressLine(line)
    expect(result.percent).toBeCloseTo(0.1, 1)
    expect(result.totalSize).toBe("500.00MiB")
    expect(result.speed).toBe("1.00MiB/s")
    expect(result.eta).toBe("08:20")
  })

  test("parses KiB speed", () => {
    const line = "[download]  12.3% of  50.00MiB at  512.00KiB/s ETA 01:30"
    const result = parseProgressLine(line)
    expect(result.speed).toBe("512.00KiB/s")
  })

  test("raw field preserves original line", () => {
    const line = "anything at all"
    expect(parseProgressLine(line).raw).toBe(line)
  })
})

// ============================================================================
// downloadVideo - argument construction tests via mock
// ============================================================================

describe("downloadVideo", () => {
  let originalSpawn: typeof Bun.spawn

  beforeEach(() => {
    originalSpawn = Bun.spawn
  })

  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("builds correct args for mp3 format", async () => {
    const { downloadVideo } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[], opts?: any) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({
          start(controller) { controller.close() },
        }),
        stderr: new ReadableStream({
          start(controller) { controller.close() },
        }),
        exited: Promise.resolve(0),
      }
    }) as any

    await downloadVideo({
      url: "https://youtube.com/watch?v=test",
      format: "mp3",
      outputDir: "test_downloads",
    })

    expect(capturedArgs).toContain("yt-dlp")
    expect(capturedArgs).toContain("-f")
    expect(capturedArgs).toContain("bestaudio/best")
    expect(capturedArgs).toContain("-x")
    expect(capturedArgs).toContain("--audio-format")
    expect(capturedArgs).toContain("mp3")
  })

  test("builds correct args for mp4 format", async () => {
    const { downloadVideo } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[], opts?: any) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({
          start(controller) { controller.close() },
        }),
        stderr: new ReadableStream({
          start(controller) { controller.close() },
        }),
        exited: Promise.resolve(0),
      }
    }) as any

    await downloadVideo({
      url: "https://youtube.com/watch?v=test",
      format: "mp4",
      outputDir: "test_downloads",
    })

    expect(capturedArgs).toContain("-f")
    expect(capturedArgs).toContain("bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best")
  })

  test("includes subtitle flags when downloadSubs is true", async () => {
    const { downloadVideo } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[], opts?: any) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({
          start(controller) { controller.close() },
        }),
        stderr: new ReadableStream({
          start(controller) { controller.close() },
        }),
        exited: Promise.resolve(0),
      }
    }) as any

    await downloadVideo({
      url: "https://youtube.com/watch?v=test",
      format: "best",
      outputDir: "test_downloads",
      downloadSubs: true,
      subLangs: "en,fr",
    })

    expect(capturedArgs).toContain("--write-subs")
    expect(capturedArgs).toContain("--write-auto-subs")
    expect(capturedArgs).toContain("--sub-format")
    expect(capturedArgs).toContain("srt")
    expect(capturedArgs).toContain("--sub-langs")
    expect(capturedArgs).toContain("en,fr")
  })

  test("uses default sub-langs when not specified", async () => {
    const { downloadVideo } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[], opts?: any) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({
          start(controller) { controller.close() },
        }),
        stderr: new ReadableStream({
          start(controller) { controller.close() },
        }),
        exited: Promise.resolve(0),
      }
    }) as any

    await downloadVideo({
      url: "https://youtube.com/watch?v=test",
      format: "best",
      outputDir: "test_downloads",
      downloadSubs: true,
    })

    expect(capturedArgs).toContain("--sub-langs")
    expect(capturedArgs).toContain("en.*,en")
  })

  test("includes playlist flags", async () => {
    const { downloadVideo } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[], opts?: any) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({
          start(controller) { controller.close() },
        }),
        stderr: new ReadableStream({
          start(controller) { controller.close() },
        }),
        exited: Promise.resolve(0),
      }
    }) as any

    await downloadVideo({
      url: "https://youtube.com/playlist?list=test",
      format: "best",
      outputDir: "test_downloads",
      isPlaylist: true,
    })

    expect(capturedArgs).toContain("--ignore-errors")
    expect(capturedArgs).toContain("--download-archive")
  })

  test("returns success on exit code 0", async () => {
    const { downloadVideo } = await import("../services/downloader")

    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await downloadVideo({
      url: "https://youtube.com/watch?v=test",
      format: "best",
      outputDir: "test_downloads",
    })

    expect(result.success).toBe(true)
    expect(result.url).toBe("https://youtube.com/watch?v=test")
  })

  test("returns failure on non-zero exit code", async () => {
    const { downloadVideo } = await import("../services/downloader")

    Bun.spawn = ((args: string[], opts?: any) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("ERROR: Video unavailable"))
          c.close()
        },
      }),
      exited: Promise.resolve(1),
    })) as any

    const result = await downloadVideo({
      url: "https://youtube.com/watch?v=bad",
      format: "best",
      outputDir: "test_downloads",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("ERROR")
  })

  test("handles spawn exception", async () => {
    const { downloadVideo } = await import("../services/downloader")

    Bun.spawn = (() => {
      throw new Error("spawn failed")
    }) as any

    const result = await downloadVideo({
      url: "https://youtube.com/watch?v=test",
      format: "best",
      outputDir: "test_downloads",
    })

    expect(result.success).toBe(false)
    expect(result.message).toContain("Download error")
  })

  test("handles high and bestvideo and bestaudio formats", async () => {
    const { downloadVideo } = await import("../services/downloader")

    for (const fmt of ["high", "bestvideo", "bestaudio", "best", "custom_id"]) {
      let capturedArgs: string[] = []
      Bun.spawn = ((args: string[]) => {
        capturedArgs = args
        return {
          stdout: new ReadableStream({ start(c) { c.close() } }),
          stderr: new ReadableStream({ start(c) { c.close() } }),
          exited: Promise.resolve(0),
        }
      }) as any

      await downloadVideo({
        url: "https://youtube.com/watch?v=test",
        format: fmt,
        outputDir: "test_downloads",
      })

      expect(capturedArgs).toContain("-f")
    }
  })

  test("includes cookies flags when provided", async () => {
    const { downloadVideo } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[]) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    await downloadVideo({
      url: "https://youtube.com/watch?v=test",
      format: "best",
      outputDir: "test_downloads",
      cookiesFile: "/path/cookies.txt",
      cookiesFromBrowser: "chrome",
    })

    expect(capturedArgs).toContain("--cookies")
    expect(capturedArgs).toContain("/path/cookies.txt")
    expect(capturedArgs).toContain("--cookies-from-browser")
    expect(capturedArgs).toContain("chrome")
  })
})

// ============================================================================
// searchYouTube
// ============================================================================

describe("searchYouTube", () => {
  let originalSpawn: typeof Bun.spawn

  beforeEach(() => {
    originalSpawn = Bun.spawn
  })

  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("parses search results correctly", async () => {
    const { searchYouTube } = await import("../services/downloader")

    const mockResult = JSON.stringify({
      id: "abc123",
      title: "Test Video",
      url: "https://www.youtube.com/watch?v=abc123",
      channel: "Test Channel",
      duration: 120,
      view_count: 1000,
      description: "Test description",
    })

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(mockResult + "\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const results = await searchYouTube("test query", 5)
    expect(results.length).toBe(1)
    expect(results[0].id).toBe("abc123")
    expect(results[0].title).toBe("Test Video")
    expect(results[0].channel).toBe("Test Channel")
    expect(results[0].duration).toBe(120)
    expect(results[0].viewCount).toBe(1000)
  })

  test("returns empty array on failure", async () => {
    const { searchYouTube } = await import("../services/downloader")

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(1),
    })) as any

    const results = await searchYouTube("test query")
    expect(results).toEqual([])
  })

  test("handles spawn exception", async () => {
    const { searchYouTube } = await import("../services/downloader")

    Bun.spawn = (() => { throw new Error("fail") }) as any

    const results = await searchYouTube("test")
    expect(results).toEqual([])
  })

  test("handles malformed JSON lines gracefully", async () => {
    const { searchYouTube } = await import("../services/downloader")

    const validLine = JSON.stringify({ id: "a", title: "T", channel: "C", duration: 60, view_count: 100 })

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("not json\n" + validLine + "\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const results = await searchYouTube("test")
    expect(results.length).toBe(1)
    expect(results[0].id).toBe("a")
  })

  test("builds correct ytsearch argument", async () => {
    const { searchYouTube } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[]) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({ start(c) { c.close() } }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    await searchYouTube("lofi beats", 15)
    expect(capturedArgs).toContain("ytsearch15:lofi beats")
    expect(capturedArgs).toContain("--flat-playlist")
    expect(capturedArgs).toContain("--dump-json")
  })

  test("constructs URL from id when url/webpage_url missing", async () => {
    const { searchYouTube } = await import("../services/downloader")

    const mockResult = JSON.stringify({
      id: "xyz789",
      title: "No URL Video",
      channel: "Ch",
      duration: 30,
      view_count: 5,
    })

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(mockResult + "\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const results = await searchYouTube("test")
    expect(results[0].url).toBe("https://www.youtube.com/watch?v=xyz789")
  })
})

// ============================================================================
// getVideoInfo
// ============================================================================

describe("getVideoInfo", () => {
  let originalSpawn: typeof Bun.spawn

  beforeEach(() => {
    originalSpawn = Bun.spawn
  })

  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("parses single video info", async () => {
    const { getVideoInfo } = await import("../services/downloader")

    const info = { title: "Test", channel: "Ch", duration: 120 }
    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(JSON.stringify(info) + "\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await getVideoInfo("https://youtube.com/watch?v=test")
    expect(result).not.toBeNull()
    expect(result!.title).toBe("Test")
    expect(result!.channel).toBe("Ch")
  })

  test("parses playlist info (multiple lines)", async () => {
    const { getVideoInfo } = await import("../services/downloader")

    const entry1 = JSON.stringify({ title: "Video 1", channel: "Ch" })
    const entry2 = JSON.stringify({ title: "Video 2", channel: "Ch" })

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(entry1 + "\n" + entry2 + "\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await getVideoInfo("https://youtube.com/playlist?list=test")
    expect(result).not.toBeNull()
    expect(result!._type).toBe("playlist")
    expect(result!.entries!.length).toBe(2)
  })

  test("returns null on failure", async () => {
    const { getVideoInfo } = await import("../services/downloader")

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(1),
    })) as any

    const result = await getVideoInfo("https://youtube.com/watch?v=bad")
    expect(result).toBeNull()
  })

  test("returns null on exception", async () => {
    const { getVideoInfo } = await import("../services/downloader")
    Bun.spawn = (() => { throw new Error("fail") }) as any
    const result = await getVideoInfo("https://youtube.com/watch?v=test")
    expect(result).toBeNull()
  })

  test("includes cookies args when provided", async () => {
    const { getVideoInfo } = await import("../services/downloader")
    let capturedArgs: string[] = []

    Bun.spawn = ((args: string[]) => {
      capturedArgs = args
      return {
        stdout: new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(JSON.stringify({ title: "T" }) + "\n"))
            c.close()
          },
        }),
        stderr: new ReadableStream({ start(c) { c.close() } }),
        exited: Promise.resolve(0),
      }
    }) as any

    await getVideoInfo("https://youtube.com/watch?v=test", "/path/cookies.txt", "firefox")
    expect(capturedArgs).toContain("--cookies")
    expect(capturedArgs).toContain("/path/cookies.txt")
    expect(capturedArgs).toContain("--cookies-from-browser")
    expect(capturedArgs).toContain("firefox")
  })
})

// ============================================================================
// listFormats
// ============================================================================

describe("listFormats", () => {
  let originalSpawn: typeof Bun.spawn

  beforeEach(() => {
    originalSpawn = Bun.spawn
  })

  afterEach(() => {
    Bun.spawn = originalSpawn
  })

  test("categorizes formats correctly", async () => {
    const { listFormats } = await import("../services/downloader")

    const info = {
      title: "Test",
      formats: [
        { format_id: "1", ext: "mp4", vcodec: "h264", acodec: "aac", height: 720, tbr: 1000 },
        { format_id: "2", ext: "mp4", vcodec: "h264", acodec: "none", height: 1080, tbr: 2000 },
        { format_id: "3", ext: "m4a", vcodec: "none", acodec: "aac", tbr: 128 },
      ],
    }

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(JSON.stringify(info) + "\n"))
          c.close()
        },
      }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(0),
    })) as any

    const result = await listFormats("https://youtube.com/watch?v=test")
    expect(result).not.toBeNull()
    expect(result!.combined.length).toBe(1)
    expect(result!.videoOnly.length).toBe(1)
    expect(result!.audioOnly.length).toBe(1)
  })

  test("returns null when info fetch fails", async () => {
    const { listFormats } = await import("../services/downloader")

    Bun.spawn = ((args: string[]) => ({
      stdout: new ReadableStream({ start(c) { c.close() } }),
      stderr: new ReadableStream({ start(c) { c.close() } }),
      exited: Promise.resolve(1),
    })) as any

    const result = await listFormats("https://youtube.com/watch?v=bad")
    expect(result).toBeNull()
  })
})
