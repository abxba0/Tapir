#!/usr/bin/env python3
"""
YouTube Video Downloader

A command-line tool to download YouTube videos locally.
Uses yt-dlp library for downloading videos with format selection.

Features:
- Quality selection
- Multiple format support (MP4, MP3, etc.)
- Metadata display
- Download progress tracking
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
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from pathlib import Path

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

# Validate YouTube URL
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
        
    return False

# Extract video information using yt-dlp
def get_video_info(url):
    import yt_dlp
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'simulate': True,
        'forcejson': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info
    except yt_dlp.utils.DownloadError as e:
        print(f"Error: {e}")
        return None

# Display video information and available formats
def display_video_info(info):
    if not info:
        return
    
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
def download_video(url, format_selection, output_dir="youtube_downloads", ffmpeg_available=True):
    import yt_dlp
    
    # Get a safe download directory with proper permissions
    safe_output_dir = get_download_directory(output_dir)
    print(f"Using download directory: {safe_output_dir}")
    
    # Set output template
    output_template = os.path.join(safe_output_dir, '%(title)s.%(ext)s')
    
    # Configure yt-dlp options
    ydl_opts = {
        'format': format_selection,
        'outtmpl': output_template,
        'progress_hooks': [progress_hook],
        'quiet': False,
        'no_warnings': True,
        'ignoreerrors': False,
    }
    
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

# Main function
def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='YouTube Video Downloader')
    parser.add_argument('url', nargs='?', help='YouTube video URL')
    parser.add_argument('-f', '--format', help='Specify format code directly')
    parser.add_argument('-o', '--output', default='youtube_downloads', help='Output directory (default: youtube_downloads in your home directory)')
    parser.add_argument('-i', '--info', action='store_true', help='Show video info only without downloading')
    parser.add_argument('-m', '--mp3', action='store_true', help='Convert to MP3 audio')
    parser.add_argument('--mp4', action='store_true', help='Download as MP4 video')
    parser.add_argument('--high', action='store_true', help='Download high quality video+audio')
    parser.add_argument('--no-wait', action='store_true', help='Do not wait for user input at the end')
    
    args = parser.parse_args()
    
    # Display banner
    print("\n" + "="*80)
    print("YouTube Video Downloader".center(80))
    print("A local tool to download YouTube videos".center(80))
    print(f"Version 1.3.0 - Last updated: 2025-06-23".center(80))
    print("="*80)
    
    # Check if dependencies are installed
    yt_dlp_installed, ffmpeg_installed = check_dependencies()
    if not yt_dlp_installed:
        return
    
    # Import yt-dlp after successful installation check
    import yt_dlp
    
    # If no URL was provided via command line, ask for it
    url = args.url
    if not url:
        url = input("\nEnter YouTube URL: ").strip()
    
    # Validate the URL
    if not is_valid_youtube_url(url):
        print("Error: Invalid YouTube URL")
        return
    
    # Get video information
    print("\nFetching video information...")
    info = get_video_info(url)
    
    if not info:
        print("Failed to retrieve video information.")
        return
    
    # Display video information
    display_video_info(info)
    
    # If info-only mode, exit here
    if args.info:
        if not args.no_wait:
            wait_for_exit()
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
        # Display available formats and prompt for selection
        all_formats = display_formats(info, ffmpeg_installed)
        
        if not all_formats:
            print("No formats available for this video.")
            return
        
        format_selection = input("\nEnter format selection (format ID or special option): ").strip()
        
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
    
    # Download the video
    print(f"\nPreparing to download...")
    
    if format_selection == 'high':
        if ffmpeg_installed:
            print("Selected high quality mode - will download best video and audio streams and merge them")
        else:
            print("FFmpeg not available - downloading best combined format instead")
    
    actual_output_dir, success = download_video(url, format_selection, args.output, ffmpeg_installed)
    
    if success:
        print("\nDownload completed successfully!")
        # Show the output directory
        print(f"\nVideo saved to: {actual_output_dir}")
        
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