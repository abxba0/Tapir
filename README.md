# Multi-Site Video Downloader & Audio Converter

A command-line tool to download videos from **YouTube, Vimeo, SoundCloud, and 1800+ other sites** locally and convert audio files between different formats with quality selection and format conversion options.

## Features

- **🌐 Multi-Site Support**: Download from YouTube, Vimeo, SoundCloud, Dailymotion, Twitch, TikTok, Bandcamp, and 1800+ sites
- **📺 Video Download**: Download videos with quality selection from any supported site
- **📝 Playlist & Channel Download**: Download entire playlists or channels with automatic ordering
- **🔄 Incremental Sync**: Skip already-downloaded videos for efficient playlist updates
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
