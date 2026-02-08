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
} from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import PageContainer from "@/app/(DashboardLayout)/components/container/PageContainer";
import DashboardCard from "@/app/(DashboardLayout)/components/shared/DashboardCard";
import {
  IconFileText,
  IconRefresh,
  IconTrash,
  IconCheck,
  IconX,
  IconClock,
} from "@tabler/icons-react";
import { textToSpeech, listJobs, deleteJob, type JobStatus } from "@/services/tapirApi";

const TextToSpeechPage = () => {
  const [inputFile, setInputFile] = useState("");
  const [voice, setVoice] = useState("");
  const [engine, setEngine] = useState<"edge-tts" | "gtts" | "espeak">("edge-tts");
  const [outputFormat, setOutputFormat] = useState<"mp3" | "wav">("mp3");
  const [outputDir, setOutputDir] = useState("youtube_downloads");

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
      const result = await listJobs({ type: "tts" });
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

    if (!inputFile.trim()) {
      setError("Please enter a file path");
      return;
    }

    try {
      setLoading(true);
      const response = await textToSpeech({
        inputFile: inputFile.trim(),
        voice: voice || undefined,
        engine,
        outputFormat,
        outputDir,
      });

      setSuccess(`Text-to-speech queued! Job ID: ${response.jobId}`);
      setInputFile("");
      loadJobs();
    } catch (err: any) {
      setError(err.message || "Failed to queue text-to-speech");
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
    <PageContainer title="Text to Speech — Tapir" description="Convert text documents to speech">
      <Box>
        <Typography variant="h2" sx={{ mb: 1, fontWeight: 700 }}>
          Text to Speech
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 4, maxWidth: 600 }}>
          Convert documents into spoken audio. Supports PDF, TXT, Markdown, HTML, and other text formats.
        </Typography>

        <Grid2 container spacing={3}>
          {/* TTS Form */}
          <Grid2 size={{ xs: 12, lg: 8 }}>
            <DashboardCard title="Queue Text-to-Speech" subtitle="Enter a file path to convert to speech">
              <form onSubmit={handleSubmit}>
                <Stack spacing={3}>
                  <TextField
                    fullWidth
                    label="Input File Path"
                    placeholder="/path/to/document.txt"
                    value={inputFile}
                    onChange={(e) => setInputFile(e.target.value)}
                    disabled={loading}
                    helperText="Path to text file on the server (TXT, PDF, MD, HTML, etc.)"
                  />

                  <Grid2 container spacing={2}>
                    <Grid2 size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth>
                        <InputLabel>Engine</InputLabel>
                        <Select
                          value={engine}
                          label="Engine"
                          onChange={(e) => setEngine(e.target.value as any)}
                          disabled={loading}
                        >
                          <MenuItem value="edge-tts">Edge TTS (Recommended)</MenuItem>
                          <MenuItem value="gtts">Google TTS</MenuItem>
                          <MenuItem value="espeak">eSpeak (Offline)</MenuItem>
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
                          <MenuItem value="mp3">MP3</MenuItem>
                          <MenuItem value="wav">WAV</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid2>
                    <Grid2 size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="Voice (Optional)"
                        value={voice}
                        onChange={(e) => setVoice(e.target.value)}
                        disabled={loading}
                        placeholder="en-US-AriaNeural"
                        helperText="Leave empty for default"
                      />
                    </Grid2>
                  </Grid2>

                  <TextField
                    fullWidth
                    label="Output Directory"
                    value={outputDir}
                    onChange={(e) => setOutputDir(e.target.value)}
                    disabled={loading}
                    helperText="Directory where audio will be saved"
                  />

                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Popular Voices:</strong> en-US-AriaNeural, en-US-GuyNeural, en-GB-LibbyNeural, es-ES-ElviraNeural, fr-FR-DeniseNeural
                    </Typography>
                  </Alert>

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
                    startIcon={loading ? <CircularProgress size={20} /> : <IconFileText size={20} />}
                    disabled={loading || !inputFile.trim()}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {loading ? "Queueing..." : "Queue Text-to-Speech"}
                  </Button>
                </Stack>
              </form>
            </DashboardCard>
          </Grid2>

          {/* Job Status */}
          <Grid2 size={{ xs: 12, lg: 4 }}>
            <DashboardCard
              title="TTS Jobs"
              subtitle="Recent conversions"
              action={
                <IconButton onClick={loadJobs} disabled={refreshing} size="small">
                  <IconRefresh size={18} />
                </IconButton>
              }
            >
              {jobs.length === 0 ? (
                <Typography variant="body2" color="textSecondary" sx={{ py: 3, textAlign: "center" }}>
                  No TTS jobs yet
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
                          {(job.request as any).inputFile?.slice(0, 50)}...
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Engine: {(job.request as any).engine || "edge-tts"} • Format: {(job.request as any).outputFormat || "mp3"}
                        </Typography>
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
              title="All TTS Jobs"
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
                      <TableCell sx={{ fontWeight: 600 }}>Input File</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Engine</TableCell>
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
                            {(job.request as any).inputFile}
                          </TableCell>
                          <TableCell>{(job.request as any).engine || "edge-tts"}</TableCell>
                          <TableCell>{(job.request as any).outputFormat || "mp3"}</TableCell>
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

export default TextToSpeechPage;
