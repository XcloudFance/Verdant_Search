import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, TextField,
  CircularProgress, Alert, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Divider
} from '@mui/material';
import {
  Psychology as ModelIcon, PlayArrow as RunIcon,
  CheckCircle as OnlineIcon, Cancel as OfflineIcon
} from '@mui/icons-material';

import { PYTHON_API } from '../../config';

export default function RerankerPanel() {
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [docIds, setDocIds] = useState('');
  const [compareTextOnly, setCompareTextOnly] = useState(false);
  const [debugResult, setDebugResult] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState(null);

  useEffect(() => {
    setStatusLoading(true);
    fetch(`${PYTHON_API}/api/v1/admin/reranker/status`)
      .then(r => r.json())
      .then(data => { setStatus(data); setStatusLoading(false); })
      .catch(() => { setStatus(null); setStatusLoading(false); });
  }, []);

  const handleRunDebug = async () => {
    if (!query.trim() || !docIds.trim()) return;
    setDebugLoading(true);
    setDebugError(null);
    setDebugResult(null);
    try {
      const ids = docIds.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n));
      if (ids.length === 0) throw new Error('No valid document IDs provided');
      const res = await fetch(`${PYTHON_API}/api/v1/admin/reranker/debug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), document_ids: ids, compare_text_only: compareTextOnly }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setDebugResult(data);
    } catch (e) {
      setDebugError(e.message);
    } finally {
      setDebugLoading(false);
    }
  };

  const getDeltaChip = (delta) => {
    if (delta == null) return <Typography variant="caption" color="text.disabled">—</Typography>;
    const positive = delta > 0;
    const zero = delta === 0;
    return (
      <Chip
        label={zero ? '0' : `${positive ? '+' : ''}${delta}`}
        size="small"
        sx={{
          bgcolor: zero ? 'rgba(107,114,128,0.15)' : positive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: zero ? '#9ca3af' : positive ? '#10b981' : '#ef4444',
          fontWeight: 700, fontSize: 12, height: 22,
        }}
      />
    );
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>Reranker Management</Typography>

      {/* Status Card */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
          <ModelIcon sx={{ color: '#10b981' }} />
          <Typography variant="subtitle1" fontWeight={600}>Model Status</Typography>
        </Stack>
        {statusLoading ? (
          <CircularProgress size={24} sx={{ color: '#10b981' }} />
        ) : !status ? (
          <Alert severity="warning">Could not reach reranker service</Alert>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Status</Typography>
              <Stack direction="row" alignItems="center" spacing={0.75} mt={0.25}>
                {status.available
                  ? <OnlineIcon sx={{ color: '#10b981', fontSize: 18 }} />
                  : <OfflineIcon sx={{ color: '#ef4444', fontSize: 18 }} />}
                <Typography variant="body1" fontWeight={600} sx={{ color: status.available ? '#10b981' : '#ef4444' }}>
                  {status.available ? 'Online' : 'Offline'}
                </Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Model</Typography>
              <Typography variant="body1" fontWeight={600}>{status.model || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Window Size</Typography>
              <Typography variant="body1" fontWeight={600}>{status.window_size ?? '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">Stride</Typography>
              <Typography variant="body1" fontWeight={600}>{status.stride ?? '—'}</Typography>
            </Grid>
            {status.mode && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Mode</Typography>
                <Chip
                  label={status.mode}
                  size="small"
                  sx={{ mt: 0.25, bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                />
              </Grid>
            )}
            {status.model_loaded != null && (
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary">Model Loaded</Typography>
                <Typography variant="body1" fontWeight={600}>{status.model_loaded ? 'Yes' : 'No'}</Typography>
              </Grid>
            )}
          </Grid>
        )}
      </Paper>

      {/* Live Debugger */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} mb={2}>Live Reranking Debugger</Typography>
        <Typography variant="body2" color="text.secondary" mb={2.5}>
          Enter a query and comma-separated document IDs from the index to run the reranker and inspect ranking changes.
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Search Query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            fullWidth
            size="small"
            placeholder="e.g. machine learning in healthcare"
          />
          <TextField
            label="Document IDs (comma-separated)"
            value={docIds}
            onChange={e => setDocIds(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={3}
            placeholder="e.g. 1, 5, 12, 23, 44, 67"
          />
          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="contained"
              onClick={handleRunDebug}
              disabled={debugLoading || !query.trim() || !docIds.trim()}
              startIcon={debugLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <RunIcon />}
              sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, alignSelf: 'flex-start' }}
            >
              {debugLoading ? 'Running...' : 'Run Reranker'}
            </Button>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">Compare Text-Only:</Typography>
              <Chip
                label={compareTextOnly ? 'ON' : 'OFF'}
                size="small"
                onClick={() => setCompareTextOnly(v => !v)}
                sx={{
                  cursor: 'pointer',
                  bgcolor: compareTextOnly ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.2)',
                  color: compareTextOnly ? '#10b981' : '#9ca3af',
                }}
              />
            </Stack>
          </Stack>
        </Stack>

        {debugError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setDebugError(null)}>{debugError}</Alert>
        )}

        {debugResult && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle2" fontWeight={600}>Reranking Results</Typography>
              {debugResult.latency_ms != null && (
                <Chip
                  label={`${debugResult.latency_ms.toFixed(0)}ms`}
                  size="small"
                  sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
                />
              )}
            </Stack>
            {debugResult.results && debugResult.results.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: 'rgba(255,255,255,0.03)', fontWeight: 600, fontSize: 12, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.06)' } }}>
                      <TableCell>Doc ID</TableCell>
                      <TableCell align="center">Pre-Rank</TableCell>
                      <TableCell align="center">Post-Rank</TableCell>
                      <TableCell align="center">Delta</TableCell>
                      <TableCell>Pre-Score</TableCell>
                      <TableCell>Post-Score</TableCell>
                      <TableCell>Title / Snippet</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {debugResult.results.map((r, i) => (
                      <TableRow key={i} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', fontSize: 13 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#3b82f6' }}>{r.document_id}</Typography>
                        </TableCell>
                        <TableCell align="center">{r.pre_rank ?? '—'}</TableCell>
                        <TableCell align="center">{r.post_rank ?? '—'}</TableCell>
                        <TableCell align="center">{getDeltaChip(r.rank_delta)}</TableCell>
                        <TableCell>
                          <Typography variant="caption">{r.pre_score != null ? Number(r.pre_score).toFixed(4) : '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{r.post_score != null ? Number(r.post_score).toFixed(4) : '—'}</Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}>
                          <Typography variant="body2" noWrap>{r.title || r.snippet || '—'}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary" variant="body2">No results returned from reranker</Typography>
            )}

            {debugResult.text_only_results && debugResult.text_only_results.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={1} sx={{ color: '#f59e0b' }}>
                  Text-Only Comparison
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: 'rgba(255,255,255,0.03)', fontWeight: 600, fontSize: 12, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.06)' } }}>
                        <TableCell>Doc ID</TableCell>
                        <TableCell align="center">Text-Only Rank</TableCell>
                        <TableCell align="center">Multimodal Rank</TableCell>
                        <TableCell align="center">Diff</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {debugResult.text_only_results.map((r, i) => {
                        const mmResult = debugResult.results.find(x => x.document_id === r.document_id);
                        const diff = mmResult ? r.rank - mmResult.post_rank : null;
                        return (
                          <TableRow key={i} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', fontSize: 13 } }}>
                            <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#3b82f6' }}>{r.document_id}</Typography></TableCell>
                            <TableCell align="center">{r.rank ?? '—'}</TableCell>
                            <TableCell align="center">{mmResult?.post_rank ?? '—'}</TableCell>
                            <TableCell align="center">{getDeltaChip(diff)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
