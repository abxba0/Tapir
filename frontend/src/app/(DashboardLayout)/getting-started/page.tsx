"use client";
import React from "react";
import { Box, Typography, Stack, Card, CardContent, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,  } from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import PageContainer from "@/app/(DashboardLayout)/components/container/PageContainer";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";
import { IconTerminal2, IconCheck } from "@tabler/icons-react";

const CodeBlock = ({ children }: { children: string }) => (
  <Box
    sx={{
      bgcolor: "#2A3547",
      borderRadius: "8px",
      p: 2,
      display: "flex",
      alignItems: "center",
      gap: 1,
      overflowX: "auto",
    }}
  >
    <IconTerminal2 size={14} color="#5D87FF" stroke={2} />
    <Typography
      component="code"
      sx={{
        color: "#13DEB9",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: "0.82rem",
        letterSpacing: "0.02em",
        whiteSpace: "pre",
      }}
    >
      {children}
    </Typography>
  </Box>
);

const requiredDeps = [
  {
    name: "yt-dlp",
    purpose: "Video/audio downloading",
    install: "pip install yt-dlp",
  },
  {
    name: "Python 3.8+",
    purpose: "Python runtime",
    install: "Pre-installed on most systems",
  },
  {
    name: "Bun",
    purpose: "TypeScript TUI runtime",
    install: "curl -fsSL https://bun.sh/install | bash",
  },
];

const optionalDeps = [
  {
    name: "FFmpeg",
    purpose: "Audio conversion, stream merging",
    install: "brew install ffmpeg / apt install ffmpeg",
  },
  {
    name: "OpenAI Whisper",
    purpose: "Local speech-to-text",
    install: "pip install openai-whisper",
  },
  {
    name: "edge-tts",
    purpose: "Text-to-speech (recommended)",
    install: "pip install edge-tts",
  },
  {
    name: "gTTS",
    purpose: "Text-to-speech (Google)",
    install: "pip install gTTS",
  },
  {
    name: "espeak",
    purpose: "Text-to-speech (offline)",
    install: "apt install espeak-ng",
  },
];

const whisperModels = [
  { model: "tiny", size: "75 MB", vram: "~1 GB", speed: "Fastest", accuracy: "Low" },
  { model: "base", size: "142 MB", vram: "~1 GB", speed: "Fast", accuracy: "Decent" },
  { model: "small", size: "466 MB", vram: "~2 GB", speed: "Moderate", accuracy: "Good" },
  { model: "medium", size: "1.5 GB", vram: "~5 GB", speed: "Slow", accuracy: "High" },
  { model: "large", size: "2.9 GB", vram: "~10 GB", speed: "Slowest", accuracy: "Best" },
];

const GettingStartedPage = () => {
  return (
    <PageContainer title="Getting Started — Tapir" description="Get started with Tapir">
      <Box>
        <Typography variant="h2" sx={{ mb: 1, fontWeight: 700 }}>
          Getting Started
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 4, maxWidth: 600 }}>
          Get Tapir up and running in minutes. Follow the steps below to install
          and launch.
        </Typography>

        <Grid2 container spacing={3}>
          {/* Installation Steps */}
          <Grid2 size={{ xs: 12, lg: 8 }}>
            <Stack spacing={3}>
              <DashboardCard title="Installation" subtitle="Clone, install, and launch">
                <Stack spacing={3}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <Chip label="1" size="small" sx={{ height: 22, minWidth: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: "primary.main", color: "#fff" }} />
                      <Typography variant="body1" fontWeight={600}>Clone the repository</Typography>
                    </Stack>
                    <CodeBlock>git clone https://github.com/abxba0/Tapir.git</CodeBlock>
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <Chip label="2" size="small" sx={{ height: 22, minWidth: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: "primary.main", color: "#fff" }} />
                      <Typography variant="body1" fontWeight={600}>Navigate to the TUI directory</Typography>
                    </Stack>
                    <CodeBlock>cd Tapir/tui</CodeBlock>
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <Chip label="3" size="small" sx={{ height: 22, minWidth: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: "primary.main", color: "#fff" }} />
                      <Typography variant="body1" fontWeight={600}>Install dependencies</Typography>
                    </Stack>
                    <CodeBlock>bun install</CodeBlock>
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                      <Chip label="4" size="small" sx={{ height: 22, minWidth: 22, fontSize: "0.7rem", fontWeight: 700, bgcolor: "primary.main", color: "#fff" }} />
                      <Typography variant="body1" fontWeight={600}>Launch Tapir</Typography>
                    </Stack>
                    <CodeBlock>bun start</CodeBlock>
                  </Box>
                </Stack>
              </DashboardCard>

              {/* Other run modes */}
              <DashboardCard title="Run Modes" subtitle="Different ways to use Tapir">
                <Grid2 container spacing={2}>
                  <Grid2 size={{ xs: 12, md: 4 }}>
                    <Box sx={{ p: 2, borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="h6" sx={{ mb: 1 }}>Interactive TUI</Typography>
                      <CodeBlock>bun start</CodeBlock>
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        Full terminal UI with menus
                      </Typography>
                    </Box>
                  </Grid2>
                  <Grid2 size={{ xs: 12, md: 4 }}>
                    <Box sx={{ p: 2, borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="h6" sx={{ mb: 1 }}>REST API Server</Typography>
                      <CodeBlock>bun run server</CodeBlock>
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        HTTP service for external tools
                      </Typography>
                    </Box>
                  </Grid2>
                  <Grid2 size={{ xs: 12, md: 4 }}>
                    <Box sx={{ p: 2, borderRadius: "10px", border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="h6" sx={{ mb: 1 }}>MCP Server</Typography>
                      <CodeBlock>bun run mcp</CodeBlock>
                      <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                        AI agent integration
                      </Typography>
                    </Box>
                  </Grid2>
                </Grid2>
              </DashboardCard>

              {/* Whisper Models */}
              <DashboardCard title="Whisper Models" subtitle="Available transcription models (downloaded on first use)">
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Model</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>VRAM</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Speed</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Accuracy</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {whisperModels.map((model) => (
                        <TableRow key={model.model} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                          <TableCell>
                            <Chip label={model.model} size="small" sx={{ fontWeight: 600, fontFamily: "monospace" }} />
                          </TableCell>
                          <TableCell>{model.size}</TableCell>
                          <TableCell>{model.vram}</TableCell>
                          <TableCell>{model.speed}</TableCell>
                          <TableCell>{model.accuracy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DashboardCard>
            </Stack>
          </Grid2>

          {/* Sidebar: Dependencies */}
          <Grid2 size={{ xs: 12, lg: 4 }}>
            <Stack spacing={3}>
              <DashboardCard title="Required" subtitle="Must be installed">
                <Stack spacing={2}>
                  {requiredDeps.map((dep) => (
                    <Box key={dep.name} sx={{ p: 1.5, borderRadius: "8px", bgcolor: "grey.100" }}>
                      <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                        <IconCheck size={16} color="#13DEB9" stroke={2.5} />
                        <Typography variant="body1" fontWeight={600}>{dep.name}</Typography>
                      </Stack>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>{dep.purpose}</Typography>
                      <Box
                        sx={{
                          bgcolor: "#2A3547",
                          borderRadius: "6px",
                          px: 1.5,
                          py: 0.8,
                        }}
                      >
                        <Typography
                          component="code"
                          sx={{
                            color: "#13DEB9",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "0.72rem",
                          }}
                        >
                          {dep.install}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </DashboardCard>

              <DashboardCard title="Optional" subtitle="For additional capabilities">
                <Stack spacing={2}>
                  {optionalDeps.map((dep) => (
                    <Box key={dep.name} sx={{ p: 1.5, borderRadius: "8px", bgcolor: "grey.100" }}>
                      <Typography variant="body1" fontWeight={600} sx={{ mb: 0.3 }}>{dep.name}</Typography>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>{dep.purpose}</Typography>
                      <Box
                        sx={{
                          bgcolor: "#2A3547",
                          borderRadius: "6px",
                          px: 1.5,
                          py: 0.8,
                        }}
                      >
                        <Typography
                          component="code"
                          sx={{
                            color: "#49BEFF",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "0.72rem",
                          }}
                        >
                          {dep.install}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </DashboardCard>
            </Stack>
          </Grid2>
        </Grid2>
      </Box>
    </PageContainer>
  );
};

export default GettingStartedPage;
