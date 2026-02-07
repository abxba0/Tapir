import React from "react";
import { Box, Typography, Stack, Avatar } from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import {
  IconDownload,
  IconMicrophone,
  IconFileText,
  IconMusic,
} from "@tabler/icons-react";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";

const capabilities = [
  {
    title: "Download Media",
    description: "YouTube, TikTok, Instagram, SoundCloud & 1800+ sites",
    icon: IconDownload,
    color: "#5D87FF",
    bgColor: "#ECF2FF",
  },
  {
    title: "Convert Audio",
    description: "MP3, AAC, M4A, OGG, WAV, FLAC with quality selection",
    icon: IconMusic,
    color: "#49BEFF",
    bgColor: "#E8F7FF",
  },
  {
    title: "Transcribe",
    description: "Speech-to-text via OpenAI Whisper with subtitle support",
    icon: IconMicrophone,
    color: "#13DEB9",
    bgColor: "#E6FFFA",
  },
  {
    title: "Text to Speech",
    description: "Convert PDF, TXT, MD, HTML to audio via edge-tts",
    icon: IconFileText,
    color: "#FFAE1F",
    bgColor: "#FEF5E5",
  },
];

const CapabilityCards = () => {
  return (
    <Grid2 container spacing={3}>
      {capabilities.map((cap, index) => (
        <Grid2 key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
          <DashboardCard>
            <Stack spacing={2} alignItems="flex-start">
              <Avatar
                sx={{
                  bgcolor: cap.bgColor,
                  width: 52,
                  height: 52,
                  borderRadius: "12px",
                }}
              >
                <cap.icon size={26} color={cap.color} stroke={1.5} />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ mb: 0.5 }}>
                  {cap.title}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.5 }}>
                  {cap.description}
                </Typography>
              </Box>
            </Stack>
          </DashboardCard>
        </Grid2>
      ))}
    </Grid2>
  );
};

export default CapabilityCards;
