#!/usr/bin/env python3
"""
YouTube Video Downloader

A command-line tool to download YouTube videos locally and convert audio files.
Uses yt-dlp library for downloading videos with format selection.
Uses FFmpeg for audio format conversion.

Features:
- Quality selection
- Multiple format support (MP4, MP3, etc.)
- Audio format conversion
- Metadata display
- Download progress tracking
- File size and quality estimation
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

# Get audio file metadata using FFmpeg
def get_audio_metadata(file_path):
    """Extract metadata from audio file using FFprobe (part of FFmpeg)"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            file_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
    except Exception as e:
        print(f"Error getting audio metadata: {e}")
        return None

# Estimate output file size based on bitrate and duration
def estimate_output_size(duration_seconds, bitrate_kbps):
    """Estimate output file size in bytes"""
    # Size = (bitrate in kbps * duration in seconds) / 8 / 1024 (to get MB)
    # Then convert back to bytes
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
    
    # Build FFmpeg command
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
        # Run FFmpeg conversion
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"\nConversion successful!")
            print(f"Output file: {output_file}")
            print(f"Output size: {format_size(os.path.getsize(output_file))}")
            return True
        else:
            print(f"\nConversion failed!")
            print(f"Error: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"\nConversion error: {e}")
        return False

# Audio conversion workflow
def audio_conversion_workflow():
    """Interactive workflow for audio file conversion"""
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
    
    # Validate input file
    if not os.path.isfile(input_file):
        print(f"\nError: File '{input_file}' not found.")
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

# Main menu for choosing between video download and audio conversion
def show_main_menu():
    """Display main menu and get user choice"""
    print("\n" + "="*80)
    print("So what is my purpose?".center(80))
    print("="*80)
    print("\nPlease select an option:")
    print("  1. Download YouTube video")
    print("  2. Convert audio/music file")
    print("  3. Exit")
    print("-"*80)
    
    choice = input("Enter your choice (1-3): ").strip()
    return choice

# YouTube download workflow
def youtube_download_workflow(args=None, ffmpeg_installed=True):
    """Interactive workflow for YouTube video download"""
    # Import yt-dlp
    import yt_dlp
    
    # If no URL was provided via command line, ask for it
    url = args.url if args and args.url else None
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
    if args and args.info:
        return
    
    # Determine format selection
    format_selection = None
    
    if args and args.mp3:
        format_selection = 'mp3'
        if not ffmpeg_installed:
            print("\nWarning: FFmpeg is required for MP3 conversion.")
            print("The audio will be downloaded in its original format instead.")
    elif args and args.mp4:
        format_selection = 'mp4'
    elif args and args.high:
        format_selection = 'high'
        if not ffmpeg_installed:
            print("\nWarning: FFmpeg is required for high quality downloads to merge video and audio.")
            print("Falling back to best available combined format.")
    elif args and args.format:
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
    
    output_dir = args.output if args and args.output else 'youtube_downloads'
    actual_output_dir, success = download_video(url, format_selection, output_dir, ffmpeg_installed)
    
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

# Main function
def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='YouTube Video Downloader and Audio Converter')
    parser.add_argument('url', nargs='?', help='YouTube video URL')
    parser.add_argument('-f', '--format', help='Specify format code directly')
    parser.add_argument('-o', '--output', default='youtube_downloads', help='Output directory (default: youtube_downloads in your home directory)')
    parser.add_argument('-i', '--info', action='store_true', help='Show video info only without downloading')
    parser.add_argument('-m', '--mp3', action='store_true', help='Convert to MP3 audio')
    parser.add_argument('--mp4', action='store_true', help='Download as MP4 video')
    parser.add_argument('--high', action='store_true', help='Download high quality video+audio')
    parser.add_argument('--convert', action='store_true', help='Launch audio conversion mode')
    parser.add_argument('--no-wait', action='store_true', help='Do not wait for user input at the end')
    
    args = parser.parse_args()
    
    # Display banner
    print("\n" + "="*80)
    print("YouTube Video Downloader & Audio Converter".center(80))
    print("Download YouTube videos and convert audio files".center(80))
    print(f"Version 2.0.0 - Last updated: 2025-12-06".center(80))
    print("="*80)
    
    # Check if dependencies are installed
    yt_dlp_installed, ffmpeg_installed = check_dependencies()
    if not yt_dlp_installed:
        return
    
    # If convert flag is set, go directly to audio conversion
    if args.convert:
        audio_conversion_workflow()
        return
    
    # If URL is provided via command line, go directly to download
    if args.url:
        youtube_download_workflow(args, ffmpeg_installed)
        return
    
    # Show main menu if no URL provided
    while True:
        choice = show_main_menu()
        
        if choice == '1':
            # YouTube download
            youtube_download_workflow(args, ffmpeg_installed)
            break
        elif choice == '2':
            # Audio conversion
            audio_conversion_workflow()
            break
        elif choice == '3':
            # Exit
            print("\nGoodbye!")
            return
        else:
            print("\nInvalid choice. Please enter 1, 2, or 3.")
            time.sleep(1)

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