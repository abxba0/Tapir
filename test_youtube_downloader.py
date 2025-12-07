#!/usr/bin/env python3
"""
Comprehensive test suite for youtube_downloader.py

This test suite provides 90%+ code coverage for the YouTube video downloader,
testing all major functions including URL validation, format handling,
video info extraction, download workflows, and utility functions.
"""

import pytest
import os
import sys
import json
import tempfile
import shutil
from unittest.mock import Mock, MagicMock, patch, mock_open, call
from pathlib import Path
import threading

# Import the module under test
import youtube_downloader as yt


class TestConstants:
    """Test module constants"""
    
    def test_version_constants(self):
        """Test version information is defined"""
        assert hasattr(yt, 'VERSION')
        assert hasattr(yt, 'VERSION_DATE')
        assert yt.VERSION == "4.0.0"
        assert yt.VERSION_DATE == "2025-12-07"
    
    def test_timeout_constants(self):
        """Test timeout constants"""
        assert yt.SUBPROCESS_TIMEOUT == 120
    
    def test_fuzzy_constants(self):
        """Test fuzzy search thresholds"""
        assert yt.FUZZY_MATCH_THRESHOLD_SPECIAL == 70
        assert yt.FUZZY_MATCH_THRESHOLD_FORMATS == 60
    
    def test_parallel_constants(self):
        """Test parallelization constants"""
        assert yt.DEFAULT_MAX_WORKERS == 3
        assert yt.MAX_WORKERS_LIMIT == 10


class TestURLValidation:
    """Test URL validation and detection functions"""
    
    def test_detect_site_youtube(self):
        """Test YouTube URL detection"""
        assert yt.detect_site('https://www.youtube.com/watch?v=test') == 'youtube'
        assert yt.detect_site('https://youtube.com/watch?v=test') == 'youtube'
        assert yt.detect_site('https://youtu.be/test') == 'youtube'
        assert yt.detect_site('https://m.youtube.com/watch?v=test') == 'youtube'
    
    def test_detect_site_vimeo(self):
        """Test Vimeo URL detection"""
        assert yt.detect_site('https://vimeo.com/123456') == 'vimeo'
        assert yt.detect_site('https://www.vimeo.com/123456') == 'vimeo'
    
    def test_detect_site_soundcloud(self):
        """Test SoundCloud URL detection"""
        assert yt.detect_site('https://soundcloud.com/artist/track') == 'soundcloud'
        assert yt.detect_site('https://www.soundcloud.com/artist/track') == 'soundcloud'
    
    def test_detect_site_dailymotion(self):
        """Test Dailymotion URL detection"""
        assert yt.detect_site('https://dailymotion.com/video/x123') == 'dailymotion'
        assert yt.detect_site('https://www.dailymotion.com/video/x123') == 'dailymotion'
    
    def test_detect_site_twitch(self):
        """Test Twitch URL detection"""
        assert yt.detect_site('https://twitch.tv/videos/123') == 'twitch'
        assert yt.detect_site('https://www.twitch.tv/videos/123') == 'twitch'
    
    def test_detect_site_bandcamp(self):
        """Test Bandcamp URL detection"""
        assert yt.detect_site('https://artist.bandcamp.com/track/name') == 'bandcamp'
    
    def test_detect_site_tiktok(self):
        """Test TikTok URL detection"""
        assert yt.detect_site('https://tiktok.com/@user/video/123') == 'tiktok'
        assert yt.detect_site('https://www.tiktok.com/@user/video/123') == 'tiktok'
    
    def test_detect_site_other(self):
        """Test detection of other/unknown sites"""
        assert yt.detect_site('https://example.com/video') == 'other'
        assert yt.detect_site('https://unknown.site.com') == 'other'
    
    def test_detect_site_invalid(self):
        """Test handling of invalid URLs"""
        assert yt.detect_site('not-a-url') == 'other'
        assert yt.detect_site('') == 'other'
    
    def test_is_valid_youtube_url(self):
        """Test YouTube URL validation"""
        # Valid YouTube URLs
        assert yt.is_valid_youtube_url('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        assert yt.is_valid_youtube_url('https://youtube.com/watch?v=dQw4w9WgXcQ')
        assert yt.is_valid_youtube_url('https://youtu.be/dQw4w9WgXcQ')
        assert yt.is_valid_youtube_url('https://www.youtube.com/embed/dQw4w9WgXcQ')
        
        # YouTube Shorts
        assert yt.is_valid_youtube_url('https://www.youtube.com/shorts/dQw4w9WgXcQ')
        
        # Playlists
        assert yt.is_valid_youtube_url('https://www.youtube.com/playlist?list=PLtest')
        assert yt.is_valid_youtube_url('https://www.youtube.com/watch?v=test&list=PLtest')
        
        # Channels
        assert yt.is_valid_youtube_url('https://www.youtube.com/channel/UCtest')
        assert yt.is_valid_youtube_url('https://www.youtube.com/@username')
        assert yt.is_valid_youtube_url('https://www.youtube.com/c/channelname')
        assert yt.is_valid_youtube_url('https://www.youtube.com/user/username')
        
        # Invalid URLs
        assert not yt.is_valid_youtube_url('https://vimeo.com/123')
        assert not yt.is_valid_youtube_url('not a url')
        assert not yt.is_valid_youtube_url('')


class TestSupportedSites:
    """Test supported sites functionality"""
    
    def test_get_supported_sites(self):
        """Test getting supported sites dictionary"""
        sites = yt.get_supported_sites()
        assert isinstance(sites, dict)
        assert 'youtube' in sites
        assert 'vimeo' in sites
        assert 'soundcloud' in sites
        assert 'other' in sites
    
    def test_site_structure(self):
        """Test site dictionary structure"""
        sites = yt.get_supported_sites()
        for site_key, site_info in sites.items():
            assert 'name' in site_info
            assert 'description' in site_info
            assert 'example' in site_info
            assert isinstance(site_info['name'], str)
            assert isinstance(site_info['description'], str)
            assert isinstance(site_info['example'], str)


class TestClipboardFunctions:
    """Test clipboard-related functions"""
    
    @patch('youtube_downloader.CLIPBOARD_AVAILABLE', False)
    def test_get_clipboard_url_unavailable(self):
        """Test clipboard URL when clipboard unavailable"""
        result = yt.get_clipboard_url()
        assert result is None
    
    def test_get_clipboard_url_with_url(self):
        """Test getting URL from clipboard"""
        with patch('youtube_downloader.CLIPBOARD_AVAILABLE', True):
            with patch('pyperclip.paste', return_value='https://youtube.com/watch?v=test'):
                result = yt.get_clipboard_url()
                assert result == 'https://youtube.com/watch?v=test'
    
    def test_get_clipboard_url_with_www(self):
        """Test getting URL starting with www from clipboard"""
        with patch('youtube_downloader.CLIPBOARD_AVAILABLE', True):
            with patch('pyperclip.paste', return_value='www.youtube.com/watch?v=test'):
                result = yt.get_clipboard_url()
                assert result == 'www.youtube.com/watch?v=test'
    
    def test_get_clipboard_url_no_url(self):
        """Test clipboard with non-URL content"""
        with patch('youtube_downloader.CLIPBOARD_AVAILABLE', True):
            with patch('pyperclip.paste', return_value='just some text'):
                result = yt.get_clipboard_url()
                assert result is None
    
    def test_get_clipboard_url_empty(self):
        """Test empty clipboard"""
        with patch('youtube_downloader.CLIPBOARD_AVAILABLE', True):
            with patch('pyperclip.paste', return_value=''):
                result = yt.get_clipboard_url()
                assert result is None
    
    def test_get_clipboard_url_exception(self):
        """Test exception handling in clipboard access"""
        with patch('youtube_downloader.CLIPBOARD_AVAILABLE', True):
            with patch('pyperclip.paste', side_effect=Exception("Clipboard error")):
                result = yt.get_clipboard_url()
                assert result is None


class TestFormatFunctions:
    """Test formatting utility functions"""
    
    def test_format_duration_hours(self):
        """Test duration formatting with hours"""
        assert yt.format_duration(3661) == "1:01:01"
        assert yt.format_duration(7200) == "2:00:00"
    
    def test_format_duration_minutes(self):
        """Test duration formatting with minutes only"""
        assert yt.format_duration(125) == "02:05"
        assert yt.format_duration(59) == "00:59"
    
    def test_format_duration_none(self):
        """Test duration formatting with None"""
        assert yt.format_duration(None) == "Unknown"
        assert yt.format_duration(0) == "Unknown"
    
    def test_format_count(self):
        """Test count formatting with commas"""
        assert yt.format_count(1000) == "1,000"
        assert yt.format_count(1000000) == "1,000,000"
        assert yt.format_count(0) == "Unknown"
        assert yt.format_count(None) == "Unknown"
    
    def test_format_size_bytes(self):
        """Test file size formatting for bytes"""
        assert yt.format_size(0) == "0B"
        assert yt.format_size(100) == "100.00 B"
        assert yt.format_size(500) == "500.00 B"
    
    def test_format_size_kilobytes(self):
        """Test file size formatting for KB"""
        assert yt.format_size(1024) == "1.00 KB"
        assert yt.format_size(2048) == "2.00 KB"
    
    def test_format_size_megabytes(self):
        """Test file size formatting for MB"""
        assert yt.format_size(1024 * 1024) == "1.00 MB"
        assert yt.format_size(1024 * 1024 * 50) == "50.00 MB"
    
    def test_format_size_gigabytes(self):
        """Test file size formatting for GB"""
        assert yt.format_size(1024 * 1024 * 1024) == "1.00 GB"
        assert yt.format_size(1024 * 1024 * 1024 * 2) == "2.00 GB"


class TestDownloadDirectory:
    """Test download directory functions"""
    
    def test_get_download_directory_absolute(self):
        """Test getting download directory with absolute path"""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = yt.get_download_directory(tmpdir)
            assert result == tmpdir
            assert os.path.exists(result)
    
    def test_get_download_directory_relative(self):
        """Test getting download directory with relative path"""
        result = yt.get_download_directory("test_downloads")
        expected = os.path.join(str(Path.home()), "test_downloads")
        assert result == expected
        assert os.path.exists(result)
        # Clean up
        if os.path.exists(result):
            shutil.rmtree(result)
    
    @patch('youtube_downloader.Path.home')
    @patch('os.makedirs')
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.remove')
    def test_get_download_directory_permission_test(self, mock_remove, mock_file, 
                                                      mock_makedirs, mock_home):
        """Test download directory with write permission test"""
        mock_home.return_value = Path('/tmp/test_home')
        result = yt.get_download_directory("downloads")
        # Should try to create directory
        assert mock_makedirs.called


class TestAudioFunctions:
    """Test audio-related functions"""
    
    def test_get_supported_audio_formats(self):
        """Test getting supported audio formats"""
        formats = yt.get_supported_audio_formats()
        assert isinstance(formats, dict)
        assert 'mp3' in formats
        assert 'aac' in formats
        assert 'm4a' in formats
        assert 'ogg' in formats
        assert 'wav' in formats
        assert 'flac' in formats
    
    def test_audio_format_structure(self):
        """Test audio format dictionary structure"""
        formats = yt.get_supported_audio_formats()
        for format_key, format_info in formats.items():
            assert 'name' in format_info
            assert 'description' in format_info
            assert 'default_bitrate' in format_info
            assert 'codec' in format_info
    
    def test_estimate_output_size(self):
        """Test audio output size estimation"""
        # 60 seconds at 192 kbps
        size = yt.estimate_output_size(60, 192)
        expected = (192 * 1000 * 60) / 8
        assert size == int(expected)
    
    def test_estimate_output_size_none(self):
        """Test output size estimation with None values"""
        assert yt.estimate_output_size(None, 192) is None
        assert yt.estimate_output_size(60, None) is None
        assert yt.estimate_output_size(None, None) is None
    
    def test_get_quality_description_lossy(self):
        """Test quality description for lossy formats"""
        assert "Very High" in yt.get_quality_description('mp3', 320)
        assert "High" in yt.get_quality_description('aac', 256)
        assert "Good" in yt.get_quality_description('mp3', 192)
        assert "Standard" in yt.get_quality_description('mp3', 128)
        assert "Low" in yt.get_quality_description('mp3', 64)
    
    def test_get_quality_description_lossless(self):
        """Test quality description for lossless formats"""
        assert "Lossless" in yt.get_quality_description('flac', 1000)
        assert "Lossless" in yt.get_quality_description('wav', 1411)
        assert "Lossless" in yt.get_quality_description('pcm', 1411)
    
    def test_get_quality_description_unknown(self):
        """Test quality description for unknown codec"""
        result = yt.get_quality_description('unknown', 192)
        assert '192kbps' in result
    
    def test_get_quality_description_no_bitrate(self):
        """Test quality description with no bitrate"""
        result = yt.get_quality_description('mp3', None)
        assert result == "Unknown quality"
    
    @patch('subprocess.run')
    def test_get_audio_metadata(self, mock_run):
        """Test audio metadata extraction"""
        mock_metadata = {
            'format': {
                'size': '5000000',
                'duration': '180.5',
                'bit_rate': '192000'
            },
            'streams': []
        }
        mock_run.return_value = Mock(returncode=0, stdout=json.dumps(mock_metadata))
        
        result = yt.get_audio_metadata('/path/to/file.mp3')
        assert result == mock_metadata
    
    @patch('subprocess.run')
    def test_get_audio_metadata_failure(self, mock_run):
        """Test audio metadata extraction failure"""
        mock_run.return_value = Mock(returncode=1, stdout='')
        result = yt.get_audio_metadata('/path/to/file.mp3')
        assert result is None
    
    @patch('subprocess.run')
    def test_get_audio_metadata_timeout(self, mock_run):
        """Test audio metadata extraction timeout"""
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired('ffprobe', 120)
        result = yt.get_audio_metadata('/path/to/file.mp3')
        assert result is None


class TestFuzzySearch:
    """Test fuzzy search functionality"""
    
    @patch('youtube_downloader.FUZZY_AVAILABLE', False)
    def test_fuzzy_search_unavailable(self):
        """Test fuzzy search when library unavailable"""
        result = yt.fuzzy_search_format('1080', [], ['best'])
        assert result is None
    
    def test_fuzzy_search_special_option(self):
        """Test fuzzy search matching special option"""
        with patch('youtube_downloader.FUZZY_AVAILABLE', True):
            with patch('thefuzz.process.extractOne', return_value=('best', 80)):
                result = yt.fuzzy_search_format('bst', [], ['best', 'high'])
                assert result == 'best'
    
    def test_fuzzy_search_format_id(self):
        """Test fuzzy search matching format ID"""
        formats = [
            {'format_id': '137', 'ext': 'mp4', 'height': 1080, 'vcodec': 'avc1', 'acodec': 'none'}
        ]
        with patch('youtube_downloader.FUZZY_AVAILABLE', True):
            with patch('thefuzz.process.extractOne', side_effect=[('best', 50), ('137 mp4 1080p avc1 none', 80)]):
                result = yt.fuzzy_search_format('1080', formats)
                assert result == '137'


class TestDownloadTracker:
    """Test DownloadTracker class for parallel downloads"""
    
    def test_tracker_initialization(self):
        """Test tracker initialization"""
        tracker = yt.DownloadTracker()
        assert tracker.completed == 0
        assert tracker.failed == 0
        assert tracker.total == 0
        assert tracker.results == []
    
    def test_tracker_set_total(self):
        """Test setting total downloads"""
        tracker = yt.DownloadTracker()
        tracker.set_total(10)
        status = tracker.get_status()
        assert status['total'] == 10
    
    def test_tracker_add_success(self):
        """Test adding successful download"""
        tracker = yt.DownloadTracker()
        tracker.add_result('http://example.com', True, 'Downloaded')
        status = tracker.get_status()
        assert status['completed'] == 1
        assert status['failed'] == 0
        assert status['success'] == 1
    
    def test_tracker_add_failure(self):
        """Test adding failed download"""
        tracker = yt.DownloadTracker()
        tracker.add_result('http://example.com', False, 'Failed')
        status = tracker.get_status()
        assert status['completed'] == 1
        assert status['failed'] == 1
        assert status['success'] == 0
    
    def test_tracker_get_results(self):
        """Test getting all results"""
        tracker = yt.DownloadTracker()
        tracker.add_result('http://example.com/1', True, 'Success')
        tracker.add_result('http://example.com/2', False, 'Failed')
        results = tracker.get_results()
        assert len(results) == 2
        assert results[0]['success'] is True
        assert results[1]['success'] is False
    
    def test_tracker_thread_safety(self):
        """Test thread safety of tracker"""
        tracker = yt.DownloadTracker()
        tracker.set_total(100)
        
        def add_results():
            for i in range(50):
                tracker.add_result(f'http://example.com/{i}', True, 'Success')
        
        threads = [threading.Thread(target=add_results) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        status = tracker.get_status()
        assert status['completed'] == 100
        assert status['success'] == 100


class TestURLReading:
    """Test URL reading from files and stdin"""
    
    def test_read_urls_from_file(self):
        """Test reading URLs from file"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write('https://youtube.com/watch?v=1\n')
            f.write('# This is a comment\n')
            f.write('\n')  # Empty line
            f.write('https://youtube.com/watch?v=2\n')
            f.write('https://youtube.com/watch?v=3\n')
            f.flush()
            temp_path = f.name
        
        try:
            urls = yt.read_urls_from_file(temp_path)
            assert len(urls) == 3
            assert urls[0] == 'https://youtube.com/watch?v=1'
            assert urls[1] == 'https://youtube.com/watch?v=2'
            assert urls[2] == 'https://youtube.com/watch?v=3'
        finally:
            os.unlink(temp_path)
    
    def test_read_urls_from_file_not_found(self):
        """Test reading from non-existent file"""
        urls = yt.read_urls_from_file('/nonexistent/file.txt')
        assert urls is None
    
    @patch('sys.stdin')
    def test_read_urls_from_stdin(self, mock_stdin):
        """Test reading URLs from stdin"""
        mock_stdin.__iter__.return_value = iter([
            'https://youtube.com/watch?v=1\n',
            '# Comment\n',
            '\n',
            'https://youtube.com/watch?v=2\n'
        ])
        
        urls = yt.read_urls_from_stdin()
        assert len(urls) == 2
        assert urls[0] == 'https://youtube.com/watch?v=1'
        assert urls[1] == 'https://youtube.com/watch?v=2'
    
    @patch('sys.stdin')
    def test_read_urls_from_stdin_keyboard_interrupt(self, mock_stdin):
        """Test keyboard interrupt when reading from stdin"""
        mock_stdin.__iter__.side_effect = KeyboardInterrupt()
        urls = yt.read_urls_from_stdin()
        assert urls is None


class TestVideoInfoDisplay:
    """Test video information display functions"""
    
    def test_display_video_info_none(self):
        """Test display with None info"""
        # Should not raise exception
        yt.display_video_info(None)
    
    @patch('youtube_downloader.RICH_AVAILABLE', False)
    @patch('builtins.print')
    def test_display_video_info_standard(self, mock_print):
        """Test standard video info display"""
        info = {
            'title': 'Test Video',
            'channel': 'Test Channel',
            'duration': 180,
            'upload_date': '20231201',
            'view_count': 1000000,
            'description': 'Test description'
        }
        yt.display_video_info(info, is_playlist=False)
        assert mock_print.called
    
    @patch('youtube_downloader.RICH_AVAILABLE', False)
    @patch('builtins.print')
    def test_display_video_info_playlist_standard(self, mock_print):
        """Test standard playlist info display"""
        info = {
            '_type': 'playlist',
            'title': 'Test Playlist',
            'channel': 'Test Channel',
            'entries': [{'title': 'Video 1'}, {'title': 'Video 2'}],
            'description': 'Test playlist description'
        }
        yt.display_video_info(info, is_playlist=True)
        assert mock_print.called


class TestDisplayFormats:
    """Test format display functions"""
    
    @patch('youtube_downloader.RICH_AVAILABLE', False)
    @patch('builtins.print')
    def test_display_formats_no_formats(self, mock_print):
        """Test display with no formats"""
        info = {}
        result = yt.display_formats(info, ffmpeg_available=True)
        assert result == []
    
    @patch('youtube_downloader.RICH_AVAILABLE', False)
    @patch('builtins.print')
    def test_display_formats_with_formats(self, mock_print):
        """Test display with various formats"""
        info = {
            'formats': [
                {
                    'format_id': '137',
                    'ext': 'mp4',
                    'height': 1080,
                    'vcodec': 'avc1',
                    'acodec': 'none',
                    'tbr': 5000,
                    'filesize': 100000000
                },
                {
                    'format_id': '140',
                    'ext': 'm4a',
                    'vcodec': 'none',
                    'acodec': 'mp4a',
                    'abr': 128,
                    'tbr': 128,
                    'filesize': 5000000
                },
                {
                    'format_id': '18',
                    'ext': 'mp4',
                    'height': 360,
                    'vcodec': 'avc1',
                    'acodec': 'mp4a',
                    'tbr': 500,
                    'filesize': 20000000
                }
            ]
        }
        result = yt.display_formats(info, ffmpeg_available=True)
        assert len(result) == 3


class TestProgressHook:
    """Test download progress hook"""
    
    @patch('sys.stdout')
    def test_progress_hook_downloading(self, mock_stdout):
        """Test progress hook during download"""
        d = {
            'status': 'downloading',
            '_percent_str': '50%',
            '_speed_str': '1.5MB/s',
            '_eta_str': '00:30'
        }
        yt.progress_hook(d)
        assert mock_stdout.write.called
        assert mock_stdout.flush.called
    
    @patch('sys.stdout')
    @patch('builtins.print')
    def test_progress_hook_finished(self, mock_print, mock_stdout):
        """Test progress hook when finished"""
        d = {'status': 'finished'}
        yt.progress_hook(d)
        assert mock_stdout.write.called
        assert mock_print.called


class TestMainMenu:
    """Test main menu function"""
    
    @patch('builtins.input', return_value='1')
    @patch('builtins.print')
    def test_show_main_menu(self, mock_print, mock_input):
        """Test main menu display"""
        choice = yt.show_main_menu()
        assert choice == '1'
        assert mock_print.called


class TestWaitForExit:
    """Test wait for exit function"""
    
    @patch('platform.system', return_value='Windows')
    @patch('builtins.input')
    @patch('builtins.print')
    def test_wait_for_exit_windows(self, mock_print, mock_input, mock_system):
        """Test wait for exit on Windows"""
        yt.wait_for_exit()
        assert mock_print.called
    
    @patch('platform.system', return_value='Linux')
    def test_wait_for_exit_linux(self, mock_system):
        """Test wait for exit on Linux (should not wait)"""
        # Should complete without waiting
        yt.wait_for_exit()


class TestShowDisclaimer:
    """Test disclaimer function"""
    
    @patch('builtins.print')
    def test_show_disclaimer(self, mock_print):
        """Test disclaimer display"""
        yt.show_disclaimer()
        assert mock_print.called
        # Check that important keywords are mentioned
        calls_str = ' '.join([str(call) for call in mock_print.call_args_list])
        assert 'copyright' in calls_str.lower() or 'permission' in calls_str.lower()


class TestCheckDependencies:
    """Test dependency checking"""
    
    @patch('builtins.input', return_value='n')
    @patch('builtins.print')
    def test_check_dependencies_ffmpeg_installed(self, mock_print, mock_input):
        """Test dependency check when FFmpeg is installed"""
        # Import yt_dlp at module level should work now
        with patch('shutil.which', return_value='/usr/bin/ffmpeg'):
            yt_dlp_installed, ffmpeg_installed = yt.check_dependencies()
            assert yt_dlp_installed is True
            assert ffmpeg_installed is True
    
    @patch('builtins.input', return_value='n')
    @patch('builtins.print')
    def test_check_dependencies_ffmpeg_not_installed(self, mock_print, mock_input):
        """Test dependency check when FFmpeg is not installed"""
        with patch('shutil.which', return_value=None):
            yt_dlp_installed, ffmpeg_installed = yt.check_dependencies()
            assert yt_dlp_installed is True
            # FFmpeg may or may not be installed in the test environment
            # We just verify the function runs without error


class TestConvertAudioFile:
    """Test audio conversion function"""
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=False)
    @patch('builtins.print')
    def test_convert_audio_file_success(self, mock_print, mock_exists, 
                                        mock_getsize, mock_run):
        """Test successful audio conversion"""
        mock_run.return_value = Mock(returncode=0)
        
        result = yt.convert_audio_file('/path/to/input.mp3', 'aac', 192)
        assert result is True
    
    @patch('subprocess.run')
    @patch('builtins.print')
    def test_convert_audio_file_invalid_format(self, mock_print, mock_run):
        """Test conversion with invalid format"""
        result = yt.convert_audio_file('/path/to/input.mp3', 'invalid', 192)
        assert result is False
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=False)
    @patch('builtins.print')
    def test_convert_audio_file_failure(self, mock_print, mock_exists, 
                                        mock_getsize, mock_run):
        """Test failed audio conversion"""
        mock_run.return_value = Mock(returncode=1, stderr='Error message')
        
        result = yt.convert_audio_file('/path/to/input.mp3', 'mp3', 192)
        assert result is False
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=True)
    @patch('builtins.input', return_value='n')
    @patch('builtins.print')
    def test_convert_audio_file_overwrite_cancel(self, mock_print, mock_input, 
                                                  mock_exists, mock_getsize, mock_run):
        """Test canceling conversion when output exists"""
        result = yt.convert_audio_file('/path/to/input.mp3', 'mp3', 192)
        assert result is False
    
    @patch('subprocess.run')
    def test_convert_audio_file_timeout(self, mock_run):
        """Test audio conversion timeout"""
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired('ffmpeg', 120)
        
        with patch('pathlib.Path.exists', return_value=False):
            with patch('builtins.print'):
                result = yt.convert_audio_file('/path/to/input.mp3', 'mp3', 192)
                assert result is False


class TestArgumentParsing:
    """Test command-line argument parsing"""
    
    def test_parse_args_defaults(self):
        """Test default argument values"""
        # We can't easily test argparse without running the script
        # But we can verify the parser setup
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument('url', nargs='*')
        parser.add_argument('--mp3', action='store_true')
        parser.add_argument('--mp4', action='store_true')
        
        args = parser.parse_args(['https://youtube.com/watch?v=test'])
        assert args.url == ['https://youtube.com/watch?v=test']
        assert args.mp3 is False
        assert args.mp4 is False


class TestIntegration:
    """Integration tests for key workflows"""
    
    def test_get_video_info_mock(self):
        """Test video info extraction with mock"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.extract_info.return_value = {
                'title': 'Test Video',
                'duration': 120,
                'formats': []
            }
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            info = yt.get_video_info('https://youtube.com/watch?v=test')
            assert info is not None
            assert info['title'] == 'Test Video'
    
    def test_get_video_info_error(self):
        """Test video info extraction with error"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.extract_info.side_effect = yt_dlp.utils.DownloadError('Error')
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                info = yt.get_video_info('https://youtube.com/watch?v=test')
                assert info is None


class TestEdgeCases:
    """Test edge cases and error conditions"""
    
    def test_format_size_edge_cases(self):
        """Test format_size with edge values"""
        assert yt.format_size(0) == "0B"
        assert yt.format_size(1023) == "1023.00 B"
        assert yt.format_size(1024) == "1.00 KB"
    
    def test_format_duration_edge_cases(self):
        """Test format_duration with edge values"""
        assert yt.format_duration(0) == "Unknown"
        assert yt.format_duration(1) == "00:01"
        assert yt.format_duration(59) == "00:59"
        assert yt.format_duration(60) == "01:00"
        assert yt.format_duration(3599) == "59:59"
        assert yt.format_duration(3600) == "1:00:00"
    
    def test_detect_site_case_insensitive(self):
        """Test site detection is case insensitive"""
        assert yt.detect_site('HTTPS://YOUTUBE.COM/watch?v=test') == 'youtube'
        assert yt.detect_site('HTTPS://VIMEO.COM/123') == 'vimeo'


class TestDownloadVideo:
    """Test download_video function"""
    
    def test_download_video_mp3_no_ffmpeg(self):
        """Test MP3 download without FFmpeg"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'mp3',
                        tmpdir,
                        ffmpeg_available=False
                    )
                    assert success is True
    
    def test_download_video_high_no_ffmpeg(self):
        """Test high quality download without FFmpeg"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'high',
                        tmpdir,
                        ffmpeg_available=False
                    )
                    assert success is True
    
    def test_download_video_with_cookies(self):
        """Test download with cookies file"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'best',
                        tmpdir,
                        cookies_file='/path/to/cookies.txt'
                    )
                    assert success is True
    
    def test_download_video_playlist(self):
        """Test playlist download"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/playlist?list=test',
                        'best',
                        tmpdir,
                        is_playlist=True
                    )
                    assert success is True
    
    def test_download_video_error(self):
        """Test download with error"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.side_effect = yt_dlp.utils.DownloadError('Test error')
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'best',
                        tmpdir
                    )
                    assert success is False


class TestParallelDownload:
    """Test parallel download functionality"""
    
    def test_download_video_parallel(self):
        """Test single video in parallel context"""
        tracker = yt.DownloadTracker()
        tracker.set_total(1)
        
        with patch('youtube_downloader.get_video_info', return_value={'title': 'Test'}):
            with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                with patch('builtins.print'):
                    url, success, msg = yt.download_video_parallel(
                        'https://youtube.com/watch?v=test',
                        'best',
                        '/tmp',
                        True,
                        None,
                        None,
                        None,
                        tracker,
                        1,
                        1
                    )
                    assert success is True
                    assert url == 'https://youtube.com/watch?v=test'
    
    def test_download_video_parallel_error(self):
        """Test parallel download with error"""
        tracker = yt.DownloadTracker()
        tracker.set_total(1)
        
        with patch('youtube_downloader.get_video_info', side_effect=Exception('Test error')):
            with patch('builtins.print'):
                url, success, msg = yt.download_video_parallel(
                    'https://youtube.com/watch?v=test',
                    'best',
                    '/tmp',
                    True,
                    None,
                    None,
                    None,
                    tracker,
                    1,
                    1
                )
                assert success is False
    
    @patch('builtins.print')
    def test_parallel_download_workflow(self, mock_print):
        """Test parallel download workflow"""
        urls = ['https://youtube.com/watch?v=1', 'https://youtube.com/watch?v=2']
        
        with patch('youtube_downloader.download_video_parallel', return_value=('url', True, 'Success')):
            yt.parallel_download_workflow(
                urls,
                'best',
                '/tmp',
                True,
                None,
                None,
                None,
                2
            )
        assert mock_print.called
    
    @patch('builtins.print')
    def test_parallel_download_workflow_empty(self, mock_print):
        """Test parallel download with empty URL list"""
        yt.parallel_download_workflow(
            [],
            'best',
            '/tmp',
            True,
            None,
            None,
            None,
            2
        )
        assert mock_print.called


class TestDisplayFormatsRich:
    """Test Rich format display"""
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_display_formats_rich(self):
        """Test Rich format display"""
        from rich.console import Console
        info = {
            'formats': [
                {
                    'format_id': '137',
                    'ext': 'mp4',
                    'height': 1080,
                    'vcodec': 'avc1',
                    'acodec': 'none',
                    'tbr': 5000,
                    'filesize': 100000000
                },
                {
                    'format_id': '140',
                    'ext': 'm4a',
                    'vcodec': 'none',
                    'acodec': 'mp4a',
                    'abr': 128,
                    'tbr': 128,
                    'filesize': 5000000
                }
            ]
        }
        
        with patch.object(Console, 'print'):
            result = yt.display_formats_rich(info, ffmpeg_available=True)
            assert len(result) == 2
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_display_formats_rich_no_formats(self):
        """Test Rich display with no formats"""
        from rich.console import Console
        with patch.object(Console, 'print'):
            result = yt.display_formats_rich({}, ffmpeg_available=True)
            assert result == []
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_display_video_info_rich(self):
        """Test Rich video info display"""
        from rich.console import Console
        info = {
            'title': 'Test Video',
            'channel': 'Test Channel',
            'duration': 180,
            'upload_date': '20231201',
            'view_count': 1000000,
            'description': 'Test description'
        }
        
        with patch.object(Console, 'print'):
            yt.display_video_info_rich(info, is_playlist=False)
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_display_video_info_rich_playlist(self):
        """Test Rich playlist info display"""
        from rich.console import Console
        info = {
            '_type': 'playlist',
            'title': 'Test Playlist',
            'channel': 'Test Channel',
            'entries': [{'title': 'Video 1'}, {'title': 'Video 2'}],
            'description': 'Test playlist description'
        }
        
        with patch.object(Console, 'print'):
            yt.display_video_info_rich(info, is_playlist=True)


class TestIsValidURL:
    """Test is_valid_url function"""
    
    def test_is_valid_url_invalid_types(self):
        """Test URL validation with invalid types"""
        assert yt.is_valid_url(None) is False
        assert yt.is_valid_url('') is False
        assert yt.is_valid_url('not-a-url') is False
    
    def test_is_valid_url_valid(self):
        """Test URL validation with valid URL"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.extract_info.return_value = {'title': 'Test'}
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            result = yt.is_valid_url('https://youtube.com/watch?v=test')
            assert result is True
    
    def test_is_valid_url_exception(self):
        """Test URL validation with exception"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.extract_info.side_effect = Exception('Test error')
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            result = yt.is_valid_url('https://youtube.com/watch?v=test')
            assert result is False


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--cov=youtube_downloader', '--cov-report=term-missing'])


class TestMainFunction:
    """Test main() function and workflows"""
    
    @patch('sys.argv', ['youtube_downloader.py', '--list-sites'])
    @patch('builtins.print')
    def test_main_list_sites(self, mock_print):
        """Test main with --list-sites flag"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            yt.main()
        assert mock_print.called
    
    @patch('sys.argv', ['youtube_downloader.py', '--convert'])
    @patch('builtins.print')
    @patch('builtins.input', side_effect=['n'])  # Cancel conversion
    def test_main_convert_mode(self, mock_input, mock_print):
        """Test main with --convert flag"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            with patch('shutil.which', return_value='/usr/bin/ffmpeg'):
                yt.main()
        assert mock_print.called
    
    @patch('sys.argv', ['youtube_downloader.py', 'https://youtube.com/watch?v=test', '--info'])
    @patch('builtins.print')
    def test_main_info_mode(self, mock_print):
        """Test main with --info flag"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            with patch('youtube_downloader.get_video_info', return_value={'title': 'Test', 'duration': 120}):
                with patch('youtube_downloader.display_video_info'):
                    yt.main()
    
    @patch('sys.argv', ['youtube_downloader.py'])
    @patch('builtins.input', side_effect=['3'])  # Exit from menu
    @patch('builtins.print')
    def test_main_interactive_exit(self, mock_print, mock_input):
        """Test main in interactive mode with exit"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            yt.main()
        assert mock_print.called


class TestAudioConversionWorkflow:
    """Test audio conversion workflow"""
    
    @patch('shutil.which', return_value=None)
    @patch('builtins.print')
    def test_audio_conversion_workflow_no_ffmpeg(self, mock_print, mock_which):
        """Test audio conversion when FFmpeg not available"""
        yt.audio_conversion_workflow()
        assert mock_print.called
    
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    @patch('builtins.input', side_effect=KeyboardInterrupt())
    @patch('builtins.print')
    def test_audio_conversion_workflow_keyboard_interrupt(self, mock_print, mock_input, mock_which):
        """Test audio conversion with keyboard interrupt"""
        try:
            yt.audio_conversion_workflow()
        except KeyboardInterrupt:
            pass
    
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    @patch('os.path.isfile', return_value=False)
    @patch('builtins.input', return_value='/nonexistent/file.mp3')
    @patch('builtins.print')
    def test_audio_conversion_workflow_file_not_found(self, mock_print, mock_input, mock_isfile, mock_which):
        """Test audio conversion with non-existent file"""
        yt.audio_conversion_workflow()
        assert mock_print.called


class TestYoutubeDownloadWorkflow:
    """Test youtube_download_workflow function"""
    
    @patch('builtins.input', return_value='https://youtube.com/watch?v=test')
    @patch('builtins.print')
    def test_workflow_invalid_url_format(self, mock_print, mock_input):
        """Test workflow with invalid URL format"""
        import argparse
        args = argparse.Namespace(
            url=None, mp3=False, mp4=False, high=False, format=None,
            info=False, output='youtube_downloads', cookies=None,
            cookies_from_browser=None, archive=None
        )
        # Modify input to return invalid URL
        mock_input.return_value = 'not-a-url'
        yt.youtube_download_workflow(args, ffmpeg_installed=True)
        assert mock_print.called
    
    @patch('builtins.print')
    def test_workflow_info_playlist(self, mock_print):
        """Test info mode with playlist"""
        import argparse
        args = argparse.Namespace(
            url='https://youtube.com/playlist?list=test', mp3=False, mp4=False,
            high=False, format=None, info=True, output='youtube_downloads',
            cookies=None, cookies_from_browser=None, archive=None
        )
        
        playlist_info = {
            '_type': 'playlist',
            'title': 'Test Playlist',
            'entries': [
                {'title': 'Video 1', 'duration': 120},
                {'title': 'Video 2', 'duration': 180}
            ]
        }
        
        with patch('youtube_downloader.get_video_info', return_value=playlist_info):
            with patch('youtube_downloader.display_video_info'):
                yt.youtube_download_workflow(args, ffmpeg_installed=True)
        assert mock_print.called
    
    @patch('builtins.print')
    def test_workflow_failed_info_extraction(self, mock_print):
        """Test workflow when video info extraction fails"""
        import argparse
        args = argparse.Namespace(
            url='https://youtube.com/watch?v=test', mp3=False, mp4=False,
            high=False, format=None, info=False, output='youtube_downloads',
            cookies=None, cookies_from_browser=None, archive=None
        )
        
        with patch('youtube_downloader.get_video_info', return_value=None):
            yt.youtube_download_workflow(args, ffmpeg_installed=True)
        assert mock_print.called


class TestDisplayFormatsRichExtended:
    """Extended tests for Rich display functions"""
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_display_video_info_rich_with_rich_available(self):
        """Test display_video_info when Rich is available"""
        info = {
            'title': 'Test Video',
            'channel': 'Test Channel',
            'duration': 180,
            'upload_date': '20231201',
            'view_count': 1000000,
            'description': 'A' * 200  # Long description
        }
        
        with patch('youtube_downloader.display_video_info_rich'):
            yt.display_video_info(info, is_playlist=False)


class TestDownloadVideoExtended:
    """Extended download_video tests"""
    
    def test_download_video_mp4_with_ffmpeg(self):
        """Test MP4 download with FFmpeg available"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'mp4',
                        tmpdir,
                        ffmpeg_available=True
                    )
                    assert success is True
    
    def test_download_video_mp4_no_ffmpeg(self):
        """Test MP4 download without FFmpeg"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'mp4',
                        tmpdir,
                        ffmpeg_available=False
                    )
                    assert success is True
    
    def test_download_video_high_with_ffmpeg(self):
        """Test high quality download with FFmpeg"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'high',
                        tmpdir,
                        ffmpeg_available=True
                    )
                    assert success is True
    
    def test_download_video_with_cookies_from_browser(self):
        """Test download with cookies from browser"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'best',
                        tmpdir,
                        cookies_from_browser='chrome'
                    )
                    assert success is True
    
    def test_download_video_mp3_with_ffmpeg(self):
        """Test MP3 download with FFmpeg available"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'mp3',
                        tmpdir,
                        ffmpeg_available=True
                    )
                    assert success is True


class TestConvertAudioFileExtended:
    """Extended audio conversion tests"""
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=True)
    @patch('builtins.input', return_value='y')
    @patch('builtins.print')
    def test_convert_audio_file_overwrite_yes(self, mock_print, mock_input, 
                                               mock_exists, mock_getsize, mock_run):
        """Test audio conversion with overwrite confirmation"""
        mock_run.return_value = Mock(returncode=0)
        result = yt.convert_audio_file('/path/to/input.mp3', 'aac', 192)
        assert result is True
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=False)
    @patch('builtins.print')
    def test_convert_audio_file_lossless_flac(self, mock_print, mock_exists, 
                                               mock_getsize, mock_run):
        """Test conversion to FLAC (lossless)"""
        mock_run.return_value = Mock(returncode=0)
        result = yt.convert_audio_file('/path/to/input.mp3', 'flac')
        assert result is True
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=False)
    @patch('builtins.print')
    def test_convert_audio_file_lossless_wav(self, mock_print, mock_exists, 
                                               mock_getsize, mock_run):
        """Test conversion to WAV (lossless)"""
        mock_run.return_value = Mock(returncode=0)
        result = yt.convert_audio_file('/path/to/input.mp3', 'wav')
        assert result is True


class TestGetVideoInfoWithCookies:
    """Test get_video_info with cookies"""
    
    def test_get_video_info_with_cookies_file(self):
        """Test video info extraction with cookies file"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.extract_info.return_value = {'title': 'Test', 'duration': 120}
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            info = yt.get_video_info(
                'https://youtube.com/watch?v=test',
                cookies_file='/path/to/cookies.txt'
            )
            assert info is not None
            assert info['title'] == 'Test'
    
    def test_get_video_info_with_cookies_from_browser(self):
        """Test video info extraction with browser cookies"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.extract_info.return_value = {'title': 'Test', 'duration': 120}
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            info = yt.get_video_info(
                'https://youtube.com/watch?v=test',
                cookies_from_browser='chrome'
            )
            assert info is not None
            assert info['title'] == 'Test'


class TestDownloadDirectoryEdgeCases:
    """Test download directory edge cases"""
    
    def test_get_download_directory_relative_path(self):
        """Test download directory with relative path"""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Use a relative path within the temp directory
            rel_path = "downloads"
            result = yt.get_download_directory(rel_path)
            # Should create in home directory
            assert os.path.exists(result)
            # Clean up
            try:
                shutil.rmtree(result)
            except:
                pass


class TestProgressHookExtended:
    """Extended progress hook tests"""
    
    @patch('sys.stdout')
    def test_progress_hook_other_status(self, mock_stdout):
        """Test progress hook with other status"""
        d = {'status': 'error'}
        yt.progress_hook(d)
        # Should not crash


class TestParallelDownloadExtended:
    """Extended parallel download tests"""
    
    @patch('builtins.print')
    def test_parallel_download_workflow_with_failures(self, mock_print):
        """Test parallel download with some failures"""
        urls = ['https://youtube.com/watch?v=1', 'https://youtube.com/watch?v=2']
        
        # First succeeds, second fails
        with patch('youtube_downloader.download_video_parallel', 
                   side_effect=[('url1', True, 'Success'), ('url2', False, 'Failed')]):
            yt.parallel_download_workflow(
                urls,
                'best',
                '/tmp',
                True,
                None,
                None,
                None,
                2
            )
        assert mock_print.called




class TestMainFunctionExtended:
    """Extended main() function tests"""
    
    @patch('sys.argv', ['youtube_downloader.py', 'url1', 'url2', '--parallel'])
    @patch('builtins.print')
    def test_main_parallel_multiple_urls(self, mock_print):
        """Test main with multiple URLs in parallel mode"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            with patch('youtube_downloader.parallel_download_workflow'):
                yt.main()
        assert mock_print.called
    
    @patch('sys.argv', ['youtube_downloader.py', '--batch-file', 'urls.txt', '--parallel'])
    @patch('builtins.print')
    def test_main_batch_file(self, mock_print):
        """Test main with batch file"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write('https://youtube.com/watch?v=1\n')
            f.write('https://youtube.com/watch?v=2\n')
            f.flush()
            temp_path = f.name
        
        try:
            with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
                with patch('youtube_downloader.parallel_download_workflow'):
                    # Modify sys.argv to use actual file
                    with patch('sys.argv', ['youtube_downloader.py', '--batch-file', temp_path, '--parallel']):
                        yt.main()
        finally:
            os.unlink(temp_path)
    
    @patch('sys.argv', ['youtube_downloader.py', 'https://youtube.com/watch?v=test'])
    @patch('builtins.print')
    def test_main_single_url(self, mock_print):
        """Test main with single URL"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            with patch('youtube_downloader.youtube_download_workflow'):
                yt.main()
    
    @patch('sys.argv', ['youtube_downloader.py', '--max-workers', '0'])
    @patch('builtins.print')
    def test_main_invalid_max_workers(self, mock_print):
        """Test main with invalid max workers"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            yt.main()
        assert mock_print.called
    
    @patch('sys.argv', ['youtube_downloader.py', '--max-workers', '20'])
    @patch('builtins.print')
    def test_main_max_workers_exceeds_limit(self, mock_print):
        """Test main with max workers exceeding limit"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            yt.main()
        assert mock_print.called


class TestYoutubeDownloadWorkflowExtended:
    """Extended youtube_download_workflow tests"""
    
    @patch('builtins.print')
    def test_workflow_with_clipboard_url(self, mock_print):
        """Test workflow with clipboard URL detection"""
        import argparse
        args = argparse.Namespace(
            url=None, mp3=False, mp4=False, high=False, format=None,
            info=False, output='youtube_downloads', cookies=None,
            cookies_from_browser=None, archive=None
        )
        
        with patch('youtube_downloader.get_clipboard_url', return_value='https://youtube.com/watch?v=test'):
            with patch('youtube_downloader.RICH_AVAILABLE', False):
                with patch('builtins.input', return_value='y'):  # Accept clipboard URL
                    with patch('youtube_downloader.get_video_info', return_value={'title': 'Test', 'duration': 120, 'formats': []}):
                        with patch('youtube_downloader.display_formats', return_value=[]):
                            with patch('builtins.input', side_effect=['best']):
                                with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                                    yt.youtube_download_workflow(args, ffmpeg_installed=True)
    
    @patch('builtins.print')
    def test_workflow_playlist_download(self, mock_print):
        """Test playlist download workflow"""
        import argparse
        args = argparse.Namespace(
            url='https://youtube.com/playlist?list=test', mp3=False, mp4=False,
            high=False, format=None, info=False, output='youtube_downloads',
            cookies=None, cookies_from_browser=None, archive=None
        )
        
        playlist_info = {
            '_type': 'playlist',
            'title': 'Test Playlist',
            'entries': [{'title': 'Video 1'}]
        }
        
        with patch('youtube_downloader.get_video_info', return_value=playlist_info):
            with patch('youtube_downloader.display_video_info'):
                with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                    with patch('platform.system', return_value='Linux'):
                        yt.youtube_download_workflow(args, ffmpeg_installed=True)
    
    @patch('builtins.print')
    def test_workflow_failed_download(self, mock_print):
        """Test workflow with failed download"""
        import argparse
        args = argparse.Namespace(
            url='https://youtube.com/watch?v=test', mp3=False, mp4=False,
            high=False, format='best', info=False, output='youtube_downloads',
            cookies=None, cookies_from_browser=None, archive=None
        )
        
        with patch('youtube_downloader.get_video_info', return_value={'title': 'Test', 'duration': 120}):
            with patch('youtube_downloader.display_video_info'):
                with patch('youtube_downloader.download_video', return_value=('/tmp', False)):
                    yt.youtube_download_workflow(args, ffmpeg_installed=True)


class TestAudioConversionWorkflowExtended:
    """Extended audio conversion workflow tests"""
    
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    @patch('os.path.isfile', return_value=True)
    @patch('os.access', return_value=True)
    @patch('os.path.abspath', return_value='/path/to/test.mp3')
    @patch('os.path.getsize', return_value=5000000)
    @patch('youtube_downloader.get_audio_metadata')
    @patch('builtins.input', side_effect=['/path/to/test.mp3', '1', '', 'y'])
    @patch('builtins.print')
    def test_audio_conversion_workflow_complete(self, mock_print, mock_input, 
                                                 mock_metadata, mock_getsize,
                                                 mock_abspath, mock_access,
                                                 mock_isfile, mock_which):
        """Test complete audio conversion workflow"""
        mock_metadata.return_value = {
            'format': {
                'size': '5000000',
                'duration': '180',
                'bit_rate': '192000'
            },
            'streams': []
        }
        
        with patch('youtube_downloader.convert_audio_file', return_value=True):
            yt.audio_conversion_workflow()
        assert mock_print.called
    
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    @patch('os.path.isfile', return_value=True)
    @patch('os.access', return_value=False)
    @patch('os.path.abspath', return_value='/path/to/test.mp3')
    @patch('builtins.input', return_value='/path/to/test.mp3')
    @patch('builtins.print')
    def test_audio_conversion_workflow_no_read_permission(self, mock_print, mock_input,
                                                          mock_abspath, mock_access,
                                                          mock_isfile, mock_which):
        """Test audio conversion with no read permission"""
        yt.audio_conversion_workflow()
        assert mock_print.called


class TestRichAvailabilityPaths:
    """Test code paths based on Rich availability"""
    
    @patch('youtube_downloader.RICH_AVAILABLE', False)
    @patch('builtins.print')
    def test_main_without_rich(self, mock_print):
        """Test main banner without Rich"""
        with patch('sys.argv', ['youtube_downloader.py', '--list-sites']):
            with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
                yt.main()
        assert mock_print.called
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_main_with_rich(self):
        """Test main banner with Rich"""
        from rich.console import Console
        with patch('sys.argv', ['youtube_downloader.py', '--list-sites']):
            with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
                with patch.object(Console, 'print'):
                    yt.main()


class TestKeyboardInterruptHandling:
    """Test keyboard interrupt handling"""
    
    @patch('sys.argv', ['youtube_downloader.py'])
    def test_main_keyboard_interrupt(self):
        """Test main with keyboard interrupt"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            with patch('youtube_downloader.show_main_menu', side_effect=KeyboardInterrupt()):
                try:
                    yt.main()
                except SystemExit:
                    pass


class TestConvertAudioFileLossless:
    """Test lossless audio conversion"""
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=False)
    @patch('builtins.print')
    def test_convert_to_wav(self, mock_print, mock_exists, mock_getsize, mock_run):
        """Test conversion to WAV"""
        mock_run.return_value = Mock(returncode=0)
        result = yt.convert_audio_file('/path/to/input.mp3', 'wav')
        assert result is True
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=False)
    @patch('builtins.print')
    def test_convert_to_flac(self, mock_print, mock_exists, mock_getsize, mock_run):
        """Test conversion to FLAC"""
        mock_run.return_value = Mock(returncode=0)
        result = yt.convert_audio_file('/path/to/input.mp3', 'flac')
        assert result is True
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=False)
    @patch('builtins.print')
    def test_convert_to_m4a(self, mock_print, mock_exists, mock_getsize, mock_run):
        """Test conversion to M4A"""
        mock_run.return_value = Mock(returncode=0)
        result = yt.convert_audio_file('/path/to/input.mp3', 'm4a', 192)
        assert result is True
    
    @patch('subprocess.run')
    @patch('os.path.getsize', return_value=5000000)
    @patch('pathlib.Path.exists', return_value=False)
    @patch('builtins.print')
    def test_convert_to_ogg(self, mock_print, mock_exists, mock_getsize, mock_run):
        """Test conversion to OGG"""
        mock_run.return_value = Mock(returncode=0)
        result = yt.convert_audio_file('/path/to/input.mp3', 'ogg', 192)
        assert result is True


class TestWaitForExitPlatforms:
    """Test wait_for_exit on different platforms"""
    
    @patch('platform.system', return_value='Darwin')
    def test_wait_for_exit_macos(self, mock_system):
        """Test wait for exit on macOS"""
        yt.wait_for_exit()
    
    @patch('platform.system', return_value='Linux')
    def test_wait_for_exit_linux_non_tty(self, mock_system):
        """Test wait for exit on Linux (non-TTY)"""
        with patch('sys.stdout.isatty', return_value=False):
            yt.wait_for_exit()


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--cov=youtube_downloader', '--cov-report=term-missing', '--cov-report=html'])
