# Docker Quick Reference

## Common Commands

### Build
```bash
docker build -t yt-video-downloader:latest .
```

### Basic Download
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "VIDEO_URL"
```

### Download as MP3
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "VIDEO_URL" --mp3
```

### Download High Quality
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "VIDEO_URL" --high
```

### Download Playlist
```bash
docker run --rm -v $(pwd)/downloads:/downloads yt-video-downloader:latest \
  "PLAYLIST_URL"
```

### Using Docker Compose
```bash
docker-compose run --rm yt-downloader "VIDEO_URL" --mp3
```

### Get Video Info
```bash
docker run --rm yt-video-downloader:latest "VIDEO_URL" --info
```

### List Supported Sites
```bash
docker run --rm yt-video-downloader:latest --list-sites
```

## Windows Commands

### PowerShell
```powershell
docker run --rm -v ${PWD}/downloads:/downloads yt-video-downloader:latest "VIDEO_URL"
```

### CMD
```cmd
docker run --rm -v %cd%\downloads:/downloads yt-video-downloader:latest "VIDEO_URL"
```

## Advanced Usage

### With Cookies
```bash
docker run --rm \
  -v $(pwd)/downloads:/downloads \
  -v $(pwd)/cookies.txt:/app/cookies.txt:ro \
  yt-video-downloader:latest \
  "VIDEO_URL" --cookies /app/cookies.txt
```

### Parallel Downloads
```bash
docker run --rm \
  -v $(pwd)/downloads:/downloads \
  -v $(pwd)/urls.txt:/app/urls.txt:ro \
  yt-video-downloader:latest \
  --batch-file /app/urls.txt --parallel --max-workers 5
```

### Custom User
```bash
docker run --rm --user $(id -u):$(id -g) \
  -v $(pwd)/downloads:/downloads \
  yt-video-downloader:latest "VIDEO_URL"
```

## Maintenance

### View Logs
```bash
docker logs <container-id>
```

### Clean Up
```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove everything
docker system prune -a
```

### Update Image
```bash
docker pull yt-video-downloader:latest
# or rebuild
docker build --no-cache -t yt-video-downloader:latest .
```

## Troubleshooting

### Permission Issues
```bash
# Run with your user ID
docker run --rm --user $(id -u):$(id -g) -v $(pwd)/downloads:/downloads ...
```

### Debug Mode
```bash
# Get shell access
docker run --rm -it --entrypoint sh yt-video-downloader:latest
```

### Check FFmpeg
```bash
docker run --rm yt-video-downloader:latest sh -c "ffmpeg -version"
```

### Check Python Packages
```bash
docker run --rm yt-video-downloader:latest sh -c "pip list"
```
