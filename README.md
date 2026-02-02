# Tapir

A media downloader, converter, and transcriber for the terminal. Download videos from **YouTube, Vimeo, Instagram, TikTok, SoundCloud, and 1800+ other sites**, convert audio between formats, and transcribe media using OpenAI Whisper.

Available in two flavors:
- **[cli/](cli/)** - Python CLI with Rich TUI mode
- **[tui/](tui/)** - TypeScript terminal UI built with [OpenTUI](https://opentui.com) and [Bun](https://bun.sh)

## Features

- **Multi-Site Download** - YouTube, Vimeo, SoundCloud, Instagram, TikTok, Twitch, Bandcamp, Dailymotion, and 1800+ sites via yt-dlp
- **Playlist & Channel Download** - Download entire playlists/channels with automatic ordering and incremental sync
- **Parallel Downloads** - Download multiple videos simultaneously with configurable worker pools
- **Audio Conversion** - Convert between MP3, AAC, M4A, OGG, WAV, and FLAC with quality selection
- **Media Transcription** - Transcribe audio/video from URLs or local files using OpenAI Whisper
- **Subtitle Extraction** - Fast subtitle extraction from online videos when available (before falling back to Whisper)
- **Transcription Formats** - Output as plain text (TXT), SRT, or VTT with timestamps
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

> Without FFmpeg, video downloads still work but audio conversion and quality merging are unavailable.
> Without Whisper, transcription falls back to extracting existing subtitles from the URL (if available).

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

### Python CLI

```bash
git clone https://github.com/abxba0/YT-video-downloader.git
cd YT-video-downloader

# Install dependencies
pip install -r cli/requirements.txt

# Run interactively
python3 cli/youtube_downloader.py

# Or use directly from the command line
python3 cli/youtube_downloader.py "https://youtube.com/watch?v=VIDEO_ID"
```

### TypeScript TUI

```bash
cd tui
bun install
bun start
```

See [tui/README.md](tui/README.md) for full TUI documentation.

### Docker

```bash
docker build -f docker/Dockerfile -t tapir:latest .

# Download a video
docker run --rm -v $(pwd)/downloads:/downloads tapir:latest \
  "https://youtube.com/watch?v=VIDEO_ID"

# Convert to MP3
docker run --rm -v $(pwd)/downloads:/downloads tapir:latest \
  "https://youtube.com/watch?v=VIDEO_ID" --mp3

# Or use Docker Compose
cd docker && docker-compose run --rm yt-downloader "VIDEO_URL" --mp3
```

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
4. **Exit**

### Command-Line Mode

```bash
# Download a video
python3 cli/youtube_downloader.py "https://youtube.com/watch?v=VIDEO_ID"

# Download from other sites
python3 cli/youtube_downloader.py "https://vimeo.com/VIDEO_ID"
python3 cli/youtube_downloader.py "https://tiktok.com/@user/video/VIDEO_ID"
python3 cli/youtube_downloader.py "https://instagram.com/reel/REEL_ID"

# Convert to MP3
python3 cli/youtube_downloader.py --mp3 "VIDEO_URL"

# High quality (best video + audio merged)
python3 cli/youtube_downloader.py --high "VIDEO_URL"

# Download a playlist
python3 cli/youtube_downloader.py "https://youtube.com/playlist?list=PLAYLIST_ID"

# Custom output directory
python3 cli/youtube_downloader.py -o "/path/to/downloads" "VIDEO_URL"

# Show video info only
python3 cli/youtube_downloader.py --info "VIDEO_URL"

# Launch audio conversion mode
python3 cli/youtube_downloader.py --convert

# Launch transcription mode
python3 cli/youtube_downloader.py --transcribe

# List supported sites
python3 cli/youtube_downloader.py --list-sites
```

### Parallel Downloads

```bash
# Download multiple URLs in parallel (default: 3 workers)
python3 cli/youtube_downloader.py "URL1" "URL2" "URL3" --parallel

# Custom worker count (max: 10)
python3 cli/youtube_downloader.py "URL1" "URL2" --parallel --max-workers 5

# From a batch file
python3 cli/youtube_downloader.py --batch-file urls.txt --parallel

# From stdin
cat urls.txt | python3 cli/youtube_downloader.py --stdin --parallel
```

### Cookies Support

```bash
# Use a cookies file
python3 cli/youtube_downloader.py --cookies cookies.txt "VIDEO_URL"

# Extract cookies from your browser
python3 cli/youtube_downloader.py --cookies-from-browser chrome "VIDEO_URL"
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

```bash
python3 cli/youtube_downloader.py --list-sites
```

## Project Structure

```
.
├── cli/                            # Python CLI application
│   ├── youtube_downloader.py       # Main application
│   ├── requirements.txt            # Python dependencies
│   ├── test_youtube_downloader.py  # Unit tests (140+)
│   ├── test_integration.py         # Integration tests (40+)
│   └── test-docker.sh              # Docker test script
├── tui/                            # TypeScript TUI application
│   ├── src/                        # Source code
│   ├── package.json                # Bun/Node dependencies
│   ├── tsconfig.json               # TypeScript config
│   └── README.md                   # TUI-specific docs
├── docker/                         # Docker configuration
│   ├── Dockerfile                  # Image definition
│   └── docker-compose.yml          # Compose config
└── README.md                       # This file
```

## Development & Testing

```bash
# Install test dependencies
pip install pytest pytest-cov pytest-mock

# Run all tests
pytest cli/test_youtube_downloader.py cli/test_integration.py -v

# Run with coverage
pytest cli/test_youtube_downloader.py cli/test_integration.py \
  --cov=youtube_downloader --cov-report=html
```

- **181 automated tests** with **83% code coverage**
- Unit tests covering URL validation, site detection, downloads, conversion, parallel processing, cookies, and error handling
- Integration tests covering complete workflows

## License

[MIT](LICENSE)

## Disclaimer

This tool is for personal and educational use only. Please respect copyright laws and the Terms of Service of the sites you download from. Only download or transcribe content you have permission to access.
