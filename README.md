# YouTube Video Downloader & Audio Converter

A command-line tool to download YouTube videos locally and convert audio files between different formats with quality selection and format conversion options.

## Features

- **YouTube Video Download**: Download YouTube videos with quality selection
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
1. Enter a YouTube URL when prompted
2. View video information and available formats
3. Select your preferred format
4. Video will be downloaded to `~/youtube_downloads/`

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
