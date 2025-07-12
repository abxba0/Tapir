# YouTube Video Downloader

A command-line tool to download YouTube videos locally with quality selection and format conversion options.

## Features

- **Quality Selection**: Choose from available video qualities and formats
- **Format Support**: Download as MP4, convert to MP3, or use original formats
- **Metadata Display**: View video information before downloading
- **Progress Tracking**: Real-time download progress with speed and ETA
- **Auto-Install**: Automatically attempts to install required dependencies
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Quick Start

1. **Download the script** and save it as `youtube_downloader.py`

2. **Run the script**:
   ```bash
   python3 youtube_downloader.py
   ```

3. **Enter a YouTube URL** when prompted

4. **Select your preferred format** from the displayed options

## Command Line Usage

```bash
# Basic usage
python3 youtube_downloader.py "https://youtube.com/watch?v=VIDEO_ID"

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
```

## Dependencies

The script will automatically attempt to install required dependencies:

- **yt-dlp**: For downloading videos (auto-installed via pip)
- **FFmpeg**: For format conversion and high-quality downloads (manual installation required)

### Installing FFmpeg

- **Windows**: Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add to PATH
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` (Ubuntu/Debian) or equivalent for your distro

## Format Options

- `best` - Best quality video+audio combination
- `bestvideo` - Best video quality only
- `bestaudio` - Best audio quality only
- `high` - Best video and audio streams merged (requires FFmpeg)
- `mp3` - Convert to MP3 audio (requires FFmpeg)
- `mp4` - Download as MP4 video
- Or use specific format IDs shown in the format list

## Default Download Location

Videos are saved to `~/youtube_downloads/` by default. You can specify a custom directory with the `-o` flag.

## Disclaimer

This tool is for personal and educational use only. Please respect copyright laws and YouTube's Terms of Service. Only download videos you have permission to download.
