# Tapir

A media downloader, converter, transcriber, and text-to-speech tool for the terminal. Download videos from **YouTube, Vimeo, Instagram, TikTok, SoundCloud, and 1800+ other sites**, convert audio between formats, transcribe media using OpenAI Whisper, and convert documents to speech audio.


- [ ] **[tui/](tui/)** - TypeScript terminal UI built with [OpenTUI](https://opentui.com) and [Bun](https://bun.sh)

## Features

- **Multi-Site Download** - YouTube, Vimeo, SoundCloud, Instagram, TikTok, Twitch, Bandcamp, Dailymotion, and 1800+ sites via yt-dlp
- **Playlist & Channel Download** - Download entire playlists/channels with automatic ordering and incremental sync
- **Parallel Downloads** - Download multiple videos simultaneously with configurable worker pools
- **Batch Downloads** - Queue multiple URLs for sequential download with status tracking (TUI)
- **YouTube Search** - Search and download directly from search results (TUI)
- **Audio Conversion** - Convert between MP3, AAC, M4A, OGG, WAV, and FLAC with quality selection
- **Media Transcription** - Transcribe audio/video from URLs or local files using OpenAI Whisper
- **Text to Speech** - Convert PDF, TXT, MD, HTML, and other documents to speech audio using edge-tts, gTTS, or espeak (TUI)
- **Subtitle Extraction** - Fast subtitle extraction from online videos when available (before falling back to Whisper)
- **Transcription Formats** - Output as plain text (TXT), SRT, or VTT with timestamps
- **Metadata Embedding** - Automatically embed title, artist, and thumbnail into downloaded files (TUI)
- **Plugin System** - Run custom scripts on post-download, post-convert, and post-transcribe hooks (TUI)
- **REST API Server** - Run as a background HTTP service for external tools and web UIs (TUI)
- **MCP Server** - Model Context Protocol server for AI agent integration (TUI)
- **Quality Selection** - Choose from available video qualities and formats before downloading
- **Size Estimation** - View estimated file sizes and quality before conversion
- **Cookies Support** - Access age-restricted and region-limited content
- **Clipboard Detection** - Automatically detects URLs in your clipboard (Python CLI)
- **Fuzzy Search** - Smart format selection with fuzzy matching (Python CLI)
- **Cross-Platform** - Works on Linux, macOS, and Windows (WSL)

## Prerequisites

### Required

| Dependency | Purpose | Install |
|------------|---------|---------|
| **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** | Video/audio downloading | `pip install yt-dlp` or `brew install yt-dlp` |
| **[Python 3.8+](https://python.org)** | Python CLI (`cli/`) | Pre-installed on most systems |
| **[Bun](https://bun.sh)** | TypeScript TUI (`tui/`) | `curl -fsSL https://bun.sh/install \| bash` |

### Optional

| Dependency | Purpose | Install |
|------------|---------|---------|
| **[FFmpeg](https://ffmpeg.org)** | Audio conversion, high-quality downloads, stream merging | See [Installing FFmpeg](#installing-ffmpeg) |
| **[OpenAI Whisper](https://github.com/openai/whisper)** | Local speech-to-text transcription | `pip install openai-whisper` |
| **[edge-tts](https://github.com/rany2/edge-tts)** | Text-to-speech (highest quality, recommended) | `pip install edge-tts` |
| **[gTTS](https://github.com/pndurette/gTTS)** | Text-to-speech (Google TTS, fallback) | `pip install gTTS` |
| **[espeak](https://espeak.sourceforge.net/)** | Text-to-speech (offline) | `sudo apt install espeak-ng` |
| **[poppler-utils](https://poppler.freedesktop.org/)** | PDF text extraction for TTS | `sudo apt install poppler-utils` |

> Without FFmpeg, video downloads still work but audio conversion and quality merging are unavailable.
> Without Whisper, transcription falls back to extracting existing subtitles from the URL (if available).
> Without a TTS engine, the Text to Speech feature is unavailable. Install at least one (edge-tts recommended).

### Installing FFmpeg

- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt install ffmpeg`
- **Fedora**: `sudo dnf install ffmpeg`
- **Arch**: `sudo pacman -S ffmpeg`
- **Windows**: Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add to PATH

### Installing Whisper

```bash
pip install openai-whisper
```

Available models (downloaded automatically on first use):

| Model | Size | VRAM | Speed | Accuracy |
|-------|------|------|-------|----------|
| tiny | 75 MB | ~1 GB | Fastest | Low |
| base | 142 MB | ~1 GB | Fast | Decent |
| small | 466 MB | ~2 GB | Moderate | Good |
| medium | 1.5 GB | ~5 GB | Slow | High |
| large | 2.9 GB | ~10 GB | Slowest | Best |

## Quick Start



### TypeScript TUI

```bash
cd tui
bun install
bun start
```

See [tui/README.md](tui/README.md) for full TUI documentation.



## Usage

### Interactive Mode

Run without arguments to launch the interactive menu:

```bash
python3 cli/youtube_downloader.py
```

Choose from:
1. **Download Video** - Download from any supported site
2. **Convert Audio** - Convert between audio formats
3. **Transcribe Media** - Transcribe a URL or local file
4. **Text to Speech** - Convert documents to speech audio (TUI only)
5. **Exit**



## Supported Sites

The tool supports **1800+ video sites** through yt-dlp, including:

- YouTube (videos, playlists, channels, shorts)
- Vimeo
- SoundCloud
- Instagram (reels, videos)
- TikTok
- Twitch (videos, clips, VODs)
- Dailymotion
- Bandcamp
- Facebook, Twitter/X, Reddit, and many more

```bash
python3 cli/youtube_downloader.py --list-sites
```

## Project Structure

```
├── tui/                            # TypeScript TUI application
│   ├── src/                        # Source code
│   │   ├── screens/                # TUI screens (download, search, batch, TTS, etc.)
│   │   ├── services/               # Service layer (downloader, converter, TTS, etc.)
│   │   └── __tests__/              # Test suites (400+ tests)
│   ├── package.json                # Bun/Node dependencies
│   ├── tsconfig.json               # TypeScript config
│   └── README.md                   # TUI-specific docs  
└── README.md                       # This file
```

## Development & Testing



- **181 automated tests** with **83% code coverage**
- Unit tests covering URL validation, site detection, downloads, conversion, parallel processing, cookies, and error handling
- Integration tests covering complete workflows

## License

[MIT](LICENSE)

## Disclaimer

This tool is for personal and educational use only. Please respect copyright laws and the Terms of Service of the sites you download from. Only download or transcribe content you have permission to access.
