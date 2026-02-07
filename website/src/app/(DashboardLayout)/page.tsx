"use client";
import React from "react";
import { Box, Typography, Stack, Avatar, Chip } from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import PageContainer from "@/app/(DashboardLayout)/components/container/PageContainer";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";
import {
  IconDownload,
  IconMicrophone,
  IconFileText,
  IconBrandYoutube,
  IconMusic,
  IconTerminal2,
  IconWorldWww,
  IconArrowRight,
  IconPlayerPlay,
  IconBrandGithub,
} from "@tabler/icons-react";
import Link from "next/link";
import SitesSupported from "@/app/(DashboardLayout)/components/dashboard/SitesSupported";
import FeatureHighlights from "@/app/(DashboardLayout)/components/dashboard/FeatureHighlights";
import QuickStart from "@/app/(DashboardLayout)/components/dashboard/QuickStart";
import CapabilityCards from "@/app/(DashboardLayout)/components/dashboard/CapabilityCards";

const Dashboard = () => {
  return (
    <PageContainer title="Tapir — Media Toolkit" description="Tapir: Download, convert, transcribe, and speak media from 1800+ sites">
      <Box>
        {/* Hero Section */}
        <Box
          sx={{
            background: "linear-gradient(135deg, #5D87FF 0%, #49BEFF 50%, #13DEB9 100%)",
            borderRadius: "16px",
            p: { xs: 3, md: 5 },
            mb: 3,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: -60,
              left: "30%",
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
            }}
          />
          <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
            <Typography
              variant="h1"
              sx={{
                color: "#fff",
                fontWeight: 700,
                fontSize: { xs: "2rem", md: "3rem" },
                lineHeight: 1.2,
                letterSpacing: "-1px",
              }}
            >
              Tapir
            </Typography>
            <Typography
              variant="h5"
              sx={{
                color: "rgba(255,255,255,0.9)",
                fontWeight: 400,
                maxWidth: 600,
                lineHeight: 1.6,
              }}
            >
              A powerful terminal toolkit for downloading, converting, transcribing,
              and converting text to speech — supporting{" "}
              <Box component="span" sx={{ fontWeight: 700 }}>1800+ sites</Box>.
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Chip
                icon={<IconPlayerPlay size={16} />}
                label="Get Started"
                component={Link}
                href="/getting-started"
                clickable
                sx={{
                  bgcolor: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                  backdropFilter: "blur(10px)",
                  height: 36,
                  px: 1,
                }}
              />
              <Chip
                icon={<IconBrandGithub size={16} />}
                label="View on GitHub"
                component="a"
                href="https://github.com/abxba0/Tapir"
                target="_blank"
                rel="noopener noreferrer"
                clickable
                sx={{
                  bgcolor: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
                  backdropFilter: "blur(10px)",
                  height: 36,
                  px: 1,
                }}
              />
            </Stack>
          </Stack>
        </Box>

        <Grid2 container spacing={3}>
          {/* Capability Cards */}
          <Grid2 size={12}>
            <CapabilityCards />
          </Grid2>

          {/* Feature Highlights */}
          <Grid2 size={{ xs: 12, lg: 8 }}>
            <FeatureHighlights />
          </Grid2>

          {/* Quick Start */}
          <Grid2 size={{ xs: 12, lg: 4 }}>
            <QuickStart />
          </Grid2>

          {/* Sites Supported */}
          <Grid2 size={12}>
            <SitesSupported />
          </Grid2>
        </Grid2>
      </Box>
    </PageContainer>
  );
};

export default Dashboard;
