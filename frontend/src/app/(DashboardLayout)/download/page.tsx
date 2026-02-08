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
  LinearProgress,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import PageContainer from "@/app/(DashboardLayout)/components/container/PageContainer";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";
import {
  IconDownload,
  IconPlayerPlay,
  IconRefresh,
  IconTrash,
  IconCheck,
  IconX,
  IconClock,
} from "@tabler/icons-react";
import { downloadMedia, getJobStatus, listJobs, deleteJob, type JobStatus } from "@/services/tapirApi";

const DownloadPage = () => {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState("best");
  const [quality, setQuality] = useState("best");
  const [outputDir, setOutputDir] = useState("youtube_downloads");
  const [downloadSubs, setDownloadSubs] = useState(true);
  const [embedMetadata, setEmbedMetadata] = useState(true);
  const [embedThumbnail, setEmbedThumbnail] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Poll for job updates
  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      setRefreshing(true);
      const result = await listJobs({ type: "download" });
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

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    try {
      setLoading(true);
      const response = await downloadMedia({
        url: url.trim(),
        format,
        quality,
        outputDir,
        downloadSubs,
        embedMetadata,
        embedThumbnail,
      });

      setSuccess(`Download queued! Job ID: ${response.jobId}`);
      setUrl("");
      loadJobs();
    } catch (err: any) {
      setError(err.message || "Failed to queue download");
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
    <PageContainer title="Download Media — Tapir" description="Download videos and audio from 1800+ sites">
      <Box>
        <Typography variant="h2" sx={{ mb: 1, fontWeight: 700 }}>
          Download Media
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 4, maxWidth: 600 }}>
          Download videos and audio from YouTube, Vimeo, Instagram, TikTok, SoundCloud, and 1800+ other sites.
        </Typography>

        <Grid2 container spacing={3}>
          {/* Download Form */}
          <Grid2 size={{ xs: 12, lg: 8 }}>
            <DashboardCard title="Queue Download" subtitle="Enter a URL to download media">
              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    label="Media URL"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading}
                  />

                  <Grid2 container spacing={2}>
                    <Grid2 size={{ xs: 12, md: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>Format</InputLabel>
                        <Select
                          value={format}
                          label="Format"
                          onChange={(e) => setFormat(e.target.value)}
                          disabled={loading}
                        >
                          <MenuItem value="best">Best Quality</MenuItem>
                          <MenuItem value="bestvideo+bestaudio">Best Video + Audio</MenuItem>
                          <MenuItem value="bestaudio">Audio Only</MenuItem>
                          <MenuItem value="mp4">MP4</MenuItem>
                          <MenuItem value="webm">WebM</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid2>
                    <Grid2 size={{ xs: 12, md: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>Quality</InputLabel>
                        <Select
                          value={quality}
                          label="Quality"
                          onChange={(e) => setQuality(e.target.value)}
                          disabled={loading}
                        >
                          <MenuItem value="best">Best</MenuItem>
                          <MenuItem value="1080p">1080p</MenuItem>
                          <MenuItem value="720p">720p</MenuItem>
                          <MenuItem value="480p">480p</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid2>
                  </Grid2>

                  <TextField
                    fullWidth
                    label="Output Directory"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    disabled={loading}
                    helperText="Directory where files will be saved"
                  />

                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={downloadSubs}
                          onChange={(e) => setDownloadSubs(e.target.checked)}
                          disabled={loading}
                        />
                      }
                      label="Download Subtitles"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={embedMetadata}
                          onChange={(e) => setEmbedMetadata(e.target.checked)}
                          disabled={loading}
                        />
                      }
                      label="Embed Metadata"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={embedThumbnail}
                          onChange={(e) => setEmbedThumbnail(e.target.checked)}
                          disabled={loading}
                        />
                      }
                      label="Embed Thumbnail"
                    />
                  </Stack>

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
                    startIcon={loading ? <CircularProgress size={20} /> : <IconDownload size={20} />}
                    disabled={loading || !url.trim()}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {loading ? "Queueing..." : "Queue Download"}
                  </Button>
                </Stack>
              </form>
            </DashboardCard>
          </Grid2>

          {/* Job Status */}
          <Grid2 size={{ xs: 12, lg: 4 }}>
            <DashboardCard
              title="Download Jobs"
              subtitle="Recent downloads"
              action={
                <IconButton onClick={loadJobs} disabled={refreshing} size="small">
                  <IconRefresh size={18} />
                </IconButton>
              }
            >
              {jobs.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ py: 3, textAlign: "center" }}>
                  No download jobs yet
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
                          {job.status !== "running" && (
                            <IconButton size="small" onClick={() => handleDelete(job.id)}>
                              <IconTrash size={16} />
                            </IconButton>
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ fontSize: "0.8rem", mb: 0.5 }}>
                          {(job.request as any).url?.slice(0, 50)}...
                        </Typography>
                        {job.status === "running" && job.progress && (
                          <Box sx={{ mt: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={job.progress.percent || 0}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                            <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5 }}>
                              {job.progress.percent?.toFixed(1)}% • {job.progress.speed} • ETA: {job.progress.eta}
                            </Typography>
                          </Box>
                        )}
                        {job.error && (
                          <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                            {job.error}
                          </Alert>
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
              title="All Download Jobs"
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
                      <TableCell sx={{ fontWeight: 600 }}>URL</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Format</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
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
                            {(job.request as any).url}
                          </TableCell>
                          <TableCell>{(job.request as any).format || "best"}</TableCell>
                          <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            {job.status !== "running" && (
                              <IconButton size="small" onClick={() => handleDelete(job.id)}>
                                <IconTrash size={16} />
                              </IconButton>
                            )}
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

export default DownloadPage;
