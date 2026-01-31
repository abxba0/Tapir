#!/usr/bin/env python3
"""
Multi-Site Video Downloader & Transcriber

A command-line tool to download videos from YouTube, Vimeo, SoundCloud,
and 1800+ other sites, with audio format conversion and media transcription capabilities.
Uses yt-dlp library for downloading videos with format selection.
Uses FFmpeg for audio format conversion.
Uses OpenAI Whisper for speech-to-text transcription.

Features:
- Multi-site support (YouTube, Vimeo, SoundCloud, Dailymotion, Twitch, TikTok, and more)
- Parallel downloads with configurable worker pools
- Bulk processing from files or standard input
- Quality selection
- Multiple format support (MP4, MP3, etc.)
- Audio format conversion
- Playlist and channel downloads
- Metadata display
- Download progress tracking
- File size and quality estimation
- Media transcription from URLs (YouTube, Instagram, etc.) or local files
- Subtitle extraction from online videos when available
- Speech-to-text using OpenAI Whisper with multiple model sizes
- Transcription output in TXT, SRT, and VTT formats
- Fully offline functionality after initial setup
"""

import argparse
import os
import sys
import re
import subprocess
import json
import platform
import time
import shutil
import shlex
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
import threading
import copy

# Try to import TUI libraries (optional)
try:
    from rich.console import Console
    from rich.table import Table
    from rich.progress import Progress, BarColumn, DownloadColumn, TransferSpeedColumn, TimeRemainingColumn, TaskID
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich import print as rprint
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

try:
    import pyperclip
    CLIPBOARD_AVAILABLE = True
except ImportError:
    CLIPBOARD_AVAILABLE = False

try:
    from thefuzz import fuzz, process
    FUZZY_AVAILABLE = True
except ImportError:
    FUZZY_AVAILABLE = False

try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False

# Version information
VERSION = "5.0.0"
VERSION_DATE = "2026-01-31"

# Timeout for subprocess calls (in seconds)
SUBPROCESS_TIMEOUT = 120

# UI constants
MENU_RETRY_DELAY = 1  # Seconds to wait before re-displaying menu on invalid input

# Fuzzy search constants
FUZZY_MATCH_THRESHOLD_SPECIAL = 70  # Threshold for matching special options (best, high, etc.)
FUZZY_MATCH_THRESHOLD_FORMATS = 60  # Threshold for matching format IDs and properties

# Parallelization constants
DEFAULT_MAX_WORKERS = 3  # Default number of concurrent downloads
MAX_WORKERS_LIMIT = 10   # Maximum allowed concurrent downloads

# Check if yt-dlp is installed, if not try to install it
def check_dependencies():
    yt_dlp_installed = False
    ffmpeg_installed = False
    
    # Check for yt-dlp
    try:
        import yt_dlp
        yt_dlp_installed = True
    except ImportError:
        print("yt-dlp is not installed. Attempting to install it now...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "yt-dlp"])
            print("yt-dlp successfully installed!")
            yt_dlp_installed = True
        except subprocess.CalledProcessError:
            print("Failed to install yt-dlp. Please install it manually with: pip install yt-dlp")
    
    # Check for ffmpeg
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        print(f"Found FFmpeg at: {ffmpeg_path}")
        ffmpeg_installed = True
    else:
        print("FFmpeg is not installed. High quality and format merging options require FFmpeg.")
        
        # Attempt to get FFmpeg
        if platform.system() == "Windows":
            print("\nTo install FFmpeg on Windows:")
            print("1. Download from https://www.gyan.dev/ffmpeg/builds/ (ffmpeg-release-essentials.zip)")
            print("2. Extract the zip file")
            print("3. Add the bin folder to your PATH environment variable")
            
            install_choice = input("\nWould you like to open the FFmpeg download page? (y/n): ").strip().lower()
            if install_choice == 'y':
                import webbrowser
                webbrowser.open("https://www.gyan.dev/ffmpeg/builds/")
                
        elif platform.system() == "Darwin":  # macOS
            print("\nTo install FFmpeg on macOS:")
            print("1. Install Homebrew (if not already installed) from https://brew.sh/")
            print("2. Run: brew install ffmpeg")
            
            install_choice = input("\nWould you like to attempt installing FFmpeg via Homebrew? (y/n): ").strip().lower()
            if install_choice == 'y':
                try:
                    subprocess.check_call(["brew", "install", "ffmpeg"])
                    print("FFmpeg installed successfully!")
                    ffmpeg_installed = True
                except:
                    print("Failed to install FFmpeg via Homebrew.")
                    
        elif platform.system() == "Linux":
            print("\nTo install FFmpeg on Linux:")
            print("For Ubuntu/Debian: sudo apt-get install ffmpeg")
            print("For Fedora: sudo dnf install ffmpeg")
            print("For Arch Linux: sudo pacman -S ffmpeg")
            
            install_choice = input("\nWould you like to attempt installing FFmpeg now? (y/n): ").strip().lower()
            if install_choice == 'y':
                try:
                    # Try to detect the package manager and install
                    if os.path.exists("/usr/bin/apt"):
                        subprocess.check_call(["sudo", "apt-get", "install", "-y", "ffmpeg"])
                    elif os.path.exists("/usr/bin/dnf"):
                        subprocess.check_call(["sudo", "dnf", "install", "-y", "ffmpeg"])
                    elif os.path.exists("/usr/bin/pacman"):
                        subprocess.check_call(["sudo", "pacman", "-S", "--noconfirm", "ffmpeg"])
                    else:
                        print("Could not detect package manager. Please install FFmpeg manually.")
                        return yt_dlp_installed, False
                        
                    print("FFmpeg installed successfully!")
                    ffmpeg_installed = True
                except:
                    print("Failed to install FFmpeg.")
        
        # Check again after install attempt
        if not ffmpeg_installed:
            ffmpeg_path = shutil.which("ffmpeg")
            if ffmpeg_path:
                print(f"Found FFmpeg at: {ffmpeg_path}")
                ffmpeg_installed = True
    
    return yt_dlp_installed, ffmpeg_installed

# Get supported popular sites from yt-dlp
def get_supported_sites():
    """Return a dictionary of popular video sites supported by yt-dlp"""
    return {
        'youtube': {
            'name': 'YouTube',
            'description': 'YouTube videos, playlists, and channels',
            'example': 'https://youtube.com/watch?v=VIDEO_ID'
        },
        'vimeo': {
            'name': 'Vimeo',
            'description': 'Vimeo videos',
            'example': 'https://vimeo.com/VIDEO_ID'
        },
        'soundcloud': {
            'name': 'SoundCloud',
            'description': 'SoundCloud tracks and playlists',
            'example': 'https://soundcloud.com/artist/track'
        },
        'dailymotion': {
            'name': 'Dailymotion',
            'description': 'Dailymotion videos',
            'example': 'https://dailymotion.com/video/VIDEO_ID'
        },
        'twitch': {
            'name': 'Twitch',
            'description': 'Twitch videos and clips',
            'example': 'https://twitch.tv/videos/VIDEO_ID'
        },
        'bandcamp': {
            'name': 'Bandcamp',
            'description': 'Bandcamp tracks and albums',
            'example': 'https://artist.bandcamp.com/track/track-name'
        },
        'tiktok': {
            'name': 'TikTok',
            'description': 'TikTok videos',
            'example': 'https://tiktok.com/@user/video/VIDEO_ID'
        },
        'other': {
            'name': 'Other/Direct URL',
            'description': 'Any URL supported by yt-dlp (1800+ sites)',
            'example': 'https://example.com/video'
        }
    }

# Detect which site a URL belongs to
def detect_site(url):
    """Detect which site a URL belongs to based on domain"""
    # Parse the URL to extract the hostname
    try:
        parsed = urlparse(url.lower())
        hostname = parsed.netloc or parsed.path.split('/')[0]
        
        # Remove 'www.' prefix if present
        if hostname.startswith('www.'):
            hostname = hostname[4:]
        
        # Check for popular sites by exact domain match or subdomain
        if hostname == 'youtube.com' or hostname.endswith('.youtube.com') or hostname == 'youtu.be':
            return 'youtube'
        elif hostname == 'vimeo.com' or hostname.endswith('.vimeo.com'):
            return 'vimeo'
        elif hostname == 'soundcloud.com' or hostname.endswith('.soundcloud.com'):
            return 'soundcloud'
        elif hostname == 'dailymotion.com' or hostname.endswith('.dailymotion.com'):
            return 'dailymotion'
        elif hostname == 'twitch.tv' or hostname.endswith('.twitch.tv'):
            return 'twitch'
        elif hostname.endswith('.bandcamp.com') or hostname == 'bandcamp.com':
            return 'bandcamp'
        elif hostname == 'tiktok.com' or hostname.endswith('.tiktok.com'):
            return 'tiktok'
        else:
            return 'other'
    except Exception:
        # If URL parsing fails, return 'other'
        return 'other'

# Get URL from clipboard if available
def get_clipboard_url():
    """Try to get a URL from the clipboard"""
    if not CLIPBOARD_AVAILABLE:
        return None
    
    try:
        clipboard_content = pyperclip.paste()
        if clipboard_content and isinstance(clipboard_content, str):
            # Check if clipboard contains a URL
            clipboard_content = clipboard_content.strip()
            if clipboard_content.startswith(('http://', 'https://', 'www.')):
                return clipboard_content
    except Exception:
        pass
    
    return None

# Validate URL using yt-dlp (supports all sites)
def is_valid_url(url):
    """
    Validate if URL is supported by yt-dlp.
    This is a generic validator that works with all 1800+ sites supported by yt-dlp.
    """
    import yt_dlp
    
    # Basic URL format check
    if not url or not isinstance(url, str):
        return False
    
    # Check if it looks like a URL
    if not url.startswith(('http://', 'https://', 'www.')):
        # Could be a short form URL, let yt-dlp decide
        if '.' not in url:
            return False
    
    # Try to extract info (without downloading) to validate
    # This is the most reliable way to check if yt-dlp supports the URL
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'simulate': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Just checking if extraction is possible
            ydl.extract_info(url, download=False, process=False)
            return True
    except Exception:
        return False

# Validate YouTube URL (including playlists and channels)
# Kept for backward compatibility and faster YouTube-specific validation
def is_valid_youtube_url(url):
    # Fixed the escape sequences in regex patterns
    youtube_regex = (
        r'(https?://)?(www\.)?'
        r'(youtube|youtu|youtube-nocookie)\.(com|be)/'
        r'(watch\?v=|embed/|v/|.+\?v=)?([^&=%?]{11})'
    )
    youtube_regex_match = re.match(youtube_regex, url)
    
    if youtube_regex_match:
        return True
    
    # Check for YouTube Shorts URLs
    shorts_regex = r'(https?://)?(www\.)?youtube\.com/shorts/([^&=%?]{11})'
    shorts_regex_match = re.match(shorts_regex, url)
    
    if shorts_regex_match:
        return True
    
    # Check for YouTube Playlist URLs
    playlist_regex = r'(https?://)?(www\.)?youtube\.com/(playlist\?list=|watch\?.*&list=)'
    playlist_regex_match = re.match(playlist_regex, url)
    
    if playlist_regex_match:
        return True
    
    # Check for YouTube Channel URLs
    channel_regex = r'(https?://)?(www\.)?youtube\.com/(channel/|c/|user/|@)'
    channel_regex_match = re.match(channel_regex, url)
    
    if channel_regex_match:
        return True
        
    return False

# Extract video information using yt-dlp
def get_video_info(url, cookies_file=None, cookies_from_browser=None):
    import yt_dlp
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'simulate': True,
        'forcejson': True,
    }
    
    # Add cookies support
    if cookies_file:
        ydl_opts['cookiefile'] = cookies_file
    elif cookies_from_browser:
        ydl_opts['cookiesfrombrowser'] = (cookies_from_browser,)
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info
    except yt_dlp.utils.DownloadError as e:
        print(f"Error: {e}")
        return None

# Display video information and available formats
def display_video_info(info, is_playlist=False):
    if not info:
        return
    
    if RICH_AVAILABLE:
        display_video_info_rich(info, is_playlist)
    else:
        display_video_info_standard(info, is_playlist)

# Display video info using Rich
def display_video_info_rich(info, is_playlist=False):
    console = Console()
    
    # Handle playlist info
    if is_playlist or info.get('_type') in ['playlist', 'multi_video']:
        panel_content = []
        panel_content.append(f"[bold cyan]Playlist:[/bold cyan] {info.get('title', 'Unknown')}")
        panel_content.append(f"[bold yellow]Channel:[/bold yellow] {info.get('channel', info.get('uploader', 'Unknown'))}")
        
        entries_count = len(info.get('entries', []))
        panel_content.append(f"[bold green]Number of videos:[/bold green] {entries_count}")
        
        if info.get('description'):
            desc = info['description']
            if len(desc) > 150:
                desc = desc[:147] + "..."
            panel_content.append(f"[bold]Description:[/bold] {desc}")
        
        console.print(Panel("\n".join(panel_content), title="📋 Playlist Information", border_style="cyan"))
        return
    
    # Handle single video info
    panel_content = []
    panel_content.append(f"[bold cyan]Title:[/bold cyan] {info.get('title', 'Unknown')}")
    panel_content.append(f"[bold yellow]Channel:[/bold yellow] {info.get('channel', 'Unknown')}")
    panel_content.append(f"[bold green]Duration:[/bold green] {format_duration(info.get('duration', 0))}")
    panel_content.append(f"[bold blue]Upload Date:[/bold blue] {info.get('upload_date', 'Unknown')}")
    panel_content.append(f"[bold magenta]Views:[/bold magenta] {format_count(info.get('view_count', 0))}")
    
    if info.get('description'):
        desc = info['description']
        if len(desc) > 150:
            desc = desc[:147] + "..."
        panel_content.append(f"[bold]Description:[/bold] {desc}")
    
    console.print(Panel("\n".join(panel_content), title="📺 Video Information", border_style="cyan"))

# Display video info using standard output
def display_video_info_standard(info, is_playlist=False):
    # Handle playlist info
    if is_playlist or info.get('_type') in ['playlist', 'multi_video']:
        print("\n" + "="*80)
        print(f"Playlist: {info.get('title', 'Unknown')}")
        print(f"Channel: {info.get('channel', info.get('uploader', 'Unknown'))}")
        
        entries_count = len(info.get('entries', []))
        print(f"Number of videos: {entries_count}")
        
        if info.get('description'):
            desc = info['description']
            if len(desc) > 150:
                desc = desc[:147] + "..."
            print(f"Description: {desc}")
        
        print("="*80)
        return
    
    # Handle single video info
    print("\n" + "="*80)
    print(f"Title: {info.get('title', 'Unknown')}")
    print(f"Channel: {info.get('channel', 'Unknown')}")
    print(f"Duration: {format_duration(info.get('duration', 0))}")
    print(f"Upload Date: {info.get('upload_date', 'Unknown')}")
    print(f"Views: {format_count(info.get('view_count', 0))}")
    
    if info.get('description'):
        desc = info['description']
        if len(desc) > 150:
            desc = desc[:147] + "..."
        print(f"Description: {desc}")
    
    print("="*80)

# Format duration from seconds to HH:MM:SS
def format_duration(seconds):
    if not seconds:
        return "Unknown"
    
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    
    if hours > 0:
        return f"{int(hours)}:{int(minutes):02d}:{int(seconds):02d}"
    else:
        return f"{int(minutes):02d}:{int(seconds):02d}"

# Format large numbers with commas
def format_count(count):
    return f"{count:,}" if count else "Unknown"

# Fuzzy search for format selection
def fuzzy_search_format(query, all_formats, special_options=None):
    """
    Use fuzzy matching to find the best format match from user query.
    Supports searching by resolution, extension, codec, or format ID.
    """
    if not FUZZY_AVAILABLE:
        return None
    
    if special_options is None:
        special_options = ['best', 'bestvideo', 'bestaudio', 'high', 'mp3', 'mp4']
    
    # First check if it's a special option
    special_match = process.extractOne(query, special_options, scorer=fuzz.ratio)
    if special_match and special_match[1] >= FUZZY_MATCH_THRESHOLD_SPECIAL:
        return special_match[0]
    
    # Build searchable strings for each format
    searchable_formats = []
    for f in all_formats:
        format_id = f.get('format_id', '')
        ext = f.get('ext', '')
        height = f.get('height', 0)
        resolution = f"{height}p" if height and height > 0 else ""
        vcodec = f.get('vcodec', '')
        acodec = f.get('acodec', '')
        
        # Create searchable string
        search_str = f"{format_id} {ext} {resolution} {vcodec} {acodec}"
        searchable_formats.append((search_str, format_id))
    
    # Perform fuzzy search
    if searchable_formats:
        match = process.extractOne(query, [s[0] for s in searchable_formats], scorer=fuzz.partial_ratio)
        if match and match[1] >= FUZZY_MATCH_THRESHOLD_FORMATS:
            # Find the format_id corresponding to the matched string
            for search_str, format_id in searchable_formats:
                if search_str == match[0]:
                    return format_id
    
    return None

# Display available formats for selection using Rich tables
def display_formats_rich(info, ffmpeg_available=True):
    """Display formats using Rich tables for better visualization"""
    if not info or 'formats' not in info:
        if RICH_AVAILABLE:
            console = Console()
            console.print("[red]No format information available.[/red]")
        else:
            print("No format information available.")
        return []
    
    console = Console()
    formats = info['formats']
    
    # Group formats by type
    video_formats = []
    audio_formats = []
    combined_formats = []
    
    for f in formats:
        if f.get('vcodec') != 'none' and f.get('acodec') != 'none':
            combined_formats.append(f)
        elif f.get('vcodec') != 'none':
            video_formats.append(f)
        elif f.get('acodec') != 'none':
            audio_formats.append(f)
    
    # Sort formats by quality
    video_formats.sort(key=lambda x: (x.get('height', 0) or 0, x.get('tbr', 0) or 0), reverse=True)
    audio_formats.sort(key=lambda x: x.get('tbr', 0) or 0, reverse=True)
    combined_formats.sort(key=lambda x: (x.get('height', 0) or 0, x.get('tbr', 0) or 0), reverse=True)
    
    all_formats = []
    
    # Display combined formats (video+audio)
    if combined_formats:
        table = Table(title="Combined Video+Audio Formats", show_header=True, header_style="bold magenta")
        table.add_column("ID", style="cyan", width=8)
        table.add_column("Extension", style="green", width=12)
        table.add_column("Resolution", style="yellow", width=12)
        table.add_column("Filesize", style="blue", width=15)
        table.add_column("Codec", style="white", width=25)
        
        for f in combined_formats:
            format_id = f.get('format_id', 'N/A')
            ext = f.get('ext', 'N/A')
            height = f.get('height')
            resolution = f"{height}p" if height and height > 0 else "N/A"
            
            filesize = f.get('filesize') or f.get('filesize_approx')
            filesize_str = format_size(filesize) if filesize else "Unknown"
            
            vcodec = f.get('vcodec', 'N/A')
            acodec = f.get('acodec', 'N/A')
            codec = f"{vcodec}/{acodec}"
            
            table.add_row(format_id, ext, resolution, filesize_str, codec)
            all_formats.append(f)
        
        console.print(table)
    
    # Display video-only formats
    if video_formats:
        table = Table(title="Video-Only Formats", show_header=True, header_style="bold magenta")
        table.add_column("ID", style="cyan", width=8)
        table.add_column("Extension", style="green", width=12)
        table.add_column("Resolution", style="yellow", width=12)
        table.add_column("Filesize", style="blue", width=15)
        table.add_column("Codec", style="white", width=25)
        
        for f in video_formats:
            format_id = f.get('format_id', 'N/A')
            ext = f.get('ext', 'N/A')
            height = f.get('height')
            resolution = f"{height}p" if height and height > 0 else "N/A"
            
            filesize = f.get('filesize') or f.get('filesize_approx')
            filesize_str = format_size(filesize) if filesize else "Unknown"
            
            codec = f.get('vcodec', 'N/A')
            
            table.add_row(format_id, ext, resolution, filesize_str, codec)
            all_formats.append(f)
        
        console.print(table)
    
    # Display audio-only formats
    if audio_formats:
        table = Table(title="Audio-Only Formats", show_header=True, header_style="bold magenta")
        table.add_column("ID", style="cyan", width=8)
        table.add_column("Extension", style="green", width=12)
        table.add_column("Bitrate", style="yellow", width=12)
        table.add_column("Filesize", style="blue", width=15)
        table.add_column("Codec", style="white", width=25)
        
        for f in audio_formats:
            format_id = f.get('format_id', 'N/A')
            ext = f.get('ext', 'N/A')
            
            abr = f.get('abr')
            bitrate = f"{int(abr)}kbps" if abr else "Unknown"
            
            filesize = f.get('filesize') or f.get('filesize_approx')
            filesize_str = format_size(filesize) if filesize else "Unknown"
            
            codec = f.get('acodec', 'N/A')
            
            table.add_row(format_id, ext, bitrate, filesize_str, codec)
            all_formats.append(f)
        
        console.print(table)
    
    # Display special options
    special_table = Table(title="Special Format Options", show_header=True, header_style="bold green")
    special_table.add_column("Option", style="cyan", width=12)
    special_table.add_column("Description", style="white", width=60)
    
    special_table.add_row("best", "Best quality (video+audio)")
    special_table.add_row("bestvideo", "Best video only")
    special_table.add_row("bestaudio", "Best audio only")
    
    if ffmpeg_available:
        special_table.add_row("high", "High quality video+audio (selects best separate streams and combines them)")
        special_table.add_row("mp3", "Convert to MP3 audio")
    else:
        special_table.add_row("high", "[REQUIRES FFMPEG] High quality video+audio")
        special_table.add_row("mp3", "[REQUIRES FFMPEG] Convert to MP3 audio")
    
    special_table.add_row("mp4", "Download as MP4 video")
    
    console.print(special_table)
    
    return all_formats

# Display available formats for selection
def display_formats(info, ffmpeg_available=True):
    if not info or 'formats' not in info:
        print("No format information available.")
        return []
    
    formats = info['formats']
    
    # Group formats by type
    video_formats = []
    audio_formats = []
    combined_formats = []
    
    for f in formats:
        if f.get('vcodec') != 'none' and f.get('acodec') != 'none':
            combined_formats.append(f)
        elif f.get('vcodec') != 'none':
            video_formats.append(f)
        elif f.get('acodec') != 'none':
            audio_formats.append(f)
    
    # Sort formats by quality
    video_formats.sort(key=lambda x: (x.get('height', 0) or 0, x.get('tbr', 0) or 0), reverse=True)
    audio_formats.sort(key=lambda x: x.get('tbr', 0) or 0, reverse=True)
    combined_formats.sort(key=lambda x: (x.get('height', 0) or 0, x.get('tbr', 0) or 0), reverse=True)
    
    all_formats = []
    
    # Print combined formats (video+audio)
    if combined_formats:
        print("\nCombined Video+Audio Formats:")
        print(f"{'ID':<6} {'Extension':<10} {'Resolution':<15} {'Filesize':<15} {'Codec':<20}")
        print("-"*70)
        
        for i, f in enumerate(combined_formats):
            format_id = f.get('format_id', 'N/A')
            ext = f.get('ext', 'N/A')
            resolution = f"{f.get('height', 'N/A')}p"
            
            # Get estimated file size
            filesize = f.get('filesize')
            if filesize is None:
                filesize = f.get('filesize_approx')
            
            if filesize:
                filesize_str = format_size(filesize)
            else:
                filesize_str = "Unknown"
            
            vcodec = f.get('vcodec', 'N/A')
            acodec = f.get('acodec', 'N/A')
            codec = f"{vcodec}/{acodec}"
            if len(codec) > 19:
                codec = codec[:16] + "..."
            
            print(f"{format_id:<6} {ext:<10} {resolution:<15} {filesize_str:<15} {codec:<20}")
            all_formats.append(f)
    
    # Print video-only formats
    if video_formats:
        print("\nVideo-Only Formats:")
        print(f"{'ID':<6} {'Extension':<10} {'Resolution':<15} {'Filesize':<15} {'Codec':<20}")
        print("-"*70)
        
        for i, f in enumerate(video_formats):
            format_id = f.get('format_id', 'N/A')
            ext = f.get('ext', 'N/A')
            resolution = f"{f.get('height', 'N/A')}p"
            
            # Get estimated file size
            filesize = f.get('filesize')
            if filesize is None:
                filesize = f.get('filesize_approx')
            
            if filesize:
                filesize_str = format_size(filesize)
            else:
                filesize_str = "Unknown"
            
            codec = f.get('vcodec', 'N/A')
            if len(codec) > 19:
                codec = codec[:16] + "..."
            
            print(f"{format_id:<6} {ext:<10} {resolution:<15} {filesize_str:<15} {codec:<20}")
            all_formats.append(f)
    
    # Print audio-only formats
    if audio_formats:
        print("\nAudio-Only Formats:")
        print(f"{'ID':<6} {'Extension':<10} {'Bitrate':<15} {'Filesize':<15} {'Codec':<20}")
        print("-"*70)
        
        for i, f in enumerate(audio_formats):
            format_id = f.get('format_id', 'N/A')
            ext = f.get('ext', 'N/A')
            
            # Get audio bitrate
            abr = f.get('abr')
            if abr:
                bitrate = f"{int(abr)}kbps"
            else:
                bitrate = "Unknown"
            
            # Get estimated file size
            filesize = f.get('filesize')
            if filesize is None:
                filesize = f.get('filesize_approx')
            
            if filesize:
                filesize_str = format_size(filesize)
            else:
                filesize_str = "Unknown"
            
            codec = f.get('acodec', 'N/A')
            if len(codec) > 19:
                codec = codec[:16] + "..."
            
            print(f"{format_id:<6} {ext:<10} {bitrate:<15} {filesize_str:<15} {codec:<20}")
            all_formats.append(f)
    
    # Add special options
    print("\nSpecial Format Options:")
    print("best       - Best quality (video+audio)")
    print("bestvideo  - Best video only")
    print("bestaudio  - Best audio only")
    
    if ffmpeg_available:
        print("high       - High quality video+audio (selects best separate streams and combines them)")
        print("mp3        - Convert to MP3 audio")
    else:
        print("high       - [REQUIRES FFMPEG] High quality video+audio")
        print("mp3        - [REQUIRES FFMPEG] Convert to MP3 audio")
        
    print("mp4        - Download as MP4 video")
    
    return all_formats

# Format file size in human-readable format
def format_size(size_bytes):
    if size_bytes == 0:
        return "0B"
    
    size_names = ("B", "KB", "MB", "GB", "TB")
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024
        i += 1
    
    return f"{size_bytes:.2f} {size_names[i]}"

# Get a safe download directory
def get_download_directory(specified_dir="youtube_downloads"):
    # If path is absolute, use it directly
    if os.path.isabs(specified_dir):
        download_dir = specified_dir
    else:
        # Otherwise, use a directory in the user's home folder
        download_dir = os.path.join(str(Path.home()), specified_dir)
    
    # Ensure the directory exists
    try:
        os.makedirs(download_dir, exist_ok=True)
        # Test write permissions
        test_file = os.path.join(download_dir, "test_write_permission")
        with open(test_file, 'w') as f:
            f.write("test")
        os.remove(test_file)
        return download_dir
    except (PermissionError, OSError):
        # Fallback to a directory in the current working directory
        try:
            alt_dir = os.path.join(os.getcwd(), specified_dir)
            os.makedirs(alt_dir, exist_ok=True)
            return alt_dir
        except (PermissionError, OSError):
            # Last resort: use a temp directory
            import tempfile
            temp_dir = os.path.join(tempfile.gettempdir(), "youtube_downloads")
            os.makedirs(temp_dir, exist_ok=True)
            print(f"Warning: Using temporary directory for downloads: {temp_dir}")
            return temp_dir

# Download video with selected format
def download_video(url, format_selection, output_dir="youtube_downloads", ffmpeg_available=True, 
                   cookies_file=None, cookies_from_browser=None, is_playlist=False, archive_file=None):
    import yt_dlp
    
    # Get a safe download directory with proper permissions
    safe_output_dir = get_download_directory(output_dir)
    print(f"Using download directory: {safe_output_dir}")
    
    # Set output template - preserve playlist order if it's a playlist
    if is_playlist:
        output_template = os.path.join(safe_output_dir, '%(playlist_index)03d - %(title)s.%(ext)s')
    else:
        output_template = os.path.join(safe_output_dir, '%(title)s.%(ext)s')
    
    # Configure yt-dlp options
    ydl_opts = {
        'format': format_selection,
        'outtmpl': output_template,
        'progress_hooks': [progress_hook],
        'quiet': False,
        'no_warnings': True,
        'ignoreerrors': is_playlist,  # Continue on errors for playlists
    }
    
    # Add cookies support
    if cookies_file:
        ydl_opts['cookiefile'] = cookies_file
        print(f"Using cookies from file: {cookies_file}")
    elif cookies_from_browser:
        ydl_opts['cookiesfrombrowser'] = (cookies_from_browser,)
        print(f"Using cookies from browser: {cookies_from_browser}")
    
    # Add archive file support for incremental downloads
    if archive_file:
        ydl_opts['download_archive'] = archive_file
        print(f"Using download archive: {archive_file}")
    elif is_playlist:
        # Always use archive for playlists to enable incremental sync
        default_archive = os.path.join(safe_output_dir, '.yt-dlp-archive.txt')
        ydl_opts['download_archive'] = default_archive
        print(f"Using default archive file: {default_archive}")
    
    # Handle special format cases
    if format_selection == 'mp3':
        if not ffmpeg_available:
            print("Error: FFmpeg is required for MP3 conversion. Please install FFmpeg and try again.")
            print("Falling back to best audio format without conversion.")
            ydl_opts.update({
                'format': 'bestaudio/best',
            })
        else:
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
    elif format_selection == 'mp4':
        if ffmpeg_available:
            ydl_opts.update({
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            })
        else:
            ydl_opts.update({
                'format': 'best[ext=mp4]/best',
            })
    elif format_selection == 'high':
        if not ffmpeg_available:
            print("Error: FFmpeg is required for high quality downloads (to merge video and audio).")
            print("Falling back to best available combined format.")
            ydl_opts.update({
                'format': 'best',
            })
        else:
            ydl_opts.update({
                'format': 'bestvideo+bestaudio/best',
                'merge_output_format': 'mp4',
            })
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        return safe_output_dir, True
    except yt_dlp.utils.DownloadError as e:
        print(f"Download error: {e}")
        return safe_output_dir, False

# Progress hook for displaying download progress
def progress_hook(d):
    if d['status'] == 'downloading':
        percent = d.get('_percent_str', 'N/A')
        speed = d.get('_speed_str', 'N/A')
        eta = d.get('_eta_str', 'N/A')
        
        # Use carriage return to update the same line
        sys.stdout.write(f"\rDownloading... {percent} at {speed} ETA: {eta}")
        sys.stdout.flush()
    
    elif d['status'] == 'finished':
        sys.stdout.write('\n')
        print(f"Download finished. Converting...")

# Wait for user input to prevent the console from closing
def wait_for_exit():
    try:
        if platform.system() == "Windows":
            print("\nPress Enter to exit...")
            input()
    except Exception:
        pass

# Get audio file metadata using FFmpeg
def get_audio_metadata(file_path):
    """Extract metadata from audio file using FFprobe (part of FFmpeg)"""
    try:
        # Use shlex.quote to safely handle file paths with special characters
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            file_path  # subprocess.run with list arguments handles this safely
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=SUBPROCESS_TIMEOUT)
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
    except subprocess.TimeoutExpired:
        print(f"Error: FFprobe timed out while analyzing the audio file.")
        return None
    except Exception as e:
        print(f"Error getting audio metadata: {e}")
        return None

# Estimate output file size based on bitrate and duration
def estimate_output_size(duration_seconds, bitrate_kbps):
    """
    Estimate output file size in bytes
    
    Formula: Size (bytes) = (bitrate in kbps * duration in seconds) / 8
    The division by 8 converts bits to bytes (8 bits = 1 byte)
    """
    if not duration_seconds or not bitrate_kbps:
        return None
    
    size_bytes = (bitrate_kbps * 1000 * duration_seconds) / 8
    return int(size_bytes)

# Get quality description based on codec and bitrate
def get_quality_description(codec, bitrate_kbps):
    """Return a quality description based on codec and bitrate"""
    if not bitrate_kbps:
        return "Unknown quality"
    
    codec_lower = codec.lower() if codec else ""
    
    # For lossy formats
    if any(x in codec_lower for x in ['mp3', 'aac', 'vorbis', 'opus']):
        if bitrate_kbps >= 320:
            return "Very High (320kbps)"
        elif bitrate_kbps >= 256:
            return "High (256kbps)"
        elif bitrate_kbps >= 192:
            return "Good (192kbps)"
        elif bitrate_kbps >= 128:
            return "Standard (128kbps)"
        else:
            return f"Low ({bitrate_kbps}kbps)"
    
    # For lossless formats
    if any(x in codec_lower for x in ['flac', 'wav', 'alac', 'pcm']):
        return "Lossless (Original Quality)"
    
    return f"{bitrate_kbps}kbps"

# Get supported audio formats
def get_supported_audio_formats():
    """Return a dictionary of supported audio formats with their properties"""
    return {
        'mp3': {
            'name': 'MP3',
            'description': 'MPEG Audio Layer 3 (Lossy)',
            'default_bitrate': 192,
            'codec': 'libmp3lame'
        },
        'aac': {
            'name': 'AAC',
            'description': 'Advanced Audio Coding (Lossy)',
            'default_bitrate': 192,
            'codec': 'aac'
        },
        'm4a': {
            'name': 'M4A',
            'description': 'MPEG-4 Audio (AAC in M4A container)',
            'default_bitrate': 192,
            'codec': 'aac'
        },
        'ogg': {
            'name': 'OGG',
            'description': 'Ogg Vorbis (Lossy)',
            'default_bitrate': 192,
            'codec': 'libvorbis'
        },
        'wav': {
            'name': 'WAV',
            'description': 'Waveform Audio (Lossless)',
            'default_bitrate': 1411,  # CD quality
            'codec': 'pcm_s16le'
        },
        'flac': {
            'name': 'FLAC',
            'description': 'Free Lossless Audio Codec',
            'default_bitrate': 1000,  # Variable, this is approximate
            'codec': 'flac'
        }
    }

# Convert audio file format
def convert_audio_file(input_file, output_format, bitrate=None):
    """Convert audio file to specified format using FFmpeg"""
    formats = get_supported_audio_formats()
    
    if output_format.lower() not in formats:
        print(f"Error: Unsupported output format '{output_format}'")
        return False
    
    format_info = formats[output_format.lower()]
    
    # Use default bitrate if not specified
    if bitrate is None:
        bitrate = format_info['default_bitrate']
    
    # Construct output filename
    input_path = Path(input_file)
    output_file = input_path.with_suffix(f'.{output_format.lower()}')
    
    # If output file already exists, ask for confirmation
    if output_file.exists():
        response = input(f"\nOutput file '{output_file.name}' already exists. Overwrite? (y/n): ").strip().lower()
        if response != 'y':
            print("Conversion cancelled.")
            return False
    
    print(f"\nConverting '{input_path.name}' to {format_info['name']}...")
    
    # Build FFmpeg command - using list arguments for subprocess.run provides safety
    cmd = ['ffmpeg', '-i', str(input_file)]
    
    # Add codec and bitrate parameters
    if output_format.lower() in ['wav', 'flac']:
        # Lossless formats
        cmd.extend(['-c:a', format_info['codec']])
    else:
        # Lossy formats - apply bitrate
        cmd.extend(['-c:a', format_info['codec'], '-b:a', f'{bitrate}k'])
    
    # Overwrite output file without asking
    cmd.extend(['-y', str(output_file)])
    
    try:
        # Run FFmpeg conversion with timeout
        # Using list arguments instead of shell=True provides protection against injection
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=SUBPROCESS_TIMEOUT)
        
        if result.returncode == 0:
            print(f"\nConversion successful!")
            print(f"Output file: {output_file}")
            print(f"Output size: {format_size(os.path.getsize(output_file))}")
            return True
        else:
            print(f"\nConversion failed!")
            print(f"Error: {result.stderr}")
            return False
    
    except subprocess.TimeoutExpired:
        print(f"\nConversion timed out after {SUBPROCESS_TIMEOUT} seconds.")
        print("The file may be too large or the conversion is taking too long.")
        return False
    except Exception as e:
        print(f"\nConversion error: {e}")
        return False

# =============================================================================
# TRANSCRIPTION FEATURE
# =============================================================================

# Whisper model sizes with descriptions
WHISPER_MODELS = {
    'tiny': {
        'name': 'Tiny',
        'description': 'Fastest, lowest accuracy (~1GB VRAM)',
        'size_mb': 75
    },
    'base': {
        'name': 'Base',
        'description': 'Fast with decent accuracy (~1GB VRAM)',
        'size_mb': 142
    },
    'small': {
        'name': 'Small',
        'description': 'Good balance of speed and accuracy (~2GB VRAM)',
        'size_mb': 466
    },
    'medium': {
        'name': 'Medium',
        'description': 'High accuracy, slower (~5GB VRAM)',
        'size_mb': 1500
    },
    'large': {
        'name': 'Large',
        'description': 'Best accuracy, slowest (~10GB VRAM)',
        'size_mb': 2900
    }
}

# Supported transcription output formats
TRANSCRIPTION_FORMATS = ['txt', 'srt', 'vtt']

# Supported local media extensions for transcription
SUPPORTED_MEDIA_EXTENSIONS = {
    'audio': ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma', '.opus'],
    'video': ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.ts']
}


def is_local_media_file(path):
    """Check if the given path is a local audio or video file"""
    if not os.path.isfile(path):
        return False
    ext = os.path.splitext(path)[1].lower()
    all_extensions = SUPPORTED_MEDIA_EXTENSIONS['audio'] + SUPPORTED_MEDIA_EXTENSIONS['video']
    return ext in all_extensions


def extract_subtitles_from_url(url, output_dir, cookies_file=None, cookies_from_browser=None, language='en'):
    """
    Try to extract existing subtitles/captions from a video URL using yt-dlp.

    This is the fastest method as it doesn't require audio processing.
    Works best with YouTube (auto-generated captions) and other platforms with subtitles.

    Returns:
        tuple: (subtitle_text, subtitle_file_path) or (None, None) if no subtitles found
    """
    import yt_dlp

    safe_output_dir = get_download_directory(output_dir)

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': [language, f'{language}.*'],
        'subtitlesformat': 'srt/vtt/best',
        'outtmpl': os.path.join(safe_output_dir, '%(title)s.%(ext)s'),
    }

    if cookies_file:
        ydl_opts['cookiefile'] = cookies_file
    elif cookies_from_browser:
        ydl_opts['cookiesfrombrowser'] = (cookies_from_browser,)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

            if not info:
                return None, None

            title = info.get('title', 'transcription')

            # Check for available subtitles
            subtitles = info.get('subtitles', {})
            auto_captions = info.get('automatic_captions', {})

            # Prefer manual subtitles over auto-generated
            available_subs = {}
            for lang_key, subs_list in subtitles.items():
                if lang_key.startswith(language):
                    available_subs[lang_key] = subs_list

            # Fallback to auto-captions
            if not available_subs:
                for lang_key, subs_list in auto_captions.items():
                    if lang_key.startswith(language):
                        available_subs[lang_key] = subs_list

            if not available_subs:
                return None, None

            # Pick the first matching language
            lang_key = list(available_subs.keys())[0]
            subs_list = available_subs[lang_key]

            # Find the best subtitle format (prefer srt, then vtt)
            sub_url = None
            sub_ext = 'srt'
            for sub_entry in subs_list:
                if sub_entry.get('ext') == 'srt':
                    sub_url = sub_entry.get('url')
                    sub_ext = 'srt'
                    break
                elif sub_entry.get('ext') == 'vtt':
                    sub_url = sub_entry.get('url')
                    sub_ext = 'vtt'

            if not sub_url and subs_list:
                sub_url = subs_list[0].get('url')
                sub_ext = subs_list[0].get('ext', 'srt')

            if not sub_url:
                return None, None

            # Download the subtitle file
            print(f"  Found {lang_key} subtitles, downloading...")

            # Use yt-dlp to download subtitles properly
            dl_opts = {
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
                'subtitleslangs': [lang_key],
                'subtitlesformat': sub_ext,
                'outtmpl': os.path.join(safe_output_dir, '%(title)s.%(ext)s'),
            }

            if cookies_file:
                dl_opts['cookiefile'] = cookies_file
            elif cookies_from_browser:
                dl_opts['cookiesfrombrowser'] = (cookies_from_browser,)

            with yt_dlp.YoutubeDL(dl_opts) as ydl2:
                ydl2.download([url])

            # Find the downloaded subtitle file
            safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)
            possible_files = [
                os.path.join(safe_output_dir, f"{safe_title}.{lang_key}.{sub_ext}"),
                os.path.join(safe_output_dir, f"{safe_title}.{language}.{sub_ext}"),
            ]

            # Also search for any subtitle files that match
            for fname in os.listdir(safe_output_dir):
                if fname.endswith(f'.{sub_ext}') and lang_key in fname:
                    possible_files.append(os.path.join(safe_output_dir, fname))
                elif fname.endswith('.srt') or fname.endswith('.vtt'):
                    possible_files.append(os.path.join(safe_output_dir, fname))

            for sub_file in possible_files:
                if os.path.isfile(sub_file):
                    with open(sub_file, 'r', encoding='utf-8', errors='replace') as f:
                        subtitle_text = f.read()
                    if subtitle_text.strip():
                        return subtitle_text, sub_file

            return None, None

    except Exception as e:
        print(f"  Subtitle extraction error: {e}")
        return None, None


def download_audio_for_transcription(url, output_dir, cookies_file=None, cookies_from_browser=None):
    """
    Download only the audio track from a URL for transcription purposes.

    Downloads as WAV for best Whisper compatibility.

    Returns:
        str: Path to the downloaded audio file, or None if failed
    """
    import yt_dlp

    safe_output_dir = get_download_directory(output_dir)

    # Check if FFmpeg is available for audio extraction
    ffmpeg_available = shutil.which("ffmpeg") is not None

    if ffmpeg_available:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(safe_output_dir, 'transcription_audio.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '16',
            }],
        }
    else:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(safe_output_dir, 'transcription_audio.%(ext)s'),
            'quiet': True,
            'no_warnings': True,
        }

    if cookies_file:
        ydl_opts['cookiefile'] = cookies_file
    elif cookies_from_browser:
        ydl_opts['cookiesfrombrowser'] = (cookies_from_browser,)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

            if not info:
                return None

            # Find the downloaded file
            if ffmpeg_available:
                audio_path = os.path.join(safe_output_dir, 'transcription_audio.wav')
            else:
                # Without FFmpeg, the file keeps its original extension
                ext = info.get('ext', 'webm')
                audio_path = os.path.join(safe_output_dir, f'transcription_audio.{ext}')

            if os.path.isfile(audio_path):
                return audio_path

            # Search for the file if the expected name doesn't match
            for fname in os.listdir(safe_output_dir):
                if fname.startswith('transcription_audio'):
                    return os.path.join(safe_output_dir, fname)

            return None

    except Exception as e:
        print(f"  Audio download error: {e}")
        return None


def transcribe_with_whisper(audio_path, model_size='base', language=None):
    """
    Transcribe an audio/video file using OpenAI Whisper.

    Args:
        audio_path: Path to the audio or video file
        model_size: Whisper model size (tiny, base, small, medium, large)
        language: Language code (e.g., 'en', 'es') or None for auto-detect

    Returns:
        dict: Whisper result with 'text' and 'segments' keys, or None if failed
    """
    if not WHISPER_AVAILABLE:
        print("Error: OpenAI Whisper is not installed.")
        print("Install it with: pip install openai-whisper")
        return None

    if model_size not in WHISPER_MODELS:
        print(f"Error: Invalid model size '{model_size}'.")
        print(f"Available models: {', '.join(WHISPER_MODELS.keys())}")
        return None

    try:
        print(f"  Loading Whisper '{model_size}' model...")
        model = whisper.load_model(model_size)

        print(f"  Transcribing audio (this may take a while)...")

        transcribe_opts = {}
        if language:
            transcribe_opts['language'] = language

        result = model.transcribe(str(audio_path), **transcribe_opts)

        return result

    except Exception as e:
        print(f"  Whisper transcription error: {e}")
        return None


def parse_subtitle_to_text(subtitle_content):
    """
    Parse SRT or VTT subtitle content and extract plain text.

    Removes timestamps, sequence numbers, and formatting tags.

    Returns:
        str: Plain text extracted from the subtitles
    """
    lines = subtitle_content.split('\n')
    text_lines = []

    for line in lines:
        line = line.strip()

        # Skip empty lines
        if not line:
            continue

        # Skip SRT sequence numbers (lines that are just digits)
        if line.isdigit():
            continue

        # Skip VTT header
        if line.startswith('WEBVTT') or line.startswith('Kind:') or line.startswith('Language:'):
            continue

        # Skip timestamp lines (SRT: 00:00:00,000 --> 00:00:00,000 or VTT: 00:00.000 --> 00:00.000)
        if '-->' in line:
            continue

        # Skip NOTE and STYLE blocks in VTT
        if line.startswith('NOTE') or line.startswith('STYLE'):
            continue

        # Remove HTML-like tags (e.g., <c>, </c>, <b>, etc.)
        cleaned = re.sub(r'<[^>]+>', '', line)

        # Remove VTT positioning tags
        cleaned = re.sub(r'\{[^}]+\}', '', cleaned)

        cleaned = cleaned.strip()
        if cleaned:
            text_lines.append(cleaned)

    # Remove consecutive duplicate lines (common in auto-generated captions)
    deduplicated = []
    for line in text_lines:
        if not deduplicated or line != deduplicated[-1]:
            deduplicated.append(line)

    return ' '.join(deduplicated)


def format_timestamp_srt(seconds):
    """Convert seconds to SRT timestamp format (HH:MM:SS,mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_timestamp_vtt(seconds):
    """Convert seconds to VTT timestamp format (HH:MM:SS.mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def save_transcription(text, segments, output_path, output_format='txt'):
    """
    Save transcription to file in the specified format.

    Args:
        text: Full transcription text
        segments: List of segment dicts with 'start', 'end', 'text' keys (from Whisper)
        output_path: Base output file path (extension will be replaced)
        output_format: Output format ('txt', 'srt', 'vtt')

    Returns:
        str: Path to the saved file, or None if failed
    """
    # Ensure correct extension
    base_path = os.path.splitext(output_path)[0]
    output_file = f"{base_path}.{output_format}"

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            if output_format == 'txt':
                f.write(text)

            elif output_format == 'srt':
                if segments:
                    for i, seg in enumerate(segments, 1):
                        start = format_timestamp_srt(seg['start'])
                        end = format_timestamp_srt(seg['end'])
                        f.write(f"{i}\n")
                        f.write(f"{start} --> {end}\n")
                        f.write(f"{seg['text'].strip()}\n\n")
                else:
                    # No segments, write as a single block
                    f.write("1\n")
                    f.write("00:00:00,000 --> 99:59:59,999\n")
                    f.write(f"{text}\n\n")

            elif output_format == 'vtt':
                f.write("WEBVTT\n\n")
                if segments:
                    for i, seg in enumerate(segments, 1):
                        start = format_timestamp_vtt(seg['start'])
                        end = format_timestamp_vtt(seg['end'])
                        f.write(f"{start} --> {end}\n")
                        f.write(f"{seg['text'].strip()}\n\n")
                else:
                    f.write("00:00:00.000 --> 99:59:59.999\n")
                    f.write(f"{text}\n\n")

        return output_file

    except Exception as e:
        print(f"Error saving transcription: {e}")
        return None


def transcription_workflow(args=None):
    """
    Interactive workflow for transcribing media from URLs or local files.

    Supports three transcription methods:
    1. Subtitle extraction from URLs (fastest, uses yt-dlp)
    2. Whisper transcription from URLs (downloads audio, then transcribes)
    3. Whisper transcription from local files (direct transcription)

    The workflow:
    1. Prompts for a URL or local file path
    2. For URLs: first tries subtitle extraction, then falls back to Whisper
    3. For local files: uses Whisper directly
    4. Allows model size and language selection
    5. Saves the transcription in the chosen format
    """
    print("\n" + "="*80)
    print("Media Transcription".center(80))
    print("="*80)

    # Check Whisper availability
    if not WHISPER_AVAILABLE:
        print("\nNote: OpenAI Whisper is not installed.")
        print("Without Whisper, only subtitle extraction from URLs is available.")
        print("To enable full transcription, install Whisper: pip install openai-whisper")
        print("Whisper also requires FFmpeg to be installed.")

    # Check FFmpeg availability
    ffmpeg_available = shutil.which("ffmpeg") is not None
    if not ffmpeg_available:
        print("\nWarning: FFmpeg is not installed.")
        print("FFmpeg is required for audio extraction and Whisper transcription.")
        print("Subtitle extraction from URLs may still work without FFmpeg.")

    # Get args defaults
    if args is None:
        args = argparse.Namespace(
            url=None, output='youtube_downloads',
            cookies=None, cookies_from_browser=None
        )

    output_dir = args.output if args.output else 'youtube_downloads'

    # Get input source (URL or local file)
    print("\nEnter a URL or local file path to transcribe:")
    print("  Supported URLs: YouTube, Instagram, TikTok, Vimeo, and 1800+ sites")
    print("  Supported files: MP3, WAV, FLAC, M4A, OGG, MP4, MKV, AVI, MOV, WebM")

    # Try clipboard URL first
    clipboard_url = get_clipboard_url()
    source = None

    if clipboard_url:
        if RICH_AVAILABLE:
            console = Console()
            console.print(f"\n[cyan]Detected URL in clipboard:[/cyan] [yellow]{clipboard_url}[/yellow]")
            use_clipboard = Confirm.ask("Use this URL?", default=True)
            if use_clipboard:
                source = clipboard_url
        else:
            print(f"\nDetected URL in clipboard: {clipboard_url}")
            use_clipboard = input("Use this URL? (y/n): ").strip().lower()
            if use_clipboard == 'y':
                source = clipboard_url

    if not source:
        source = input("\nURL or file path: ").strip().strip('"').strip("'")

    if not source:
        print("Error: No input provided.")
        return

    # Determine if source is a local file or URL
    is_local = is_local_media_file(source) or (os.path.isfile(source) and not source.startswith(('http://', 'https://')))

    if is_local and not os.path.isfile(source):
        # Try resolving relative path
        abs_path = os.path.abspath(source)
        if os.path.isfile(abs_path):
            source = abs_path
            is_local = True
        else:
            print(f"Error: File '{source}' not found.")
            return

    # Get language preference
    print("\nLanguage options:")
    print("  Enter a language code (e.g., 'en' for English, 'es' for Spanish)")
    print("  Or press Enter for auto-detection (Whisper) / English (subtitles)")
    language_input = input("Language: ").strip().lower()
    language = language_input if language_input else None
    sub_language = language if language else 'en'

    # Get output format preference
    print(f"\nOutput format options: {', '.join(f.upper() for f in TRANSCRIPTION_FORMATS)}")
    format_input = input("Output format (default: txt): ").strip().lower()
    if format_input not in TRANSCRIPTION_FORMATS:
        format_input = 'txt'

    transcription_text = None
    transcription_segments = None
    source_title = None

    if is_local:
        # === LOCAL FILE TRANSCRIPTION ===
        source = os.path.abspath(source)
        source_title = os.path.splitext(os.path.basename(source))[0]

        print(f"\nTranscribing local file: {os.path.basename(source)}")

        if not WHISPER_AVAILABLE:
            print("Error: Whisper is required for local file transcription.")
            print("Install it with: pip install openai-whisper")
            return

        if not ffmpeg_available:
            print("Error: FFmpeg is required for Whisper transcription.")
            return

        # Select Whisper model
        model_size = _select_whisper_model()
        if not model_size:
            return

        result = transcribe_with_whisper(source, model_size, language)

        if result:
            transcription_text = result.get('text', '')
            transcription_segments = result.get('segments', [])
            detected_lang = result.get('language', 'unknown')
            print(f"\n  Detected language: {detected_lang}")
        else:
            print("\nTranscription failed.")
            return

    else:
        # === URL TRANSCRIPTION ===
        print(f"\nProcessing URL: {source}")

        # Get video info for title
        print("  Fetching media information...")
        info = get_video_info(source, args.cookies, args.cookies_from_browser)

        if info:
            source_title = info.get('title', 'transcription')
            detected_site = detect_site(source)
            site_info = get_supported_sites().get(detected_site, {'name': 'Unknown'})

            print(f"  Site: {site_info['name']}")
            print(f"  Title: {source_title}")
            duration = info.get('duration', 0)
            if duration:
                print(f"  Duration: {format_duration(duration)}")
        else:
            source_title = 'transcription'
            print("  Warning: Could not fetch media info, proceeding anyway...")

        # Step 1: Try subtitle extraction first (fastest method)
        print("\n  Step 1: Checking for existing subtitles/captions...")
        sub_text, sub_file = extract_subtitles_from_url(
            source, output_dir, args.cookies, args.cookies_from_browser, sub_language
        )

        if sub_text:
            print("  Subtitles found!")

            # Ask if user wants subtitles or Whisper transcription
            if WHISPER_AVAILABLE and ffmpeg_available:
                print("\n  Subtitles are available. You can:")
                print("  1. Use extracted subtitles (faster)")
                print("  2. Transcribe with Whisper (more accurate, slower)")
                sub_choice = input("  Choice (1/2, default: 1): ").strip()

                if sub_choice == '2':
                    sub_text = None  # Force Whisper transcription below
                else:
                    # Parse subtitle text
                    transcription_text = parse_subtitle_to_text(sub_text)
                    transcription_segments = None
            else:
                transcription_text = parse_subtitle_to_text(sub_text)
                transcription_segments = None

        # Step 2: If no subtitles or user chose Whisper, use Whisper
        if transcription_text is None:
            print("\n  Step 2: Transcribing with Whisper...")

            if not WHISPER_AVAILABLE:
                print("  Error: Whisper is not installed and no subtitles were found.")
                print("  Install Whisper: pip install openai-whisper")
                return

            if not ffmpeg_available:
                print("  Error: FFmpeg is required for audio download and Whisper transcription.")
                return

            # Select Whisper model
            model_size = _select_whisper_model()
            if not model_size:
                return

            # Download audio from URL
            print("  Downloading audio for transcription...")
            audio_path = download_audio_for_transcription(
                source, output_dir, args.cookies, args.cookies_from_browser
            )

            if not audio_path:
                print("  Error: Failed to download audio.")
                return

            print(f"  Audio saved to: {audio_path}")

            # Transcribe with Whisper
            result = transcribe_with_whisper(audio_path, model_size, language)

            if result:
                transcription_text = result.get('text', '')
                transcription_segments = result.get('segments', [])
                detected_lang = result.get('language', 'unknown')
                print(f"\n  Detected language: {detected_lang}")
            else:
                print("\n  Transcription failed.")
                return

            # Clean up temporary audio file
            try:
                os.remove(audio_path)
            except OSError:
                pass

    if not transcription_text:
        print("\nNo transcription text was generated.")
        return

    # Display transcription preview
    print("\n" + "="*80)
    print("Transcription Preview".center(80))
    print("="*80)

    preview = transcription_text[:500]
    if len(transcription_text) > 500:
        preview += "..."
    print(f"\n{preview}")
    print(f"\n  Total characters: {len(transcription_text)}")
    word_count = len(transcription_text.split())
    print(f"  Total words: {word_count}")
    if transcription_segments:
        print(f"  Total segments: {len(transcription_segments)}")
    print("="*80)

    # Save transcription
    safe_title = re.sub(r'[<>:"/\\|?*]', '_', source_title or 'transcription')
    safe_output_dir = get_download_directory(output_dir)
    output_path = os.path.join(safe_output_dir, safe_title)

    saved_path = save_transcription(transcription_text, transcription_segments, output_path, format_input)

    if saved_path:
        print(f"\nTranscription saved to: {saved_path}")
        print(f"File size: {format_size(os.path.getsize(saved_path))}")
    else:
        print("\nFailed to save transcription file.")

    # Ask if user wants to save in additional formats
    remaining_formats = [f for f in TRANSCRIPTION_FORMATS if f != format_input]
    if remaining_formats and transcription_segments:
        save_more = input(f"\nSave in additional formats ({', '.join(f.upper() for f in remaining_formats)})? (y/n): ").strip().lower()
        if save_more == 'y':
            for fmt in remaining_formats:
                extra_path = save_transcription(transcription_text, transcription_segments, output_path, fmt)
                if extra_path:
                    print(f"  Saved: {extra_path}")


def _select_whisper_model():
    """
    Interactive Whisper model selection.

    Returns:
        str: Selected model size name, or None if cancelled
    """
    print("\n  Select Whisper model:")
    model_keys = list(WHISPER_MODELS.keys())
    for i, (key, info) in enumerate(WHISPER_MODELS.items(), 1):
        print(f"    {i}. {info['name']} - {info['description']} (~{info['size_mb']}MB)")

    default_idx = model_keys.index('base') + 1
    model_choice = input(f"  Model (1-{len(WHISPER_MODELS)}, default: {default_idx} for Base): ").strip()

    if not model_choice:
        return 'base'

    if model_choice.isdigit():
        idx = int(model_choice)
        if 1 <= idx <= len(WHISPER_MODELS):
            return model_keys[idx - 1]
    elif model_choice.lower() in WHISPER_MODELS:
        return model_choice.lower()

    print("  Invalid selection. Using 'base' model.")
    return 'base'


# Audio conversion workflow
def audio_conversion_workflow():
    """
    Interactive workflow for audio file conversion.
    
    This function guides the user through the audio conversion process:
    1. Prompts for an input audio file path
    2. Validates the file exists and is accessible
    3. Extracts and displays file metadata (size, duration, bitrate)
    4. Presents available output format options
    5. Allows custom bitrate selection for lossy formats
    6. Shows estimated output size and quality
    7. Requests confirmation before conversion
    8. Performs the conversion using FFmpeg
    
    Requires FFmpeg to be installed and available in the system PATH.
    
    Returns:
        None
    """
    print("\n" + "="*80)
    print("Audio Format Conversion".center(80))
    print("="*80)
    
    # Check if FFmpeg is available
    if not shutil.which("ffmpeg"):
        print("\nError: FFmpeg is required for audio conversion but is not installed.")
        print("Please install FFmpeg and try again.")
        return
    
    # Get input file
    print("\nEnter the path to your audio file:")
    print("Supported formats: MP3, M4A, WAV, FLAC, OGG, AAC, WMA")
    input_file = input("File path: ").strip().strip('"').strip("'")
    
    # Validate and normalize input file path
    try:
        input_file = os.path.abspath(input_file)
    except Exception as e:
        print(f"\nError: Invalid file path. {e}")
        return
    
    if not os.path.isfile(input_file):
        print(f"\nError: File '{input_file}' not found.")
        return
    
    # Additional security check - ensure it's a regular file and readable
    if not os.access(input_file, os.R_OK):
        print(f"\nError: Cannot read file '{input_file}'. Permission denied.")
        return
    
    # Get file metadata
    print("\nAnalyzing audio file...")
    metadata = get_audio_metadata(input_file)
    
    if not metadata:
        print("Warning: Could not extract audio metadata. Continuing anyway...")
        input_size = os.path.getsize(input_file)
        duration = None
        input_bitrate = None
    else:
        # Extract relevant information
        format_info = metadata.get('format', {})
        input_size = int(format_info.get('size', os.path.getsize(input_file)))
        duration = float(format_info.get('duration', 0))
        input_bitrate = int(format_info.get('bit_rate', 0)) / 1000  # Convert to kbps
        
        # Try to get from audio stream if not in format
        if not input_bitrate and 'streams' in metadata:
            for stream in metadata['streams']:
                if stream.get('codec_type') == 'audio':
                    input_bitrate = int(stream.get('bit_rate', 0)) / 1000
                    break
    
    # Display input file information
    print("\n" + "-"*80)
    print("Input File Information:")
    print(f"  File: {os.path.basename(input_file)}")
    print(f"  Size: {format_size(input_size)} ({input_size / (1024*1024):.2f} MB)")
    
    if duration:
        print(f"  Duration: {format_duration(int(duration))}")
    
    if input_bitrate:
        print(f"  Bitrate: {int(input_bitrate)} kbps")
    
    print("-"*80)
    
    # Display available output formats
    formats = get_supported_audio_formats()
    print("\nAvailable Output Formats:")
    print(f"{'Code':<6} {'Format':<10} {'Description':<40} {'Quality':<20}")
    print("-"*80)
    
    for i, (code, info) in enumerate(formats.items(), 1):
        quality = get_quality_description(info['codec'], info['default_bitrate'])
        print(f"{i:<6} {code.upper():<10} {info['description']:<40} {quality:<20}")
    
    print("-"*80)
    
    # Get output format selection
    print("\nSelect output format (enter number or format code):")
    format_choice = input("Choice: ").strip().lower()
    
    # Parse selection
    output_format = None
    if format_choice.isdigit():
        choice_num = int(format_choice)
        if 1 <= choice_num <= len(formats):
            output_format = list(formats.keys())[choice_num - 1]
    elif format_choice in formats:
        output_format = format_choice
    
    if not output_format:
        print("Invalid selection. Conversion cancelled.")
        return
    
    format_info = formats[output_format]
    
    # Ask for custom bitrate for lossy formats
    bitrate = format_info['default_bitrate']
    if output_format not in ['wav', 'flac']:
        print(f"\nDefault bitrate for {format_info['name']}: {bitrate} kbps")
        custom_bitrate = input("Enter custom bitrate in kbps (or press Enter for default): ").strip()
        if custom_bitrate.isdigit():
            bitrate = int(custom_bitrate)
    
    # Estimate output file size
    estimated_size = None
    if duration and bitrate:
        estimated_size = estimate_output_size(duration, bitrate)
    
    # Display conversion summary
    print("\n" + "="*80)
    print("Conversion Summary:")
    print(f"  Output Format: {format_info['name']} ({format_info['description']})")
    print(f"  Estimated Quality: {get_quality_description(format_info['codec'], bitrate)}")
    print(f"  Input File Size: {format_size(input_size)} ({input_size / (1024*1024):.2f} MB)")
    
    if estimated_size:
        print(f"  Estimated Output Size: {format_size(estimated_size)} ({estimated_size / (1024*1024):.2f} MB)")
        
        # Show size comparison
        size_diff = estimated_size - input_size
        if size_diff > 0:
            print(f"  Size Change: +{format_size(size_diff)} (larger)")
        elif size_diff < 0:
            print(f"  Size Change: -{format_size(abs(size_diff))} (smaller)")
        else:
            print(f"  Size Change: Similar size")
    
    print("="*80)
    
    # Confirm conversion
    confirm = input("\nProceed with conversion? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Conversion cancelled.")
        return
    
    # Perform conversion
    success = convert_audio_file(input_file, output_format, bitrate)
    
    if success:
        print("\n✓ Audio conversion completed successfully!")
    else:
        print("\n✗ Audio conversion failed.")

# Thread-safe download result tracking
class DownloadTracker:
    """Thread-safe tracker for download results in parallel operations"""
    def __init__(self):
        self.lock = Lock()
        self.completed = 0
        self.failed = 0
        self.total = 0
        self.results = []
    
    def add_result(self, url, success, message=""):
        """Add a download result"""
        with self.lock:
            self.completed += 1
            if success:
                self.results.append({'url': url, 'success': True, 'message': message})
            else:
                self.failed += 1
                self.results.append({'url': url, 'success': False, 'message': message})
    
    def set_total(self, total):
        """Set the total number of downloads"""
        with self.lock:
            self.total = total
    
    def get_status(self):
        """Get current status"""
        with self.lock:
            return {
                'completed': self.completed,
                'failed': self.failed,
                'total': self.total,
                'success': self.completed - self.failed
            }
    
    def get_results(self):
        """Get all results"""
        with self.lock:
            return self.results.copy()

# Read URLs from various sources
def read_urls_from_file(file_path):
    """Read URLs from a text file, one URL per line"""
    urls = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip empty lines and comments
                if line and not line.startswith('#'):
                    urls.append(line)
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        return None
    except Exception as e:
        print(f"Error reading file '{file_path}': {e}")
        return None
    
    return urls

def read_urls_from_stdin():
    """Read URLs from standard input, one URL per line"""
    print("Enter URLs (one per line). Press Ctrl+D (Unix) or Ctrl+Z (Windows) when done:")
    urls = []
    try:
        for line in sys.stdin:
            line = line.strip()
            # Skip empty lines and comments
            if line and not line.startswith('#'):
                urls.append(line)
    except KeyboardInterrupt:
        print("\nInput cancelled.")
        return None
    
    return urls

# Download a single video in parallel context
def download_video_parallel(url, format_selection, output_dir, ffmpeg_available, 
                           cookies_file, cookies_from_browser, archive_file, tracker, index, total):
    """
    Download a single video with parallel-safe progress tracking.
    
    Args:
        url: Video URL to download
        format_selection: Format selection string
        output_dir: Output directory path
        ffmpeg_available: Whether FFmpeg is available
        cookies_file: Path to cookies file (optional)
        cookies_from_browser: Browser name for cookie extraction (optional)
        archive_file: Path to archive file (optional)
        tracker: DownloadTracker instance for thread-safe result tracking
        index: Current video index (1-based)
        total: Total number of videos
    
    Returns:
        Tuple of (url, success, message)
    """
    try:
        # Thread-safe print with index information
        print(f"\n[{index}/{total}] Starting download: {url}")
        
        # Get video info first to show what we're downloading
        info = get_video_info(url, cookies_file, cookies_from_browser)
        if info:
            title = info.get('title', 'Unknown')
            print(f"[{index}/{total}] Downloading: {title}")
        
        # Perform the download
        output_path, success = download_video(
            url, format_selection, output_dir, ffmpeg_available,
            cookies_file, cookies_from_browser, False, archive_file
        )
        
        if success:
            message = f"Downloaded to {output_path}"
            print(f"[{index}/{total}] ✓ Completed: {url}")
            tracker.add_result(url, True, message)
            return (url, True, message)
        else:
            message = f"Failed to download"
            print(f"[{index}/{total}] ✗ Failed: {url}")
            tracker.add_result(url, False, message)
            return (url, False, message)
            
    except Exception as e:
        message = f"Error: {str(e)}"
        print(f"[{index}/{total}] ✗ Error downloading {url}: {e}")
        tracker.add_result(url, False, message)
        return (url, False, message)

# Parallel download workflow
def parallel_download_workflow(urls, format_selection, output_dir, ffmpeg_available,
                               cookies_file, cookies_from_browser, archive_file, max_workers):
    """
    Download multiple videos in parallel.
    
    Args:
        urls: List of video URLs to download
        format_selection: Format selection string
        output_dir: Output directory path
        ffmpeg_available: Whether FFmpeg is available
        cookies_file: Path to cookies file (optional)
        cookies_from_browser: Browser name for cookie extraction (optional)
        archive_file: Path to archive file (optional)
        max_workers: Maximum number of concurrent downloads
    """
    if not urls:
        print("No URLs provided for download.")
        return
    
    print("\n" + "="*80)
    print(f"Parallel Download - {len(urls)} videos with {max_workers} workers".center(80))
    print("="*80)
    
    # Initialize tracker
    tracker = DownloadTracker()
    tracker.set_total(len(urls))
    
    # Start time for statistics
    start_time = time.time()
    
    # Use ThreadPoolExecutor for parallel downloads
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all download tasks
        futures = []
        for idx, url in enumerate(urls, 1):
            future = executor.submit(
                download_video_parallel,
                url, format_selection, output_dir, ffmpeg_available,
                cookies_file, cookies_from_browser, archive_file,
                tracker, idx, len(urls)
            )
            futures.append(future)
        
        # Wait for all downloads to complete
        print(f"\nDownloading {len(urls)} videos with {max_workers} concurrent workers...")
        print("-"*80)
        
        for future in as_completed(futures):
            try:
                # Result is already tracked in download_video_parallel
                future.result()
            except Exception as e:
                print(f"Unexpected error in download task: {e}")
    
    # Calculate statistics
    elapsed_time = time.time() - start_time
    status = tracker.get_status()
    
    # Display summary
    print("\n" + "="*80)
    print("Download Summary".center(80))
    print("="*80)
    print(f"Total videos: {status['total']}")
    print(f"Successfully downloaded: {status['success']}")
    print(f"Failed: {status['failed']}")
    print(f"Time elapsed: {format_duration(int(elapsed_time))}")
    if len(urls) > 0:
        print(f"Average time per video: {elapsed_time / len(urls):.2f} seconds")
    print("="*80)
    
    # Display detailed results if there were failures
    if status['failed'] > 0:
        print("\nFailed downloads:")
        results = tracker.get_results()
        for result in results:
            if not result['success']:
                print(f"  ✗ {result['url']}")
                if result['message']:
                    print(f"    Reason: {result['message']}")

# Main menu for choosing between video download and audio conversion
def show_main_menu():
    """Display main menu and get user choice"""
    print("\n" + "="*80)
    print("So what is my purpose?".center(80))
    print("="*80)
    print("\nPlease select an option:")
    print("  1. Download video from supported sites")
    print("  2. Convert audio/music file")
    print("  3. Transcribe media (URL or local file)")
    print("  4. Exit")
    print("-"*80)

    choice = input("Enter your choice (1-4): ").strip()
    return choice

# Video download workflow (supports all sites via yt-dlp)
def youtube_download_workflow(args=None, ffmpeg_installed=True):
    """Interactive workflow for video download from any supported site"""
    # Import yt-dlp
    import yt_dlp
    
    # Ensure args has default values if None
    if args is None:
        args = argparse.Namespace(url=None, mp3=False, mp4=False, high=False, 
                                  format=None, info=False, output='youtube_downloads',
                                  cookies=None, cookies_from_browser=None, archive=None)
    
    # Get URL from args
    # Note: When called from main() with a single URL, args.url is a string.
    # For interactive mode, args.url may be None.
    url = args.url if args.url else None
    if not url:
        # Show supported sites
        print("\n" + "="*80)
        print("Supported Video Sites".center(80))
        print("="*80)
        sites = get_supported_sites()
        for site_key, site_info in sites.items():
            if site_key != 'other':
                print(f"  • {site_info['name']}: {site_info['description']}")
        print(f"  • And 1800+ other sites supported by yt-dlp")
        print("="*80)
        
        # Try to get URL from clipboard
        clipboard_url = get_clipboard_url()
        url = None  # Initialize to None explicitly
        
        if clipboard_url:
            if RICH_AVAILABLE:
                console = Console()
                console.print(f"\n[cyan]📋 Detected URL in clipboard:[/cyan] [yellow]{clipboard_url}[/yellow]")
                use_clipboard = Confirm.ask("Use this URL?", default=True)
                if use_clipboard:
                    url = clipboard_url
            else:
                print(f"\n📋 Detected URL in clipboard: {clipboard_url}")
                use_clipboard = input("Use this URL? (y/n): ").strip().lower()
                if use_clipboard == 'y':
                    url = clipboard_url
        
        # If URL not set from clipboard, ask for manual input
        if not url:
            url = input("\nEnter video URL (from any supported site): ").strip()
    
    # Detect which site the URL is from
    detected_site = detect_site(url)
    site_info = get_supported_sites().get(detected_site, {'name': 'Unknown'})
    
    # Basic URL format check
    if not url.startswith(('http://', 'https://', 'www.')) and '.' not in url:
        print("Error: Invalid URL format")
        print("URLs should start with http://, https://, or www.")
        return
    
    # Validate the URL - use fast YouTube validation for YouTube URLs
    if detected_site == 'youtube':
        if not is_valid_youtube_url(url):
            print("Error: Invalid YouTube URL")
            return
    else:
        # For other sites, we'll let yt-dlp handle validation during info extraction
        # This avoids expensive validation for every URL type
        print(f"Detected site: {site_info['name']}")
    
    # Get video/playlist information
    print("\nFetching information...")
    info = get_video_info(url, args.cookies, args.cookies_from_browser)
    
    if not info:
        print("Failed to retrieve information.")
        print("Please check that:")
        print("  1. The URL is correct and accessible")
        print("  2. The site is supported by yt-dlp")
        print("  3. You have an internet connection")
        if detected_site == 'other':
            print("  4. Try using --list-sites to see popular supported sites")
        return
    
    # Check if it's a playlist or channel
    is_playlist = info.get('_type') in ['playlist', 'multi_video']
    
    # Display video/playlist information
    display_video_info(info, is_playlist)
    
    # If info-only mode, exit here
    if args.info:
        if is_playlist:
            print("\nPlaylist contains the following videos:")
            for idx, entry in enumerate(info.get('entries', []), 1):
                if entry:
                    title = entry.get('title', 'Unknown')
                    duration = format_duration(entry.get('duration', 0))
                    print(f"  {idx}. {title} ({duration})")
        return
    
    # Determine format selection
    format_selection = None
    
    if args.mp3:
        format_selection = 'mp3'
        if not ffmpeg_installed:
            print("\nWarning: FFmpeg is required for MP3 conversion.")
            print("The audio will be downloaded in its original format instead.")
    elif args.mp4:
        format_selection = 'mp4'
    elif args.high:
        format_selection = 'high'
        if not ffmpeg_installed:
            print("\nWarning: FFmpeg is required for high quality downloads to merge video and audio.")
            print("Falling back to best available combined format.")
    elif args.format:
        format_selection = args.format
    else:
        # For playlists, skip format display and use best by default
        if is_playlist:
            print("\nPlaylist detected. Using default format (best quality).")
            print("You can specify a format using --format, --mp3, --mp4, or --high flags.")
            format_selection = 'best'
        else:
            # Display available formats and prompt for selection
            if RICH_AVAILABLE:
                all_formats = display_formats_rich(info, ffmpeg_installed)
            else:
                all_formats = display_formats(info, ffmpeg_installed)
            
            if not all_formats:
                print("No formats available for this video.")
                return
            
            # Get format selection with fuzzy search support
            if RICH_AVAILABLE:
                format_selection = Prompt.ask("\n[bold cyan]Enter format selection[/bold cyan] (format ID or special option)")
            else:
                format_selection = input("\nEnter format selection (format ID or special option): ").strip()
            
            # Try fuzzy search if available and input doesn't match exactly
            if FUZZY_AVAILABLE and format_selection:
                special_options = ['best', 'bestvideo', 'bestaudio', 'high', 'mp3', 'mp4']
                # Create a set for O(1) lookup of format IDs
                format_ids = {f.get('format_id') for f in all_formats}
                
                if format_selection.lower() not in special_options and format_selection not in format_ids:
                    fuzzy_result = fuzzy_search_format(format_selection, all_formats, special_options)
                    if fuzzy_result:
                        if RICH_AVAILABLE:
                            console = Console()
                            console.print(f"[yellow]🔍 Did you mean: [bold]{fuzzy_result}[/bold]?[/yellow]")
                            use_fuzzy = Confirm.ask("Use this format?", default=True)
                            if use_fuzzy:
                                format_selection = fuzzy_result
                        else:
                            print(f"🔍 Did you mean: {fuzzy_result}?")
                            use_fuzzy = input("Use this format? (y/n): ").strip().lower()
                            if use_fuzzy == 'y':
                                format_selection = fuzzy_result
            
            # Check if selected format requires FFmpeg
            if format_selection.lower() in ['high', 'mp3'] and not ffmpeg_installed:
                print(f"\nWarning: The '{format_selection}' option requires FFmpeg, which is not installed.")
                alt_choice = input("Would you like to use 'best' format instead? (y/n): ").strip().lower()
                if alt_choice == 'y':
                    format_selection = 'best'
                    print("Using 'best' format instead.")
                else:
                    print("Download cancelled. Please install FFmpeg to use this format option.")
                    return
    
    # Download the video or playlist
    print(f"\nPreparing to download...")
    
    if is_playlist:
        entries_count = len(info.get('entries', []))
        print(f"Downloading playlist with {entries_count} videos...")
        print("Videos will be numbered in playlist order.")
        print("Already downloaded videos will be skipped (incremental sync enabled).")
    
    if format_selection == 'high':
        if ffmpeg_installed:
            print("Selected high quality mode - will download best video and audio streams and merge them")
        else:
            print("FFmpeg not available - downloading best combined format instead")
    
    output_dir = args.output if args.output else 'youtube_downloads'
    actual_output_dir, success = download_video(
        url, format_selection, output_dir, ffmpeg_installed,
        args.cookies, args.cookies_from_browser, is_playlist, args.archive
    )
    
    if success:
        print("\nDownload completed successfully!")
        # Show the output directory
        print(f"\nFiles saved to: {actual_output_dir}")
        
        # Try to open the directory on supported platforms
        try:
            if platform.system() == "Windows":
                os.startfile(actual_output_dir)
            elif platform.system() == "Darwin":  # macOS
                subprocess.call(["open", actual_output_dir])
            elif platform.system() == "Linux":
                subprocess.call(["xdg-open", actual_output_dir])
        except Exception as e:
            print(f"Note: Could not open the directory automatically. Error: {e}")
    else:
        print("\nDownload failed.")

# Main function
def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Multi-Site Video Downloader, Audio Converter & Media Transcriber - Supports YouTube, Vimeo, SoundCloud, and 1800+ sites')
    parser.add_argument('url', nargs='*', help='Video URL(s) from any supported site (YouTube, Vimeo, SoundCloud, etc.). Can provide multiple URLs for parallel download.')
    parser.add_argument('-f', '--format', help='Specify format code directly')
    parser.add_argument('-o', '--output', default='youtube_downloads', help='Output directory (default: youtube_downloads in your home directory)')
    parser.add_argument('-i', '--info', action='store_true', help='Show video/playlist info only without downloading')
    parser.add_argument('-m', '--mp3', action='store_true', help='Convert to MP3 audio')
    parser.add_argument('--mp4', action='store_true', help='Download as MP4 video')
    parser.add_argument('--high', action='store_true', help='Download high quality video+audio')
    parser.add_argument('--convert', action='store_true', help='Launch audio conversion mode')
    parser.add_argument('--transcribe', action='store_true', help='Launch media transcription mode (URL or local file)')
    parser.add_argument('--no-wait', action='store_true', help='Do not wait for user input at the end')
    parser.add_argument('--cookies', help='Path to cookies file for authentication')
    parser.add_argument('--cookies-from-browser', 
                        choices=['brave', 'chrome', 'chromium', 'edge', 'firefox', 'opera', 'safari', 'vivaldi'],
                        help='Extract cookies from browser for authentication')
    parser.add_argument('--archive', help='Path to download archive file (records downloaded video IDs to skip duplicates)')
    parser.add_argument('--list-sites', action='store_true', help='List popular supported video sites')
    
    # Parallel download options
    parser.add_argument('--batch-file', help='File containing URLs to download (one per line)')
    parser.add_argument('--stdin', action='store_true', help='Read URLs from standard input')
    parser.add_argument('--max-workers', type=int, default=DEFAULT_MAX_WORKERS, 
                        help=f'Maximum number of concurrent downloads (default: {DEFAULT_MAX_WORKERS}, max: {MAX_WORKERS_LIMIT})')
    parser.add_argument('--parallel', action='store_true', help='Enable parallel downloads for multiple URLs')
    
    args = parser.parse_args()
    
    # Display banner
    if RICH_AVAILABLE:
        console = Console()
        console.print("\n" + "="*80)
        console.print("[bold cyan]Multi-Site Video Downloader, Audio Converter & Transcriber[/bold cyan]", justify="center")
        console.print("[yellow]Supports YouTube, Vimeo, SoundCloud, and 1800+ video sites[/yellow]", justify="center")
        console.print(f"[green]Version {VERSION} - Last updated: {VERSION_DATE}[/green]", justify="center")
        console.print("[dim]✨ Rich TUI Mode Enabled ✨[/dim]", justify="center")
        console.print("="*80 + "\n")
    else:
        print("\n" + "="*80)
        print("Multi-Site Video Downloader, Audio Converter & Transcriber".center(80))
        print("Supports YouTube, Vimeo, SoundCloud, and 1800+ video sites".center(80))
        print(f"Version {VERSION} - Last updated: {VERSION_DATE}".center(80))
        print("="*80)
    
    # Handle --list-sites flag
    if args.list_sites:
        print("\n" + "="*80)
        print("Popular Supported Video Sites".center(80))
        print("="*80)
        sites = get_supported_sites()
        for site_key, site_info in sites.items():
            print(f"\n{site_info['name']}")
            print(f"  Description: {site_info['description']}")
            print(f"  Example URL: {site_info['example']}")
        print("\n" + "="*80)
        print("Note: yt-dlp supports over 1800 sites in total!".center(80))
        print("="*80)
        return
    
    # Check if dependencies are installed
    yt_dlp_installed, ffmpeg_installed = check_dependencies()
    if not yt_dlp_installed:
        return
    
    # If convert flag is set, go directly to audio conversion
    if args.convert:
        audio_conversion_workflow()
        return

    # If transcribe flag is set, go directly to transcription
    if args.transcribe:
        transcription_workflow(args)
        return

    # Collect URLs from various sources
    urls = []
    
    # 1. From command line arguments
    if args.url:
        urls.extend(args.url)
    
    # 2. From batch file
    if args.batch_file:
        batch_urls = read_urls_from_file(args.batch_file)
        if batch_urls is None:
            return
        urls.extend(batch_urls)
    
    # 3. From stdin
    if args.stdin:
        stdin_urls = read_urls_from_stdin()
        if stdin_urls is None:
            return
        urls.extend(stdin_urls)
    
    # Validate max_workers
    if args.max_workers < 1:
        print(f"Error: --max-workers must be at least 1")
        return
    if args.max_workers > MAX_WORKERS_LIMIT:
        print(f"Warning: --max-workers exceeds limit of {MAX_WORKERS_LIMIT}, using {MAX_WORKERS_LIMIT}")
        args.max_workers = MAX_WORKERS_LIMIT
    
    # Handle parallel downloads for multiple URLs
    if len(urls) > 1 or args.parallel:
        if len(urls) == 0:
            print("Error: No URLs provided for parallel download.")
            print("Use --batch-file, --stdin, or provide multiple URLs as arguments.")
            return
        
        # Determine format selection for parallel downloads
        format_selection = None
        if args.mp3:
            format_selection = 'mp3'
        elif args.mp4:
            format_selection = 'mp4'
        elif args.high:
            format_selection = 'high'
        elif args.format:
            format_selection = args.format
        else:
            format_selection = 'best'
        
        # Run parallel download workflow
        parallel_download_workflow(
            urls, format_selection, args.output, ffmpeg_installed,
            args.cookies, args.cookies_from_browser, args.archive, args.max_workers
        )
        return
    
    # Single URL or interactive mode
    if len(urls) == 1:
        # Create a new args namespace with the single URL as a string
        single_url_args = copy.copy(args)
        single_url_args.url = urls[0]
        youtube_download_workflow(single_url_args, ffmpeg_installed)
        return
    
    # Show main menu if no URL provided
    while True:
        choice = show_main_menu()

        if choice == '1':
            # Video download from any supported site
            youtube_download_workflow(args, ffmpeg_installed)
            break
        elif choice == '2':
            # Audio conversion
            audio_conversion_workflow()
            break
        elif choice == '3':
            # Media transcription
            transcription_workflow(args)
            break
        elif choice == '4':
            # Exit
            print("\nGoodbye!")
            return
        else:
            print("\nInvalid choice. Please enter 1, 2, 3, or 4.")
            time.sleep(MENU_RETRY_DELAY)

# Copyright notice and disclaimer
def show_disclaimer():
    print("\nDISCLAIMER:")
    print("This tool is for personal and educational use only.")
    print("Please respect copyright laws and YouTube's Terms of Service.")
    print("Only download videos that you have permission to download.")
    print("The developers of this tool are not responsible for any misuse.\n")

if __name__ == "__main__":
    try:
        main()
        show_disclaimer()
        
        # Add a pause at the end to prevent the console from closing
        # Check if script is running in a terminal/console environment
        if sys.stdout.isatty() or platform.system() == "Windows":
            wait_for_exit()
            
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        # Also wait after an error
        if sys.stdout.isatty() or platform.system() == "Windows":
            wait_for_exit()