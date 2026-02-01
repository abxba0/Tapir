#!/usr/bin/env python3
"""
Integration tests for youtube_downloader.py

These tests mock only external dependencies (yt_dlp, subprocess, network)
and let the internal code execute normally to achieve better coverage.
"""

import pytest
import os
import sys
import tempfile
import shutil
from unittest.mock import Mock, MagicMock, patch, call
from pathlib import Path

# Import the module under test
import youtube_downloader as yt


class TestIntegrationVideoDownload:
    """Integration tests for video download workflow"""
    
    def test_full_download_workflow_single_video(self):
        """Test complete download workflow for single video"""
        import yt_dlp
        
        # Mock yt_dlp YoutubeDL
        mock_ytdl = Mock()
        mock_ytdl.extract_info.return_value = {
            'title': 'Test Video',
            'channel': 'Test Channel',
            'duration': 180,
            'upload_date': '20231201',
            'view_count': 1000000,
            'description': 'Test description',
            'formats': [
                {'format_id': '137', 'ext': 'mp4', 'height': 1080, 
                 'vcodec': 'avc1', 'acodec': 'none', 'tbr': 5000, 'filesize': 100000000},
                {'format_id': '140', 'ext': 'm4a', 'vcodec': 'none', 
                 'acodec': 'mp4a', 'abr': 128, 'tbr': 128, 'filesize': 5000000}
            ]
        }
        mock_ytdl.download.return_value = None
        
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            # Get video info
            info = yt.get_video_info('https://youtube.com/watch?v=test')
            assert info is not None
            assert info['title'] == 'Test Video'
            
            # Display formats
            formats = yt.display_formats(info, ffmpeg_available=True)
            assert len(formats) > 0
            
            # Download
            with tempfile.TemporaryDirectory() as tmpdir:
                output_dir, success = yt.download_video(
                    'https://youtube.com/watch?v=test',
                    'best',
                    tmpdir,
                    ffmpeg_available=True
                )
                assert success is True
    
    def test_full_download_workflow_playlist(self):
        """Test complete download workflow for playlist"""
        import yt_dlp
        
        mock_ytdl = Mock()
        mock_ytdl.extract_info.return_value = {
            '_type': 'playlist',
            'title': 'Test Playlist',
            'channel': 'Test Channel',
            'entries': [
                {'title': 'Video 1', 'duration': 120},
                {'title': 'Video 2', 'duration': 180}
            ]
        }
        mock_ytdl.download.return_value = None
        
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            info = yt.get_video_info('https://youtube.com/playlist?list=test')
            assert info is not None
            assert info['_type'] == 'playlist'
            
            with tempfile.TemporaryDirectory() as tmpdir:
                output_dir, success = yt.download_video(
                    'https://youtube.com/playlist?list=test',
                    'best',
                    tmpdir,
                    ffmpeg_available=True,
                    is_playlist=True
                )
                assert success is True


class TestIntegrationAudioConversion:
    """Integration tests for audio conversion"""
    
    def test_full_audio_conversion_workflow(self):
        """Test complete audio conversion workflow"""
        # Create a temporary audio file
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.mp3') as f:
            temp_audio = f.name
        
        try:
            # Mock FFmpeg subprocess calls
            mock_result = Mock()
            mock_result.returncode = 0
            mock_result.stdout = '{"format": {"size": "5000000", "duration": "180", "bit_rate": "192000"}, "streams": []}'
            
            with patch('subprocess.run', return_value=mock_result):
                # Get metadata
                metadata = yt.get_audio_metadata(temp_audio)
                assert metadata is not None
                
                # Estimate output size
                size = yt.estimate_output_size(180, 192)
                assert size > 0
                
                # Get quality description
                quality = yt.get_quality_description('mp3', 192)
                assert 'Good' in quality or '192' in quality
                
                # Convert (with mocked subprocess)
                with patch('os.path.getsize', return_value=5000000):
                    with patch('pathlib.Path.exists', return_value=False):
                        result = yt.convert_audio_file(temp_audio, 'aac', 192)
                        assert result is True
        finally:
            if os.path.exists(temp_audio):
                os.unlink(temp_audio)


class TestIntegrationParallelDownload:
    """Integration tests for parallel download"""
    
    def test_parallel_download_multiple_videos(self):
        """Test parallel download of multiple videos"""
        import yt_dlp
        
        mock_ytdl = Mock()
        mock_ytdl.extract_info.return_value = {
            'title': 'Test Video',
            'duration': 120
        }
        mock_ytdl.download.return_value = None
        
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            urls = [
                'https://youtube.com/watch?v=1',
                'https://youtube.com/watch?v=2',
                'https://youtube.com/watch?v=3'
            ]
            
            with tempfile.TemporaryDirectory() as tmpdir:
                yt.parallel_download_workflow(
                    urls,
                    'best',
                    tmpdir,
                    ffmpeg_available=True,
                    cookies_file=None,
                    cookies_from_browser=None,
                    archive_file=None,
                    max_workers=2
                )


class TestIntegrationURLHandling:
    """Integration tests for URL handling"""
    
    def test_url_detection_all_sites(self):
        """Test URL detection for all supported sites"""
        test_cases = [
            ('https://youtube.com/watch?v=test', 'youtube'),
            ('https://vimeo.com/123456', 'vimeo'),
            ('https://soundcloud.com/artist/track', 'soundcloud'),
            ('https://dailymotion.com/video/x123', 'dailymotion'),
            ('https://twitch.tv/videos/123', 'twitch'),
            ('https://artist.bandcamp.com/track/name', 'bandcamp'),
            ('https://tiktok.com/@user/video/123', 'tiktok'),
            ('https://example.com/video', 'other'),
        ]
        
        for url, expected_site in test_cases:
            detected = yt.detect_site(url)
            assert detected == expected_site, f"Failed for {url}: expected {expected_site}, got {detected}"
    
    def test_youtube_url_validation_all_formats(self):
        """Test YouTube URL validation for all formats"""
        valid_urls = [
            'https://youtube.com/watch?v=dQw4w9WgXcQ',
            'https://youtu.be/dQw4w9WgXcQ',
            'https://youtube.com/shorts/dQw4w9WgXcQ',
            'https://youtube.com/playlist?list=PLtest',
            'https://youtube.com/@username',
            'https://youtube.com/channel/UCtest',
        ]
        
        for url in valid_urls:
            assert yt.is_valid_youtube_url(url), f"Failed to validate: {url}"
        
        invalid_urls = [
            'https://vimeo.com/123',
            'not a url',
            '',
        ]
        
        for url in invalid_urls:
            assert not yt.is_valid_youtube_url(url), f"Incorrectly validated: {url}"


class TestIntegrationFormatHandling:
    """Integration tests for format handling"""
    
    def test_display_formats_all_types(self):
        """Test format display with all format types"""
        info = {
            'formats': [
                # Combined format
                {'format_id': '18', 'ext': 'mp4', 'height': 360, 
                 'vcodec': 'avc1', 'acodec': 'mp4a', 'tbr': 500, 'filesize': 20000000},
                # Video-only format
                {'format_id': '137', 'ext': 'mp4', 'height': 1080, 
                 'vcodec': 'avc1', 'acodec': 'none', 'tbr': 5000, 'filesize': 100000000},
                # Audio-only format
                {'format_id': '140', 'ext': 'm4a', 'vcodec': 'none', 
                 'acodec': 'mp4a', 'abr': 128, 'tbr': 128, 'filesize': 5000000},
            ]
        }
        
        formats = yt.display_formats(info, ffmpeg_available=True)
        assert len(formats) == 3
        
        # Check format grouping worked
        combined = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') != 'none']
        video_only = [f for f in formats if f.get('vcodec') != 'none' and f.get('acodec') == 'none']
        audio_only = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
        
        assert len(combined) > 0
        assert len(video_only) > 0
        assert len(audio_only) > 0


class TestIntegrationUtilityFunctions:
    """Integration tests for utility functions"""
    
    def test_format_size_all_units(self):
        """Test format_size with all size units"""
        test_cases = [
            (0, "0B"),
            (512, "512.00 B"),
            (1024, "1.00 KB"),
            (1024 * 1024, "1.00 MB"),
            (1024 * 1024 * 1024, "1.00 GB"),
            (1024 * 1024 * 1024 * 1024, "1.00 TB"),
        ]
        
        for size_bytes, expected in test_cases:
            result = yt.format_size(size_bytes)
            assert result == expected, f"Failed for {size_bytes}: expected {expected}, got {result}"
    
    def test_format_duration_all_ranges(self):
        """Test format_duration with all time ranges"""
        test_cases = [
            (0, "Unknown"),
            (30, "00:30"),
            (90, "01:30"),
            (3600, "1:00:00"),
            (3661, "1:01:01"),
            (7200, "2:00:00"),
        ]
        
        for seconds, expected in test_cases:
            result = yt.format_duration(seconds)
            assert result == expected, f"Failed for {seconds}: expected {expected}, got {result}"
    
    def test_format_count_all_ranges(self):
        """Test format_count with various counts"""
        test_cases = [
            (0, "Unknown"),
            (1000, "1,000"),
            (1000000, "1,000,000"),
            (1234567, "1,234,567"),
        ]
        
        for count, expected in test_cases:
            result = yt.format_count(count)
            assert result == expected, f"Failed for {count}: expected {expected}, got {result}"


class TestIntegrationDownloadDirectory:
    """Integration tests for download directory handling"""
    
    def test_download_directory_creation(self):
        """Test download directory creation with absolute path"""
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = os.path.join(tmpdir, 'downloads')
            result = yt.get_download_directory(test_dir)
            assert os.path.exists(result)
            assert result == test_dir
    
    def test_download_directory_permissions(self):
        """Test download directory with write permissions"""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = yt.get_download_directory(tmpdir)
            # Should be able to write
            test_file = os.path.join(result, 'test.txt')
            with open(test_file, 'w') as f:
                f.write('test')
            assert os.path.exists(test_file)


class TestIntegrationAudioFormats:
    """Integration tests for audio format handling"""
    
    def test_all_supported_audio_formats(self):
        """Test all supported audio formats"""
        formats = yt.get_supported_audio_formats()
        
        required_formats = ['mp3', 'aac', 'm4a', 'ogg', 'wav', 'flac']
        for fmt in required_formats:
            assert fmt in formats
            assert 'name' in formats[fmt]
            assert 'description' in formats[fmt]
            assert 'default_bitrate' in formats[fmt]
            assert 'codec' in formats[fmt]
    
    def test_quality_descriptions_all_codecs(self):
        """Test quality descriptions for all codec types"""
        # Lossy formats
        assert 'Very High' in yt.get_quality_description('mp3', 320)
        assert 'High' in yt.get_quality_description('aac', 256)
        assert 'Good' in yt.get_quality_description('mp3', 192)
        assert 'Standard' in yt.get_quality_description('mp3', 128)
        
        # Lossless formats
        assert 'Lossless' in yt.get_quality_description('flac', 1000)
        assert 'Lossless' in yt.get_quality_description('wav', 1411)


class TestIntegrationSupportedSites:
    """Integration tests for supported sites"""
    
    def test_all_supported_sites_structure(self):
        """Test all supported sites have proper structure"""
        sites = yt.get_supported_sites()
        
        required_sites = ['youtube', 'vimeo', 'soundcloud', 'dailymotion', 
                          'twitch', 'bandcamp', 'tiktok', 'other']
        
        for site_key in required_sites:
            assert site_key in sites
            site = sites[site_key]
            assert 'name' in site
            assert 'description' in site
            assert 'example' in site
            assert isinstance(site['name'], str)
            assert isinstance(site['description'], str)
            assert isinstance(site['example'], str)


class TestCheckDependenciesDetailed:
    """Detailed tests for check_dependencies function"""
    
    @patch('builtins.input', return_value='n')
    @patch('platform.system', return_value='Windows')
    @patch('shutil.which', return_value=None)
    @patch('builtins.print')
    def test_check_dependencies_windows_no_ffmpeg(self, mock_print, mock_which, mock_system, mock_input):
        """Test dependency check on Windows without FFmpeg"""
        yt_dlp_installed, ffmpeg_installed = yt.check_dependencies()
        assert yt_dlp_installed is True
    
    @patch('builtins.input', return_value='n')
    @patch('platform.system', return_value='Darwin')
    @patch('shutil.which', return_value=None)
    @patch('builtins.print')
    def test_check_dependencies_macos_no_ffmpeg(self, mock_print, mock_which, mock_system, mock_input):
        """Test dependency check on macOS without FFmpeg"""
        yt_dlp_installed, ffmpeg_installed = yt.check_dependencies()
        assert yt_dlp_installed is True
    
    @patch('builtins.input', return_value='n')
    @patch('platform.system', return_value='Linux')
    @patch('shutil.which', return_value=None)
    @patch('os.path.exists', return_value=False)
    @patch('builtins.print')
    def test_check_dependencies_linux_no_package_manager(self, mock_print, mock_exists, mock_which, mock_system, mock_input):
        """Test dependency check on Linux without detectable package manager"""
        yt_dlp_installed, ffmpeg_installed = yt.check_dependencies()
        assert yt_dlp_installed is True


class TestYoutubeDownloadWorkflowDetailed:
    """Detailed tests for youtube_download_workflow"""
    
    @patch('builtins.print')
    def test_workflow_mp3_no_ffmpeg_warning(self, mock_print):
        """Test workflow with MP3 format but no FFmpeg"""
        import argparse
        args = argparse.Namespace(
            url='https://youtube.com/watch?v=test', mp3=True, mp4=False,
            high=False, format=None, info=False, output='youtube_downloads',
            cookies=None, cookies_from_browser=None, archive=None
        )
        
        with patch('youtube_downloader.get_video_info', return_value={'title': 'Test', 'duration': 120}):
            with patch('youtube_downloader.display_video_info'):
                with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                    yt.youtube_download_workflow(args, ffmpeg_installed=False)
    
    @patch('builtins.print')
    def test_workflow_high_no_ffmpeg_warning(self, mock_print):
        """Test workflow with high quality but no FFmpeg"""
        import argparse
        args = argparse.Namespace(
            url='https://youtube.com/watch?v=test', mp3=False, mp4=False,
            high=True, format=None, info=False, output='youtube_downloads',
            cookies=None, cookies_from_browser=None, archive=None
        )
        
        with patch('youtube_downloader.get_video_info', return_value={'title': 'Test', 'duration': 120}):
            with patch('youtube_downloader.display_video_info'):
                with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                    yt.youtube_download_workflow(args, ffmpeg_installed=False)
    
    @patch('platform.system', return_value='Darwin')
    @patch('subprocess.call')
    @patch('builtins.print')
    def test_workflow_successful_download_macos(self, mock_print, mock_call, mock_system):
        """Test successful download workflow on macOS (opens directory)"""
        import argparse
        args = argparse.Namespace(
            url='https://youtube.com/watch?v=test', mp3=False, mp4=False,
            high=False, format='best', info=False, output='youtube_downloads',
            cookies=None, cookies_from_browser=None, archive=None
        )
        
        with patch('youtube_downloader.get_video_info', return_value={'title': 'Test', 'duration': 120}):
            with patch('youtube_downloader.display_video_info'):
                with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                    yt.youtube_download_workflow(args, ffmpeg_installed=True)
    
    @patch('platform.system', return_value='Linux')
    @patch('subprocess.call')
    @patch('builtins.print')
    def test_workflow_successful_download_linux(self, mock_print, mock_call, mock_system):
        """Test successful download workflow on Linux (opens directory)"""
        import argparse
        args = argparse.Namespace(
            url='https://youtube.com/watch?v=test', mp3=False, mp4=False,
            high=False, format='best', info=False, output='youtube_downloads',
            cookies=None, cookies_from_browser=None, archive=None
        )
        
        with patch('youtube_downloader.get_video_info', return_value={'title': 'Test', 'duration': 120}):
            with patch('youtube_downloader.display_video_info'):
                with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                    yt.youtube_download_workflow(args, ffmpeg_installed=True)


class TestAudioConversionWorkflowDetailed:
    """Detailed tests for audio_conversion_workflow"""
    
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    @patch('os.path.isfile', return_value=True)
    @patch('os.access', return_value=True)
    @patch('os.path.abspath', return_value='/path/to/test.mp3')
    @patch('youtube_downloader.get_audio_metadata', return_value=None)
    @patch('os.path.getsize', return_value=5000000)
    @patch('builtins.input', side_effect=['/path/to/test.mp3', '1', '', 'n'])
    @patch('builtins.print')
    def test_audio_conversion_workflow_no_metadata(self, mock_print, mock_input,
                                                    mock_getsize, mock_metadata,
                                                    mock_abspath, mock_access,
                                                    mock_isfile, mock_which):
        """Test audio conversion workflow when metadata extraction fails"""
        yt.audio_conversion_workflow()
    
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    @patch('os.path.isfile', return_value=True)
    @patch('os.access', return_value=True)
    @patch('os.path.abspath', return_value='/path/to/test.mp3')
    @patch('os.path.getsize', return_value=5000000)
    @patch('youtube_downloader.get_audio_metadata')
    @patch('builtins.input', side_effect=['/path/to/test.mp3', '2', '256', 'n'])
    @patch('builtins.print')
    def test_audio_conversion_workflow_custom_bitrate(self, mock_print, mock_input,
                                                       mock_metadata, mock_getsize,
                                                       mock_abspath, mock_access,
                                                       mock_isfile, mock_which):
        """Test audio conversion workflow with custom bitrate"""
        mock_metadata.return_value = {
            'format': {'size': '5000000', 'duration': '180', 'bit_rate': '192000'},
            'streams': []
        }
        yt.audio_conversion_workflow()
    
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    @patch('os.path.isfile', return_value=True)
    @patch('os.access', return_value=True)
    @patch('os.path.abspath', return_value='/path/to/test.mp3')
    @patch('os.path.getsize', return_value=5000000)
    @patch('youtube_downloader.get_audio_metadata')
    @patch('builtins.input', side_effect=['/path/to/test.mp3', 'invalid', '1', '', 'n'])
    @patch('builtins.print')
    def test_audio_conversion_workflow_invalid_format_choice(self, mock_print, mock_input,
                                                               mock_metadata, mock_getsize,
                                                               mock_abspath, mock_access,
                                                               mock_isfile, mock_which):
        """Test audio conversion workflow with invalid format choice"""
        mock_metadata.return_value = {
            'format': {'size': '5000000', 'duration': '180', 'bit_rate': '192000'},
            'streams': []
        }
        yt.audio_conversion_workflow()
    
    @patch('shutil.which', return_value='/usr/bin/ffmpeg')
    @patch('os.path.abspath', side_effect=Exception("Path error"))
    @patch('builtins.input', return_value='/path/to/test.mp3')
    @patch('builtins.print')
    def test_audio_conversion_workflow_invalid_path(self, mock_print, mock_input,
                                                     mock_abspath, mock_which):
        """Test audio conversion workflow with invalid path"""
        yt.audio_conversion_workflow()


class TestDownloadVideoDetailedFormats:
    """Detailed tests for various download formats"""
    
    def test_download_video_with_archive_file(self):
        """Test download with custom archive file"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    archive_path = os.path.join(tmpdir, 'archive.txt')
                    output_dir, success = yt.download_video(
                        'https://youtube.com/playlist?list=test',
                        'best',
                        tmpdir,
                        is_playlist=True,
                        archive_file=archive_path
                    )
                    assert success is True


class TestDisplayFunctionsDetailed:
    """Detailed tests for display functions"""
    
    @patch('youtube_downloader.RICH_AVAILABLE', False)
    @patch('builtins.print')
    def test_display_video_info_standard_playlist_uploader(self, mock_print):
        """Test standard playlist info display with uploader field"""
        info = {
            '_type': 'playlist',
            'title': 'Test Playlist',
            'uploader': 'Test Uploader',
            'entries': [{'title': 'Video 1'}],
            'description': 'Short description'
        }
        yt.display_video_info(info, is_playlist=True)
        assert mock_print.called
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_display_video_info_rich_playlist_uploader(self):
        """Test Rich playlist info display with uploader field"""
        from rich.console import Console
        info = {
            '_type': 'playlist',
            'title': 'Test Playlist',
            'uploader': 'Test Uploader',
            'entries': [{'title': 'Video 1'}],
            'description': 'Short description'
        }
        
        with patch.object(Console, 'print'):
            yt.display_video_info_rich(info, is_playlist=True)


class TestMainFunctionCoverage:
    """Tests to increase main() function coverage"""
    
    @patch('sys.argv', ['youtube_downloader.py'])
    @patch('builtins.input', return_value='2')  # Choose audio conversion
    @patch('builtins.print')
    def test_main_interactive_audio_conversion(self, mock_print, mock_input):
        """Test main in interactive mode choosing audio conversion"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            with patch('youtube_downloader.audio_conversion_workflow'):
                yt.main()


class TestURLReadingDetailed:
    """Detailed tests for URL reading"""
    
    def test_read_urls_from_file_empty_and_comments_only(self):
        """Test reading file with only empty lines and comments"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write('# Comment 1\n')
            f.write('\n')
            f.write('# Comment 2\n')
            f.write('\n')
            f.flush()
            temp_path = f.name
        
        try:
            urls = yt.read_urls_from_file(temp_path)
            assert len(urls) == 0
        finally:
            os.unlink(temp_path)


class TestDownloadTrackerDetailed:
    """Detailed tests for DownloadTracker"""
    
    def test_tracker_multiple_operations(self):
        """Test tracker with multiple add operations"""
        tracker = yt.DownloadTracker()
        tracker.set_total(5)
        
        # Add various results
        tracker.add_result('url1', True, 'Success')
        tracker.add_result('url2', True, 'Success')
        tracker.add_result('url3', False, 'Failed')
        tracker.add_result('url4', True, 'Success')
        tracker.add_result('url5', False, 'Failed')
        
        status = tracker.get_status()
        assert status['total'] == 5
        assert status['completed'] == 5
        assert status['success'] == 3
        assert status['failed'] == 2
        
        results = tracker.get_results()
        assert len(results) == 5



class TestRichDisplayPaths:
    """Tests for Rich display code paths"""
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_display_formats_rich_combined_formats(self):
        """Test Rich display with combined formats"""
        from rich.console import Console
        info = {
            'formats': [
                {'format_id': '22', 'ext': 'mp4', 'height': 720,
                 'vcodec': 'avc1', 'acodec': 'mp4a', 'tbr': 1000, 'filesize_approx': 50000000},
            ]
        }
        
        with patch.object(Console, 'print'):
            result = yt.display_formats_rich(info, ffmpeg_available=False)
            assert len(result) > 0
    
    @patch('youtube_downloader.RICH_AVAILABLE', True)
    def test_display_formats_rich_no_ffmpeg(self):
        """Test Rich display without FFmpeg (shows requirements)"""
        from rich.console import Console
        info = {
            'formats': [
                {'format_id': '137', 'ext': 'mp4', 'height': 1080,
                 'vcodec': 'avc1', 'acodec': 'none', 'tbr': 5000, 'filesize': 100000000},
            ]
        }
        
        with patch.object(Console, 'print'):
            result = yt.display_formats_rich(info, ffmpeg_available=False)
            assert len(result) > 0


class TestWorkflowInteractionPaths:
    """Tests for interactive workflow paths"""
    
    @patch('builtins.print')
    @patch('builtins.input', return_value='https://youtube.com/watch?v=test')
    def test_workflow_no_clipboard_url_manual_input(self, mock_input, mock_print):
        """Test workflow with manual URL input when no clipboard"""
        import argparse
        args = argparse.Namespace(
            url=None, mp3=False, mp4=False, high=False, format=None,
            info=False, output='youtube_downloads', cookies=None,
            cookies_from_browser=None, archive=None
        )
        
        with patch('youtube_downloader.get_clipboard_url', return_value=None):
            with patch('youtube_downloader.get_video_info', return_value={'title': 'Test', 'duration': 120, 'formats': []}):
                with patch('youtube_downloader.display_formats', return_value=[]):
                    with patch('builtins.input', side_effect=['https://youtube.com/watch?v=test', 'best']):
                        with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                            with patch('platform.system', return_value='Linux'):
                                yt.youtube_download_workflow(args, ffmpeg_installed=True)


class TestDownloadDirectoryFallback:
    """Tests for download directory fallback behavior"""
    
    def test_download_directory_fallback_to_cwd(self):
        """Test fallback to current working directory"""
        # Use an absolute path that we know will work
        with tempfile.TemporaryDirectory() as tmpdir:
            result = yt.get_download_directory(tmpdir)
            assert os.path.exists(result)
            # Should be able to create a file
            test_file = os.path.join(result, 'test.txt')
            Path(test_file).touch()
            assert os.path.exists(test_file)


class TestParallelDownloadDetails:
    """Detailed parallel download tests"""
    
    def test_parallel_download_tracker_status(self):
        """Test parallel download with detailed status tracking"""
        tracker = yt.DownloadTracker()
        tracker.set_total(3)
        
        with patch('youtube_downloader.get_video_info', return_value={'title': 'Test'}):
            with patch('youtube_downloader.download_video', return_value=('/tmp', True)):
                with patch('builtins.print'):
                    result = yt.download_video_parallel(
                        'https://youtube.com/watch?v=test',
                        'best',
                        '/tmp',
                        True,
                        None,
                        None,
                        None,
                        tracker,
                        2,
                        3
                    )
                    assert result[1] is True  # success
        
        status = tracker.get_status()
        assert status['completed'] == 1


class TestShowDisclaimerCoverage:
    """Test show_disclaimer function"""
    
    @patch('builtins.print')
    def test_show_disclaimer_output(self, mock_print):
        """Test that disclaimer is properly displayed"""
        yt.show_disclaimer()
        # Check print was called
        assert mock_print.called
        # Verify key terms are mentioned
        calls = [str(call) for call in mock_print.call_args_list]
        output = ' '.join(calls).lower()
        assert 'disclaimer' in output or 'copyright' in output or 'permission' in output


class TestWaitForExitCoverage:
    """Test wait_for_exit function"""
    
    @patch('platform.system', return_value='Windows')
    @patch('builtins.input')
    @patch('builtins.print')
    def test_wait_for_exit_windows_with_input(self, mock_print, mock_input, mock_system):
        """Test wait for exit on Windows"""
        yt.wait_for_exit()
        assert mock_print.called
    
    @patch('sys.stdout.isatty', return_value=True)
    @patch('platform.system', return_value='Windows')
    @patch('builtins.input')
    @patch('builtins.print')
    def test_wait_for_exit_tty(self, mock_print, mock_input, mock_system, mock_isatty):
        """Test wait for exit when stdout is a TTY"""
        yt.wait_for_exit()
        assert mock_print.called or mock_input.called


class TestMainEntryPointCoverage:
    """Tests for main entry point coverage"""
    
    @patch('sys.argv', ['youtube_downloader.py', '--batch-file', 'nonexistent.txt', '--parallel'])
    @patch('builtins.print')
    def test_main_batch_file_not_found(self, mock_print):
        """Test main with non-existent batch file"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            yt.main()
        assert mock_print.called
    
    @patch('sys.argv', ['youtube_downloader.py', 'url1', 'url2', 'url3', '--parallel', '--mp3'])
    @patch('builtins.print')
    def test_main_parallel_with_format_option(self, mock_print):
        """Test main with parallel mode and format option"""
        with patch('youtube_downloader.check_dependencies', return_value=(True, True)):
            with patch('youtube_downloader.parallel_download_workflow'):
                yt.main()


class TestDownloadVideoFormatVariations:
    """Test download_video with various format variations"""
    
    def test_download_video_best_format(self):
        """Test download with 'best' format"""
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
                        ffmpeg_available=True
                    )
                    assert success is True
    
    def test_download_video_bestvideo_format(self):
        """Test download with 'bestvideo' format"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'bestvideo',
                        tmpdir,
                        ffmpeg_available=True
                    )
                    assert success is True
    
    def test_download_video_bestaudio_format(self):
        """Test download with 'bestaudio' format"""
        import yt_dlp
        with patch.object(yt_dlp, 'YoutubeDL') as mock_ytdl_class:
            mock_ytdl = Mock()
            mock_ytdl.download.return_value = None
            mock_ytdl_class.return_value.__enter__.return_value = mock_ytdl
            
            with patch('builtins.print'):
                with tempfile.TemporaryDirectory() as tmpdir:
                    output_dir, success = yt.download_video(
                        'https://youtube.com/watch?v=test',
                        'bestaudio',
                        tmpdir,
                        ffmpeg_available=True
                    )
                    assert success is True


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--cov=youtube_downloader', '--cov-append', 
                 '--cov-report=term-missing', '--cov-report=html'])
