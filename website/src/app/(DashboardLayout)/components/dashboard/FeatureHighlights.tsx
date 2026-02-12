import React from "react";
import {
  Typography,
  Stack,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  IconCheck,
} from "@tabler/icons-react";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";

const features = [
  "Multi-site download from 1800+ video platforms",
  "Playlist & channel download with automatic ordering",
  "Parallel downloads with configurable worker pools",
  "Batch download queue with status tracking",
  "YouTube search — find and download directly",
  "Audio conversion between MP3, AAC, M4A, OGG, WAV, FLAC",
  "Media transcription via OpenAI Whisper",
  "Text to Speech with edge-tts, gTTS, or espeak",
  "Subtitle extraction (SRT, VTT, TXT formats)",
  "Metadata embedding (title, artist, thumbnail)",
  "Plugin system for post-processing hooks",
  "Quality selection with size estimation",
  "Cookie support for restricted content",
  "Cross-platform: Linux, macOS, Windows (WSL)",
];

const FeatureHighlights = () => {
  return (
    <DashboardCard title="Feature Highlights" subtitle="Everything Tapir can do">
      <List dense sx={{ py: 0 }}>
        {features.map((feature, index) => (
          <ListItem key={index} sx={{ px: 0, py: 0.3 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: "6px",
                  bgcolor: index % 4 === 0 ? "primary.light" :
                           index % 4 === 1 ? "secondary.light" :
                           index % 4 === 2 ? "success.light" :
                           "warning.light",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconCheck
                  size={13}
                  color={
                    index % 4 === 0 ? "#5D87FF" :
                    index % 4 === 1 ? "#49BEFF" :
                    index % 4 === 2 ? "#13DEB9" :
                    "#FFAE1F"
                  }
                  stroke={2.5}
                />
              </Box>
            </ListItemIcon>
            <ListItemText
              primary={feature}
              primaryTypographyProps={{
                variant: "body1",
                fontSize: "0.85rem",
              }}
            />
          </ListItem>
        ))}
      </List>
    </DashboardCard>
  );
};

export default FeatureHighlights;
