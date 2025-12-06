# YouTube Video Downloader & Audio Converter

A command-line tool to download YouTube videos locally and convert audio files between different formats with quality selection and format conversion options.

## Features

- **YouTube Video Download**: Download YouTube videos with quality selection
- **Playlist & Channel Download**: Download entire playlists or channels with automatic ordering
- **Incremental Sync**: Skip already-downloaded videos for efficient playlist updates
- **Cookies Support**: Access age-restricted and region-limited content using cookies
- **Audio Format Conversion**: Convert audio files between popular formats (MP3, M4A, WAV, FLAC, OGG, AAC)
- **Interactive Menu**: Choose between video download and audio conversion
- **Quality Selection**: Choose from available video qualities and formats
- **Format Support**: Download as MP4, convert to MP3, or use original formats
- **Size & Quality Estimation**: View estimated file sizes and quality before conversion
- **Metadata Display**: View video information before downloading
- **Progress Tracking**: Real-time download progress with speed and ETA
- **Auto-Install**: Automatically attempts to install required dependencies
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Quick Start

### Interactive Mode (Recommended)

1. **Download the script** and save it as `youtube_downloader.py`

2. **Run the script**:
   ```bash
   python3 youtube_downloader.py
   ```

3. **Choose your operation**:
   - Press **1** to download a YouTube video
   - Press **2** to convert an audio file
   - Press **3** to exit

### YouTube Video Download

When you select option 1:
1. Enter a YouTube URL (video, playlist, or channel) when prompted
2. View video/playlist information and available formats
3. Select your preferred format
4. Videos will be downloaded to `~/youtube_downloads/`
5. For playlists:
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

### YouTube Video Download

```bash
# Basic usage - single video
python3 youtube_downloader.py "https://youtube.com/watch?v=VIDEO_ID"

# Download a playlist
python3 youtube_downloader.py "https://youtube.com/playlist?list=PLAYLIST_ID"

# Download from a channel
python3 youtube_downloader.py "https://youtube.com/channel/CHANNEL_ID"
python3 youtube_downloader.py "https://youtube.com/@username"

# Convert to MP3
python3 youtube_downloader.py --mp3 "https://youtube.com/watch?v=VIDEO_ID"

# Download as MP4
python3 youtube_downloader.py --mp4 "https://youtube.com/watch?v=VIDEO_ID"

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

## Format Options

### YouTube Download Formats

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

This tool is for personal and educational use only. Please respect copyright laws and YouTube's Terms of Service. Only download videos you have permission to download.
