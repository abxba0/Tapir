"use client";
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tabs,
  Tab,
} from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import PageContainer from "@/app/(DashboardLayout)/components/container/PageContainer";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";
import {
  IconMicrophone,
  IconRefresh,
  IconTrash,
  IconCheck,
  IconX,
  IconClock,
  IconLink,
  IconFile,
  IconFileDownload,
} from "@tabler/icons-react";
import { transcribeMedia, listJobs, deleteJob, getFileDownloadUrl, type JobStatus } from "@/services/tapirApi";

const TranscribePage = () => {
  const [inputType, setInputType] = useState<"url" | "file">("url");
  const [url, setUrl] = useState("");
  const [filePath, setFilePath] = useState("");
  const [modelSize, setModelSize] = useState<"tiny" | "base" | "small" | "medium" | "large">("base");
  const [language, setLanguage] = useState("en");
  const [outputFormat, setOutputFormat] = useState<"txt" | "srt" | "vtt">("txt");
  const [outputDir, setOutputDir] = useState("youtube_downloads");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Poll for job updates - increased interval to reduce load
  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // Changed from 3s to 5s
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      setRefreshing(true);
      const result = await listJobs({ type: "transcribe" });
      setJobs(result.jobs);
    } catch (err: any) {
      console.error("Failed to load jobs:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (inputType === "url" && !url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (inputType === "file" && !filePath.trim()) {
      setError("Please enter a file path");
      return;
    }

    try {
      setLoading(true);
      const response = await transcribeMedia({
        url: inputType === "url" ? url.trim() : undefined,
        filePath: inputType === "file" ? filePath.trim() : undefined,
        modelSize,
        language: language || undefined,
        outputFormat,
        outputDir,
      });

      setSuccess(`Transcription queued! Job ID: ${response.jobId}`);
      setUrl("");
      setFilePath("");
      loadJobs();
    } catch (err: any) {
      setError(err.message || "Failed to queue transcription");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      loadJobs();
    } catch (err: any) {
      console.error("Failed to delete job:", err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <IconCheck size={18} color="#13DEB9" />;
      case "failed":
        return <IconX size={18} color="#FA896B" />;
      case "running":
        return <CircularProgress size={18} />;
      case "queued":
        return <IconClock size={18} color="#FFAE1F" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "failed":
        return "error";
      case "running":
        return "info";
      case "queued":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <PageContainer title="Transcribe — Tapir" description="Transcribe audio and video content">
      <Box>
        <Typography variant="h2" sx={{ mb: 1, fontWeight: 700 }}>
          Transcribe Media
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 4, maxWidth: 600 }}>
          Transcribe audio and video content from URLs or local files using OpenAI Whisper.
        </Typography>

        <Grid2 container spacing={3}>
          {/* Transcription Form */}
          <Grid2 size={{ xs: 12, lg: 8 }}>
            <DashboardCard title="Queue Transcription" subtitle="Enter a URL or file path to transcribe">
              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <Tabs
                    value={inputType}
                    onChange={(e, val) => setInputType(val)}
                    sx={{ borderBottom: 1, borderColor: "divider" }}
                  >
                    <Tab label="From URL" value="url" icon={<IconLink size={18} />} iconPosition="start" />
                    <Tab label="From File" value="file" icon={<IconFile size={18} />} iconPosition="start" />
                  </Tabs>

                  {inputType === "url" ? (
                    <TextField
                      fullWidth
                      label="Media URL"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={loading}
                      helperText="URL to video or audio file"
                    />
                  ) : (
                    <TextField
                      fullWidth
                      label="File Path"
                      placeholder="/path/to/audio.mp3"
                      value={filePath}
                      onChange={(e) => setFilePath(e.target.value)}
                      disabled={loading}
                      helperText="Path to local audio/video file on the server"
                    />
                  )}

                  <Grid2 container spacing={2}>
                    <Grid2 size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth>
                        <InputLabel>Model Size</InputLabel>
                        <Select
                          value={modelSize}
                          label="Model Size"
                          onChange={(e) => setModelSize(e.target.value as any)}
                          disabled={loading}
                        >
                          <MenuItem value="tiny">Tiny (75 MB)</MenuItem>
                          <MenuItem value="base">Base (142 MB)</MenuItem>
                          <MenuItem value="small">Small (466 MB)</MenuItem>
                          <MenuItem value="medium">Medium (1.5 GB)</MenuItem>
                          <MenuItem value="large">Large (2.9 GB)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid2>
                    <Grid2 size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth>
                        <InputLabel>Output Format</InputLabel>
                        <Select
                          value={outputFormat}
                          label="Output Format"
                          onChange={(e) => setOutputFormat(e.target.value as any)}
                          disabled={loading}
                        >
                          <MenuItem value="txt">Plain Text (TXT)</MenuItem>
                          <MenuItem value="srt">SubRip (SRT)</MenuItem>
                          <MenuItem value="vtt">WebVTT (VTT)</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid2>
                    <Grid2 size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="Language"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        disabled={loading}
                        placeholder="en"
                        helperText="Language code (e.g., en, es, fr)"
                      />
                    </Grid2>
                  </Grid2>

                  <TextField
                    fullWidth
                    label="Output Directory"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    disabled={loading}
                    helperText="Directory where transcription will be saved"
                  />

                  {error && (
                    <Alert severity="error" onClose={() => setError(null)}>
                      {error}
                    </Alert>
                  )}

                  {success && (
                    <Alert severity="success" onClose={() => setSuccess(null)}>
                      {success}
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={loading ? <CircularProgress size={20} /> : <IconMicrophone size={20} />}
                    disabled={loading || (inputType === "url" ? !url.trim() : !filePath.trim())}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {loading ? "Queueing..." : "Queue Transcription"}
                  </Button>
                </Stack>
              </form>
            </DashboardCard>
          </Grid2>

          {/* Job Status */}
          <Grid2 size={{ xs: 12, lg: 4 }}>
            <DashboardCard
              title="Transcription Jobs"
              subtitle="Recent transcriptions"
              action={
                <IconButton onClick={loadJobs} disabled={refreshing} size="small">
                  <IconRefresh size={18} />
                </IconButton>
              }
            >
              {jobs.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ py: 3, textAlign: "center" }}>
                  No transcription jobs yet
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {jobs.slice(0, 5).map((job) => (
                    <Card key={job.id} variant="outlined" sx={{ borderRadius: "8px" }}>
                      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                          <Chip
                            label={job.status}
                            size="small"
                            color={getStatusColor(job.status) as any}
                            icon={getStatusIcon(job.status) as any}
                          />
                          <Stack direction="row" spacing={0.5}>
                            {job.status === "completed" && (job.result as any)?.outputFile && (
                              <IconButton
                                size="small"
                                color="primary"
                                component="a"
                                href={getFileDownloadUrl(job.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <IconFileDownload size={16} />
                              </IconButton>
                            )}
                            {job.status !== "running" && (
                              <IconButton size="small" onClick={() => handleDelete(job.id)}>
                                <IconTrash size={16} />
                              </IconButton>
                            )}
                          </Stack>
                        </Stack>
                        <Typography variant="body2" sx={{ fontSize: "0.8rem", mb: 0.5 }}>
                          {(job.request as any).url?.slice(0, 50) || (job.request as any).filePath?.slice(0, 50)}...
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Model: {(job.request as any).modelSize || "base"} • Format: {(job.request as any).outputFormat || "txt"}
                        </Typography>
                        {job.error && (
                          <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                            {job.error}
                          </Alert>
                        )}
                        {job.result && (job.result as any).text && (
                          <Box
                            sx={{
                              mt: 1,
                              p: 1,
                              bgcolor: "grey.100",
                              borderRadius: "4px",
                              maxHeight: 100,
                              overflow: "auto",
                            }}
                          >
                            <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                              {(job.result as any).text?.slice(0, 200)}...
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </DashboardCard>
          </Grid2>

          {/* All Jobs Table */}
          <Grid2 size={12}>
            <DashboardCard
              title="All Transcription Jobs"
              subtitle="Complete job history"
              action={
                <IconButton onClick={loadJobs} disabled={refreshing} size="small">
                  <IconRefresh size={18} />
                </IconButton>
              }
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Model</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Format</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                          <Typography variant="body2" color="textSecondary">
                            No jobs yet
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>
                            <Chip
                              label={job.status}
                              size="small"
                              color={getStatusColor(job.status) as any}
                              icon={getStatusIcon(job.status) as any}
                            />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {(job.request as any).url || (job.request as any).filePath}
                          </TableCell>
                          <TableCell>{(job.request as any).modelSize || "base"}</TableCell>
                          <TableCell>{(job.request as any).outputFormat || "txt"}</TableCell>
                          <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5}>
                              {job.status === "completed" && (job.result as any)?.outputFile && (
                                <IconButton
                                  size="small"
                                  color="primary"
                                  component="a"
                                  href={getFileDownloadUrl(job.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <IconFileDownload size={16} />
                                </IconButton>
                              )}
                              {job.status !== "running" && (
                                <IconButton size="small" onClick={() => handleDelete(job.id)}>
                                  <IconTrash size={16} />
                                </IconButton>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </DashboardCard>
          </Grid2>
        </Grid2>
      </Box>
    </PageContainer>
  );
};

export default TranscribePage;
