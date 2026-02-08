import React from "react";
import { Typography, Stack, Avatar, Box, Chip } from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";
import {
  IconBrandYoutube,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandSoundcloud,
  IconBrandVimeo,
  IconBrandTwitch,
  IconBrandFacebook,
  IconBrandReddit,
  IconWorldWww,
} from "@tabler/icons-react";

const sites = [
  { name: "YouTube", icon: IconBrandYoutube, color: "#FF0000" },
  { name: "Instagram", icon: IconBrandInstagram, color: "#E1306C" },
  { name: "TikTok", icon: IconBrandTiktok, color: "#000000" },
  { name: "SoundCloud", icon: IconBrandSoundcloud, color: "#FF5500" },
  { name: "Vimeo", icon: IconBrandVimeo, color: "#1AB7EA" },
  { name: "Twitch", icon: IconBrandTwitch, color: "#9146FF" },
  { name: "Facebook", icon: IconBrandFacebook, color: "#1877F2" },
  { name: "Reddit", icon: IconBrandReddit, color: "#FF4500" },
];

const SitesSupported = () => {
  return (
    <DashboardCard
      title="Supported Platforms"
      subtitle="Download from 1800+ sites via yt-dlp"
    >
      <Grid2 container spacing={2}>
        {sites.map((site, index) => (
          <Grid2 key={index} size={{ xs: 6, sm: 4, md: 3 }}>
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{
                p: 1.5,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: "divider",
                transition: "all 0.2s ease",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: "primary.light",
                  transform: "translateY(-1px)",
                },
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: `${site.color}15`,
                  borderRadius: "8px",
                }}
              >
                <site.icon size={20} color={site.color} stroke={1.5} />
              </Avatar>
              <Typography variant="body1" fontWeight={500}>
                {site.name}
              </Typography>
            </Stack>
          </Grid2>
        ))}
        <Grid2 size={{ xs: 6, sm: 4, md: 3 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{
              p: 1.5,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #ECF2FF 0%, #E8F7FF 100%)",
              border: "1px solid",
              borderColor: "primary.light",
            }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: "#5D87FF",
                borderRadius: "8px",
              }}
            >
              <IconWorldWww size={20} color="#fff" stroke={1.5} />
            </Avatar>
            <Box>
              <Typography variant="body1" fontWeight={600} color="primary.main">
                1800+
              </Typography>
              <Typography variant="caption" color="textSecondary">
                more sites
              </Typography>
            </Box>
          </Stack>
        </Grid2>
      </Grid2>
    </DashboardCard>
  );
};

export default SitesSupported;
