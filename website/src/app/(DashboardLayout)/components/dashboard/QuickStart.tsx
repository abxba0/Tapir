import React from "react";
import { Typography, Box, Stack, Chip } from "@mui/material";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";
import { IconTerminal2 } from "@tabler/icons-react";

const steps = [
  { label: "Clone the repository", command: "git clone https://github.com/abxba0/Tapir.git" },
  { label: "Navigate to TUI directory", command: "cd Tapir/tui" },
  { label: "Install dependencies", command: "bun install" },
  { label: "Launch Tapir", command: "bun start" },
];

const QuickStart = () => {
  return (
    <DashboardCard title="Quick Start" subtitle="Up and running in 4 steps">
      <Stack spacing={2.5}>
        {steps.map((step, index) => (
          <Box key={index}>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
              <Chip
                label={index + 1}
                size="small"
                sx={{
                  height: 22,
                  minWidth: 22,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  bgcolor: "primary.main",
                  color: "#fff",
                }}
              />
              <Typography variant="body2" fontWeight={500}>
                {step.label}
              </Typography>
            </Stack>
            <Box
              sx={{
                bgcolor: "#2A3547",
                borderRadius: "8px",
                p: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <IconTerminal2 size={14} color="#5D87FF" stroke={2} />
              <Typography
                variant="body2"
                sx={{
                  color: "#13DEB9",
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: "0.78rem",
                  letterSpacing: "0.02em",
                }}
              >
                {step.command}
              </Typography>
            </Box>
          </Box>
        ))}

        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="textSecondary">
            Requires{" "}
            <Box component="span" fontWeight={600}>Bun</Box>,{" "}
            <Box component="span" fontWeight={600}>yt-dlp</Box>, and{" "}
            <Box component="span" fontWeight={600}>Python 3.8+</Box>
          </Typography>
        </Box>
      </Stack>
    </DashboardCard>
  );
};

export default QuickStart;
