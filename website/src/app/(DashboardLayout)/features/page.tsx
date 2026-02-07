"use client";
import React from "react";
import { Box, Typography, Stack, Avatar, Card, CardContent, Chip, List, ListItem, ListItemIcon, ListItemText,  } from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import PageContainer from "@/app/(DashboardLayout)/components/container/PageContainer";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";
import {
  IconDownload,
  IconMicrophone,
  IconFileText,
  IconMusic,
  IconTerminal2,
  IconPlugConnected,
  IconListSearch,
  IconPlayerPlay,
  IconSubtask,
  IconCookie,
  IconServer,
  IconRobot,
  IconCheck,
} from "@tabler/icons-react";

const featureSections = [
  {
    id: "download",
    title: "Download Media",
    icon: IconDownload,
    color: "#5D87FF",
    bgColor: "#ECF2FF",
    description:
      "Download videos and audio from YouTube, Vimeo, Instagram, TikTok, SoundCloud, Twitch, Bandcamp, Dailymotion, and 1800+ other sites through yt-dlp integration.",
    highlights: [
      "Playlist & channel download with automatic ordering and incremental sync",
      "Parallel downloads with configurable worker pools for maximum speed",
      "Batch download queue for processing multiple URLs with status tracking",
      "YouTube search — find and download content directly from search results",
      "Quality selection with format and resolution options before downloading",
      "Size estimation to preview file sizes before committing to downloads",
      "Cookie support for accessing age-restricted and region-limited content",
      "Metadata embedding with title, artist, and thumbnail into downloaded files",
    ],
  },
  {
    id: "convert",
    title: "Audio Conversion",
    icon: IconMusic,
    color: "#49BEFF",
    bgColor: "#E8F7FF",
    description:
      "Convert audio between all major formats with quality control. Powered by FFmpeg for reliable, high-fidelity conversion.",
    highlights: [
      "Support for MP3, AAC, M4A, OGG, WAV, and FLAC formats",
      "Quality selection for bitrate and encoding parameters",
      "Size estimation before conversion",
      "Batch conversion support",
    ],
  },
  {
    id: "transcribe",
    title: "Media Transcription",
    icon: IconMicrophone,
    color: "#13DEB9",
    bgColor: "#E6FFFA",
    description:
      "Transcribe audio and video content from URLs or local files using OpenAI Whisper. Automatic subtitle extraction when available.",
    highlights: [
      "OpenAI Whisper integration with multiple model sizes (tiny to large)",
      "Fast subtitle extraction from online videos before Whisper fallback",
      "Output as plain text (TXT), SRT subtitles, or VTT with timestamps",
      "Local file and remote URL transcription support",
    ],
  },
  {
    id: "tts",
    title: "Text to Speech",
    icon: IconFileText,
    color: "#FFAE1F",
    bgColor: "#FEF5E5",
    description:
      "Convert documents into spoken audio. Supports PDF, TXT, Markdown, HTML, and other text formats with multiple TTS engine options.",
    highlights: [
      "Multiple engine support: edge-tts (recommended), gTTS, espeak",
      "Document format support: PDF, TXT, MD, HTML, and more",
      "High-quality voice synthesis via Microsoft Edge TTS",
      "Offline fallback with espeak for environments without internet",
    ],
  },
  {
    id: "api",
    title: "REST API & MCP Server",
    icon: IconTerminal2,
    color: "#FA896B",
    bgColor: "#FDEDE8",
    description:
      "Run Tapir as a background service via HTTP REST API or as a Model Context Protocol (MCP) server for AI agent integration.",
    highlights: [
      "REST API server for external tools and web UIs",
      "MCP server for AI agent integration and automation",
      "Plugin system for custom post-processing hooks",
      "Cross-platform compatibility: Linux, macOS, Windows (WSL)",
    ],
  },
];

const FeaturesPage = () => {
  return (
    <PageContainer title="Features — Tapir" description="Explore all Tapir features">
      <Box>
        <Typography variant="h2" sx={{ mb: 1, fontWeight: 700 }}>
          Features
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 4, maxWidth: 600 }}>
          Tapir is a comprehensive terminal toolkit for media processing.
          Explore each capability below.
        </Typography>

        <Stack spacing={3}>
          {featureSections.map((section) => (
            <Card key={section.id} id={section.id} elevation={9} sx={{ borderRadius: "12px" }}>
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
                  <Avatar
                    sx={{
                      bgcolor: section.bgColor,
                      width: 64,
                      height: 64,
                      borderRadius: "16px",
                      flexShrink: 0,
                    }}
                  >
                    <section.icon size={32} color={section.color} stroke={1.5} />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h4" sx={{ mb: 1 }}>
                      {section.title}
                    </Typography>
                    <Typography variant="body1" color="textSecondary" sx={{ mb: 2, lineHeight: 1.7 }}>
                      {section.description}
                    </Typography>
                    <Grid2 container spacing={1}>
                      {section.highlights.map((highlight, idx) => (
                        <Grid2 key={idx} size={{ xs: 12, md: 6 }}>
                          <Stack direction="row" spacing={1} alignItems="flex-start">
                            <Box
                              sx={{
                                mt: 0.3,
                                width: 18,
                                height: 18,
                                borderRadius: "5px",
                                bgcolor: section.bgColor,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <IconCheck size={12} color={section.color} stroke={2.5} />
                            </Box>
                            <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                              {highlight}
                            </Typography>
                          </Stack>
                        </Grid2>
                      ))}
                    </Grid2>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
    </PageContainer>
  );
};

export default FeaturesPage;
