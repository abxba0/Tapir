# Tapir TUI

The TypeScript terminal UI for [Tapir](../README.md) -- download videos, convert audio, and transcribe media, all from the terminal. Built with [OpenTUI](https://opentui.com) and powered by [Bun](https://bun.sh).

## Prerequisites

### Required

| Dependency | Version | Purpose | Install |
|------------|---------|---------|---------|
| **[Bun](https://bun.sh)** | >= 1.0 | TypeScript runtime and package manager | `curl -fsSL https://bun.sh/install \| bash` |
| **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** | >= 2023.0.0 | Video/audio downloading from 1800+ sites | `pip install yt-dlp` or `brew install yt-dlp` |

### Optional

| Dependency | Version | Purpose | Install |
|------------|---------|---------|---------|
| **[FFmpeg](https://ffmpeg.org)** | >= 5.0 | Audio conversion, high-quality downloads, stream merging | See [FFmpeg install](#installing-ffmpeg) |
| **[OpenAI Whisper](https://github.com/openai/whisper)** | >= 20231117 | Local speech-to-text transcription | `pip install openai-whisper` |

> Without FFmpeg, video downloads still work but audio conversion and high-quality merging are unavailable.
> Without Whisper, transcription falls back to extracting existing subtitles from the URL (if available).

### System Requirements

- **OS**: Linux, macOS, or Windows (WSL recommended on Windows)
- **RAM**: 512 MB minimum; 2-10 GB recommended if using Whisper (depends on model size)
- **Disk**: Space for downloaded media and Whisper models (75 MB - 2.9 GB per model)
- **Network**: Internet connection for downloading media

## Installation

```bash
# Clone the repository (if you haven't already)
git clone https://github.com/abxba0/YT-video-downloader.git
cd YT-video-downloader/tui

# Install dependencies
bun install
```

### Installing FFmpeg

FFmpeg is needed for audio conversion, MP3 extraction, and merging high-quality video+audio streams.

- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt install ffmpeg`
- **Fedora**: `sudo dnf install ffmpeg`
- **Arch**: `sudo pacman -S ffmpeg`
- **Windows (WSL)**: `sudo apt install ffmpeg`

### Installing Whisper

Whisper enables local transcription of any audio/video content. It requires Python 3.8+ and PyTorch.

```bash
pip install openai-whisper
```

Whisper models download automatically on first use. Available models:

| Model | Size | VRAM | Speed | Accuracy |
|-------|------|------|-------|----------|
| tiny | 75 MB | ~1 GB | Fastest | Low |
| base | 142 MB | ~1 GB | Fast | Decent |
| small | 466 MB | ~2 GB | Moderate | Good |
| medium | 1.5 GB | ~5 GB | Slow | High |
| large | 2.9 GB | ~10 GB | Slowest | Best |

## Usage

### Interactive TUI Mode

```bash
bun start
# or
bun run src/index.ts
```

This launches the interactive terminal UI with four options:
1. **Download Video** - Download from YouTube, Instagram, TikTok, Vimeo, and 1800+ sites
2. **Convert Audio** - Convert between MP3, AAC, M4A, OGG, WAV, and FLAC
3. **Transcribe Media** - Transcribe audio/video from a URL or local file
4. **Exit**

### Command-Line Mode

```bash
# Download a video
bun start -- --download "https://youtube.com/watch?v=VIDEO_ID"

# Convert an audio file
bun start -- --convert /path/to/audio.mp3

# Transcribe a URL or local file
bun start -- --transcribe "https://youtube.com/watch?v=VIDEO_ID"
bun start -- --transcribe /path/to/video.mp4

# Show help
bun start -- --help
```

### Development Mode

```bash
# Run with auto-reload on file changes
bun dev

# Type-check the project
bun run typecheck
```

## Keyboard Controls

| Key | Action |
|-----|--------|
| UP / DOWN | Navigate menu options |
| ENTER | Select / confirm |
| TAB | Switch focus between elements |
| ESC | Go back / exit current screen |
| Q | Quit application (from main menu) |

## Features

### Video Download
- Download from YouTube, Vimeo, SoundCloud, Instagram, TikTok, Twitch, Bandcamp, and 1800+ sites
- Format and quality selection
- Playlist and channel support
- Real-time progress display
- Cookies support for restricted content

### Audio Conversion
- Convert between MP3, AAC, M4A, OGG, WAV, and FLAC
- Quality and bitrate selection
- File size estimation before conversion
- Metadata display (duration, bitrate, codec)

### Media Transcription
- Two-tier approach: subtitle extraction first (fast), Whisper fallback (accurate)
- Works with URLs (YouTube, Instagram, etc.) and local files
- Output formats: plain text (TXT), SRT (with timestamps), VTT (with timestamps)
- Five Whisper model sizes to choose from

## Project Structure

```
tui/
├── package.json            # Project config and scripts
├── tsconfig.json           # TypeScript configuration
├── bun.lock                # Dependency lock file
├── README.md               # This file
└── src/
    ├── index.ts            # Entry point, CLI parsing, app loop
    ├── types.ts            # TypeScript interfaces and type definitions
    ├── utils.ts            # Shared utilities, constants, formatting
    ├── components/
    │   └── theme.ts        # Color palette and layout constants
    ├── screens/
    │   ├── mainMenu.ts     # Main menu screen
    │   ├── downloadScreen.ts   # Video download screen
    │   ├── convertScreen.ts    # Audio conversion screen
    │   └── transcribeScreen.ts # Transcription screen
    └── services/
        ├── downloader.ts   # yt-dlp wrapper for video downloads
        ├── converter.ts    # FFmpeg wrapper for audio conversion
        └── transcriber.ts  # Whisper + subtitle extraction
```

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

## Disclaimer

This tool is for personal and educational use only. Please respect copyright laws and the Terms of Service of the sites you download from. Only download or transcribe content you have permission to access.
