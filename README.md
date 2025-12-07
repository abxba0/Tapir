# Multi-Site Video Downloader & Audio Converter

A command-line tool to download videos from **YouTube, Vimeo, SoundCloud, and 1800+ other sites** locally and convert audio files between different formats with quality selection and format conversion options.

## Features

- **🌐 Multi-Site Support**: Download from YouTube, Vimeo, SoundCloud, Dailymotion, Twitch, TikTok, Bandcamp, and 1800+ sites
- **📺 Video Download**: Download videos with quality selection from any supported site
- **📝 Playlist & Channel Download**: Download entire playlists or channels with automatic ordering
- **🔄 Incremental Sync**: Skip already-downloaded videos for efficient playlist updates
- **⚡ Parallel Downloads**: Download multiple videos simultaneously with configurable worker pools
- **📋 Bulk Processing**: Process large video lists from files or standard input
- **🔀 Queue Management**: Robust job queue for managing concurrent downloads
- **🍪 Cookies Support**: Access age-restricted and region-limited content using cookies
- **🎵 Audio Format Conversion**: Convert audio files between popular formats (MP3, M4A, WAV, FLAC, OGG, AAC)
- **🖥️ Interactive Menu**: Choose between video download and audio conversion
- **⚙️ Quality Selection**: Choose from available video qualities and formats
- **📦 Format Support**: Download as MP4, convert to MP3, or use original formats
- **📊 Size & Quality Estimation**: View estimated file sizes and quality before conversion
- **ℹ️ Metadata Display**: View video information before downloading
- **⏱️ Progress Tracking**: Real-time download progress with speed and ETA
- **🔧 Auto-Install**: Automatically attempts to install required dependencies
- **💻 Cross-Platform**: Works on Windows, macOS, and Linux
- **✨ Rich TUI Mode**: Beautiful terminal interface with tables and formatted output (auto-enabled when Rich library is available)
- **📋 Clipboard Detection**: Automatically detects URLs in your clipboard for quick downloads
- **🔍 Fuzzy Search**: Smart format selection with fuzzy matching for easier format choice

## Supported Sites

The tool supports **1800+ video sites** through yt-dlp, including:

- **YouTube** - Videos, playlists, channels, shorts
- **Vimeo** - Videos and collections
- **SoundCloud** - Tracks and playlists
- **Dailymotion** - Videos
- **Twitch** - Videos, clips, and VODs
- **Bandcamp** - Tracks and albums
- **TikTok** - Videos
- **And many more!** - Facebook, Instagram, Twitter/X, Reddit, and hundreds of others

To see a list of popular supported sites, run:
```bash
python3 youtube_downloader.py --list-sites
```

## Quick Start

### Installation

#### Basic Installation (Core Features Only)

1. **Download the script** and save it as `youtube_downloader.py`

2. The script will automatically install `yt-dlp` when first run

3. **Optionally install FFmpeg** for audio conversion and high-quality video merging (see Dependencies section)

#### Enhanced Installation (With Rich TUI Features)

For the best experience with beautiful tables, clipboard detection, and fuzzy search:

```bash
# Clone or download the repository
git clone https://github.com/abxba0/YT-video-downloader.git
cd YT-video-downloader

# Install all dependencies including optional TUI features
pip install -r requirements.txt

# Run the script
python3 youtube_downloader.py
```

### Interactive Mode (Recommended)

1. **Download the script** and save it as `youtube_downloader.py`

2. **Run the script**:
   ```bash
   python3 youtube_downloader.py
   ```

3. **Choose your operation**:
   - Press **1** to download a video from any supported site
   - Press **2** to convert an audio file
   - Press **3** to exit

### Video Download (Any Site)

When you select option 1:
1. View the list of supported sites
2. Enter a video URL from any supported site when prompted
3. View video/playlist information and available formats
4. Select your preferred format
5. Videos will be downloaded to `~/youtube_downloads/`
6. For playlists:
   - Videos are numbered in playlist order (e.g., `001 - Video Title.mp4`)
   - Already downloaded videos are automatically skipped
   - Perfect for keeping playlists in sync

### Audio File Conversion

When you select option 2:
1. Enter the path to your audio file (supports MP3, M4A, WAV, FLAC, OGG, AAC, WMA)
2. View file information including:
   - Current file size and bitrate
   - Duration
3. Select output format from:
   - **MP3** - MPEG Audio Layer 3 (Lossy)
   - **AAC** - Advanced Audio Coding (Lossy)
   - **M4A** - MPEG-4 Audio (Lossy)
   - **OGG** - Ogg Vorbis (Lossy)
   - **WAV** - Waveform Audio (Lossless)
   - **FLAC** - Free Lossless Audio Codec (Lossless)
4. View estimated output size and quality
5. Confirm and convert

## Command Line Usage

### Video Download from Any Site

```bash
# List all supported sites
python3 youtube_downloader.py --list-sites

# Basic usage - YouTube video
python3 youtube_downloader.py "https://youtube.com/watch?v=VIDEO_ID"

# Download from Vimeo
python3 youtube_downloader.py "https://vimeo.com/VIDEO_ID"

# Download from SoundCloud
python3 youtube_downloader.py "https://soundcloud.com/artist/track"

# Download from Dailymotion
python3 youtube_downloader.py "https://dailymotion.com/video/VIDEO_ID"

# Download from TikTok
python3 youtube_downloader.py "https://tiktok.com/@user/video/VIDEO_ID"

# Download from Twitch
python3 youtube_downloader.py "https://twitch.tv/videos/VIDEO_ID"

# Download from Bandcamp
python3 youtube_downloader.py "https://artist.bandcamp.com/track/track-name"

# Download a YouTube playlist
python3 youtube_downloader.py "https://youtube.com/playlist?list=PLAYLIST_ID"

# Download from a YouTube channel
python3 youtube_downloader.py "https://youtube.com/channel/CHANNEL_ID"
python3 youtube_downloader.py "https://youtube.com/@username"

# Convert to MP3 (works with any site)
python3 youtube_downloader.py --mp3 "https://vimeo.com/VIDEO_ID"

# Download as MP4 (works with any site)
python3 youtube_downloader.py --mp4 "https://soundcloud.com/artist/track"

# High quality (best video + audio merged)
python3 youtube_downloader.py --high "https://youtube.com/watch?v=VIDEO_ID"

# Custom output directory
python3 youtube_downloader.py -o "/path/to/downloads" "https://youtube.com/watch?v=VIDEO_ID"

# Show video info only
python3 youtube_downloader.py --info "https://youtube.com/watch?v=VIDEO_ID"

# Use cookies for age-restricted content
python3 youtube_downloader.py --cookies cookies.txt "https://youtube.com/watch?v=VIDEO_ID"

# Extract cookies from browser
python3 youtube_downloader.py --cookies-from-browser chrome "https://youtube.com/watch?v=VIDEO_ID"

# Use custom archive file for tracking downloaded videos
python3 youtube_downloader.py --archive my-archive.txt "https://youtube.com/playlist?list=PLAYLIST_ID"
```

### Parallel Downloads

Download multiple videos simultaneously for faster processing:

```bash
# Download multiple URLs in parallel (default: 3 workers)
python3 youtube_downloader.py "URL1" "URL2" "URL3" --parallel

# Specify custom number of workers (max: 10)
python3 youtube_downloader.py "URL1" "URL2" "URL3" --parallel --max-workers 5

# Download from a batch file (one URL per line)
python3 youtube_downloader.py --batch-file urls.txt --parallel

# Read URLs from standard input
cat urls.txt | python3 youtube_downloader.py --stdin --parallel

# Combine with format options
python3 youtube_downloader.py --batch-file urls.txt --parallel --mp3 --max-workers 4

# Download with high quality in parallel
python3 youtube_downloader.py "URL1" "URL2" --parallel --high
```

**Batch File Format:**
```
# urls.txt - one URL per line, comments start with #
https://youtube.com/watch?v=VIDEO1
https://vimeo.com/VIDEO2
# This is a comment
https://soundcloud.com/artist/track
```

**Features:**
- **Concurrent downloads**: Process multiple videos simultaneously
- **Configurable workers**: Adjust parallelism from 1 to 10 workers
- **Bulk input**: Accept URLs from files, stdin, or command-line arguments
- **Thread-safe tracking**: Monitor progress and failures across all workers
- **Error handling**: Continues downloading even if individual videos fail
- **Summary reports**: View success/failure statistics after completion

### Audio File Conversion

```bash
# Launch audio conversion mode
python3 youtube_downloader.py --convert
```

This will start the interactive audio conversion workflow where you can:
- Select your input audio file
- Choose the desired output format
- View size and quality estimations
- Convert the file

## Dependencies

The script will automatically attempt to install required dependencies:

- **yt-dlp**: For downloading videos (auto-installed via pip)
- **FFmpeg**: For format conversion, high-quality downloads, and audio conversion (manual installation required)

### Optional Dependencies for Enhanced TUI

For the best experience with Rich TUI mode, fuzzy search, and clipboard detection, install optional dependencies:

```bash
pip install -r requirements.txt
```

This includes:
- **rich**: Beautiful terminal formatting and tables
- **textual**: Advanced TUI components (future feature)
- **pyperclip**: Clipboard URL detection
- **thefuzz**: Fuzzy search for format selection
- **python-Levenshtein**: Faster fuzzy matching

**Note**: The tool works perfectly fine without these dependencies - it will automatically fall back to standard CLI mode.

### Installing FFmpeg

FFmpeg is required for:
- Audio format conversion
- Converting YouTube videos to MP3
- High-quality downloads (merging separate video and audio streams)

#### Installation Instructions:

- **Windows**: Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add to PATH
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` (Ubuntu/Debian) or equivalent for your distro

## Playlist & Channel Downloads

### Features
- **Automatic ordering**: Videos are numbered in playlist order (001, 002, 003...)
- **Incremental sync**: Already downloaded videos are skipped automatically
- **Archive file**: Tracks downloaded video IDs to prevent duplicates
- **Error handling**: Continues downloading even if individual videos fail

### How It Works
When you download a playlist:
1. An archive file (`.yt-dlp-archive.txt`) is created in the download directory
2. Each downloaded video's ID is recorded in this file
3. On subsequent runs, videos in the archive are skipped
4. Perfect for keeping your local copy in sync with the playlist

### Example
```bash
# First run - downloads all videos
python3 youtube_downloader.py "https://youtube.com/playlist?list=PLAYLIST_ID"

# Second run - only downloads new videos added to the playlist
python3 youtube_downloader.py "https://youtube.com/playlist?list=PLAYLIST_ID"
```

## Cookies Support

### Why Use Cookies?
Cookies enable downloading:
- **Age-restricted content** - Videos requiring age verification
- **Region-restricted content** - Videos blocked in certain countries
- **Private/unlisted videos** - Content requiring authentication
- **Member-only content** - Videos available to channel members

### Using Cookies File
Export your browser cookies to a Netscape format file using a browser extension:
- Chrome: [Get cookies.txt](https://chrome.google.com/webstore/detail/get-cookiestxt/bgaddhkoddajcdgocldbbfleckgcbcid)
- Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

```bash
python3 youtube_downloader.py --cookies cookies.txt "VIDEO_URL"
```

### Using Browser Cookies Directly
yt-dlp can extract cookies directly from your browser:

```bash
# Chrome
python3 youtube_downloader.py --cookies-from-browser chrome "VIDEO_URL"

# Firefox
python3 youtube_downloader.py --cookies-from-browser firefox "VIDEO_URL"

# Other supported browsers: brave, chromium, edge, opera, safari, vivaldi
```

**Note**: Make sure the browser is closed when using `--cookies-from-browser`, or it may fail to read the cookies.

## Rich TUI Features

When optional dependencies are installed, the tool automatically enables Rich TUI mode with enhanced features:

### Clipboard URL Detection

The tool can automatically detect video URLs in your clipboard:

1. Copy a video URL to your clipboard
2. Run the script in interactive mode
3. The tool will detect the URL and ask if you want to use it
4. Confirm to skip manual URL entry

This works across all supported sites and makes downloading multiple videos much faster!

### Beautiful Format Tables

Instead of plain text output, formats are displayed in beautiful, color-coded tables:

- **Combined formats**: Show video+audio formats with resolution, filesize, and codecs
- **Video-only formats**: Display video formats with quality details
- **Audio-only formats**: List audio formats with bitrate information
- **Special options**: Clearly highlighted preset options (best, high, mp3, mp4, etc.)

### Fuzzy Search for Format Selection

Don't remember the exact format ID? No problem! The fuzzy search feature helps you:

- Type a partial match (e.g., "1080" to find 1080p formats)
- Search by codec (e.g., "h264" or "vp9")
- Search by extension (e.g., "mp4" or "webm")
- Get smart suggestions when your input doesn't match exactly

Example:
```
Enter format selection: 1080
🔍 Did you mean: 137 (1920x1080 video)?
Use this format? (Y/n)
```

### Graceful Fallback

If optional dependencies aren't installed, the tool automatically falls back to standard CLI mode with all core functionality intact. This ensures compatibility across all environments.

## Format Options

### Video Download Formats

These format options work with all supported sites:

- `best` - Best quality video+audio combination
- `bestvideo` - Best video quality only
- `bestaudio` - Best audio quality only
- `high` - Best video and audio streams merged (requires FFmpeg)
- `mp3` - Convert to MP3 audio (requires FFmpeg)
- `mp4` - Download as MP4 video
- Or use specific format IDs shown in the format list

### Audio Conversion Formats

Supported input formats:
- MP3, M4A, WAV, FLAC, OGG, AAC, WMA

Supported output formats:
- **MP3** - MPEG Audio Layer 3 (Lossy, good compatibility)
- **AAC** - Advanced Audio Coding (Lossy, better quality than MP3 at same bitrate)
- **M4A** - MPEG-4 Audio (AAC in M4A container)
- **OGG** - Ogg Vorbis (Lossy, open format)
- **WAV** - Waveform Audio (Lossless, large file size)
- **FLAC** - Free Lossless Audio Codec (Lossless, compressed)

### Quality and File Size

The audio converter provides:
- **Quality estimation** based on codec and bitrate
- **Input file size** display
- **Estimated output file size** before conversion
- **Custom bitrate selection** for lossy formats (MP3, AAC, OGG)
- **Size comparison** showing increase/decrease in file size

## Default Download Location

Videos are saved to `~/youtube_downloads/` by default. You can specify a custom directory with the `-o` flag.

## Disclaimer

This tool is for personal and educational use only. Please respect copyright laws and the Terms of Service of the sites you download from. Only download videos you have permission to download.
