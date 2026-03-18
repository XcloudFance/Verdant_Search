import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Stack, Button, TextField, Tabs, Tab,
  CircularProgress, Alert, Switch, FormControlLabel, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, Grid
} from '@mui/material';
import { Save as SaveIcon, Restore as ResetIcon, History as HistoryIcon } from '@mui/icons-material';

import { PYTHON_API } from '../../config';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function NumberField({ label, value, onChange, min, max, step = 1, helperText }) {
  return (
    <Box>
      <TextField
        label={label}
        type="number"
        value={value ?? ''}
        onChange={e => onChange(Number(e.target.value))}
        size="small"
        fullWidth
        inputProps={{ min, max, step }}
        helperText={helperText}
      />
    </Box>
  );
}

function ToggleField({ label, value, onChange, helperText }) {
  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'rgba(16,185,129,0.5)' },
            }}
          />
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
      {helperText && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 1 }}>{helperText}</Typography>}
    </Box>
  );
}

function TextField2({ label, value, onChange, multiline, rows, helperText }) {
  return (
    <Box>
      <TextField
        label={label}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        size="small"
        fullWidth
        multiline={multiline}
        rows={rows}
        helperText={helperText}
      />
    </Box>
  );
}

const CONFIG_SCHEMA = {
  search: {
    label: 'Search',
    fields: [
      { key: 'bm25_k1', label: 'BM25 k1', type: 'number', min: 0.1, max: 5, step: 0.1, helperText: 'Term frequency saturation (default: 1.2)' },
      { key: 'bm25_b', label: 'BM25 b', type: 'number', min: 0, max: 1, step: 0.05, helperText: 'Length normalization (default: 0.75)' },
      { key: 'hnsw_ef_search', label: 'HNSW ef_search', type: 'number', min: 10, max: 500, step: 10, helperText: 'HNSW search quality parameter' },
      { key: 'rrf_k', label: 'RRF k', type: 'number', min: 1, max: 100, step: 1, helperText: 'Reciprocal Rank Fusion smoothing constant (default: 60)' },
      { key: 'stage1_top_k', label: 'Stage 1 Top-K', type: 'number', min: 10, max: 1000, step: 10, helperText: 'Candidates returned from first-stage retrieval' },
      { key: 'stage2_top_k', label: 'Stage 2 Top-K', type: 'number', min: 5, max: 100, step: 1, helperText: 'Candidates for reranker window' },
    ],
  },
  llm: {
    label: 'LLM',
    fields: [
      { key: 'llm_model', label: 'Model', type: 'text', helperText: 'LLM model identifier' },
      { key: 'llm_max_tokens', label: 'Max Tokens', type: 'number', min: 100, max: 8192, step: 100 },
      { key: 'llm_temperature', label: 'Temperature', type: 'number', min: 0, max: 2, step: 0.05, helperText: 'Sampling temperature (0=deterministic, 1=balanced)' },
      { key: 'llm_context_window', label: 'Context Window', type: 'number', min: 1000, max: 200000, step: 1000 },
      { key: 'llm_system_prompt', label: 'System Prompt Template', type: 'text', multiline: true, rows: 4 },
    ],
  },
  reranker: {
    label: 'Reranker',
    fields: [
      { key: 'reranker_enabled', label: 'Enable Reranker', type: 'toggle' },
      { key: 'reranker_window_size', label: 'Window Size', type: 'number', min: 5, max: 50, step: 1, helperText: 'Default W=10 (sliding window candidates per pass)' },
      { key: 'reranker_stride', label: 'Stride', type: 'number', min: 1, max: 20, step: 1, helperText: 'Default S=5' },
      { key: 'reranker_mode', label: 'Mode', type: 'text', helperText: 'listwise | pointwise' },
    ],
  },
  followup: {
    label: 'Follow-up Chips',
    fields: [
      { key: 'followup_enabled', label: 'Enable Follow-up Chips', type: 'toggle' },
      { key: 'followup_count', label: 'Number of Chips', type: 'number', min: 1, max: 5, step: 1, helperText: '1–5 chips per response' },
      { key: 'followup_prompt_template', label: 'Follow-up Prompt Template', type: 'text', multiline: true, rows: 5 },
    ],
  },
  index: {
    label: 'Index',
    fields: [
      { key: 'chunk_size', label: 'Chunk Size (tokens)', type: 'number', min: 64, max: 2048, step: 64 },
      { key: 'chunk_overlap', label: 'Chunk Overlap (tokens)', type: 'number', min: 0, max: 512, step: 16 },
      { key: 'embedding_model', label: 'Embedding Model', type: 'text' },
      { key: 'hnsw_m', label: 'HNSW M', type: 'number', min: 4, max: 128, step: 4, helperText: 'Number of bi-directional links (default: 16)' },
      { key: 'hnsw_ef_construction', label: 'HNSW ef_construction', type: 'number', min: 50, max: 1000, step: 50 },
    ],
  },
  crawler: {
    label: 'Crawler',
    fields: [
      { key: 'crawler_global_rate_limit', label: 'Global Rate Limit (req/sec)', type: 'number', min: 0.1, max: 100, step: 0.1 },
      { key: 'crawler_default_max_depth', label: 'Default Max Depth', type: 'number', min: 1, max: 20, step: 1 },
      { key: 'crawler_default_max_pages', label: 'Default Max Pages', type: 'number', min: 10, max: 100000, step: 10 },
      { key: 'crawler_heartbeat_interval', label: 'Heartbeat Interval (sec)', type: 'number', min: 5, max: 60, step: 5 },
      { key: 'crawler_dead_worker_grace_period', label: 'Dead Worker Grace Period (sec)', type: 'number', min: 10, max: 300, step: 10 },
      { key: 'crawler_job_queue_max_size', label: 'Job Queue Max Size', type: 'number', min: 100, max: 100000, step: 100 },
    ],
  },
};

export default function ConfigPanel() {
  const [tab, setTab] = useState(0);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${PYTHON_API}/api/v1/admin/config`);
      const data = await res.json();
      setConfig(data?.config || data || {});
    } catch {
      setSaveResult({ success: false, message: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${PYTHON_API}/api/v1/admin/config/history`);
      const data = await res.json();
      setHistory(data?.history || data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, [fetchConfig, fetchHistory]);

  const handleFieldChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${PYTHON_API}/api/v1/admin/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSaveResult({ success: true, message: data?.message || 'Configuration saved successfully' });
      fetchHistory();
    } catch (e) {
      setSaveResult({ success: false, message: `Save failed: ${e.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setSaveResult(null);
    try {
      const res = await fetch(`${PYTHON_API}/api/v1/admin/config/reset`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveResult({ success: true, message: 'Configuration reset to defaults' });
      fetchConfig();
      fetchHistory();
    } catch (e) {
      setSaveResult({ success: false, message: `Reset failed: ${e.message}` });
    } finally {
      setResetting(false);
      setResetConfirm(false);
    }
  };

  const tabKeys = Object.keys(CONFIG_SCHEMA);

  const renderField = (field) => {
    const value = config[field.key];
    switch (field.type) {
      case 'toggle':
        return <ToggleField key={field.key} label={field.label} value={value} onChange={v => handleFieldChange(field.key, v)} helperText={field.helperText} />;
      case 'number':
        return <NumberField key={field.key} label={field.label} value={value} onChange={v => handleFieldChange(field.key, v)} min={field.min} max={field.max} step={field.step} helperText={field.helperText} />;
      default:
        return <TextField2 key={field.key} label={field.label} value={value} onChange={v => handleFieldChange(field.key, v)} multiline={field.multiline} rows={field.rows} helperText={field.helperText} />;
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>System Configuration</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={resetting ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <ResetIcon />}
            onClick={() => setResetConfirm(true)}
            disabled={resetting || saving}
            variant="outlined"
            size="small"
            sx={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' } }}
          >
            Reset to Defaults
          </Button>
          <Button
            startIcon={saving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || resetting || loading}
            variant="contained"
            size="small"
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Stack>
      </Stack>

      {saveResult && (
        <Alert severity={saveResult.success ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setSaveResult(null)}>
          {saveResult.message}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ textAlign: 'center', pt: 6 }}><CircularProgress sx={{ color: '#10b981' }} /></Box>
      ) : (
        <Paper sx={{ bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              '& .MuiTab-root': { color: 'text.secondary', fontSize: 13 },
              '& .Mui-selected': { color: '#10b981' },
              '& .MuiTabs-indicator': { bgcolor: '#10b981' },
            }}
          >
            {tabKeys.map(k => (
              <Tab key={k} label={CONFIG_SCHEMA[k].label} />
            ))}
          </Tabs>

          {tabKeys.map((k, i) => (
            <TabPanel key={k} value={tab} index={i}>
              <Box sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  {CONFIG_SCHEMA[k].fields.map(field => (
                    <Grid item xs={12} sm={field.multiline ? 12 : 6} md={field.type === 'toggle' ? 4 : field.multiline ? 12 : 4} key={field.key}>
                      {renderField(field)}
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </TabPanel>
          ))}
        </Paper>
      )}

      {/* Change History */}
      <Paper sx={{ mt: 3, bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle1" fontWeight={600}>Change History</Typography>
        </Box>
        {historyLoading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} sx={{ color: '#10b981' }} /></Box>
        ) : history.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">No configuration changes recorded</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: 'rgba(255,255,255,0.03)', fontWeight: 600, fontSize: 12, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.06)' } }}>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Changed By</TableCell>
                  <TableCell>Key</TableCell>
                  <TableCell>Before</TableCell>
                  <TableCell>After</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.slice(0, 50).map((entry, i) => (
                  <TableRow key={i} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', fontSize: 13 } }}>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{formatDate(entry.timestamp || entry.changed_at)}</Typography>
                    </TableCell>
                    <TableCell>{entry.changed_by || 'admin'}</TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#10b981' }}>{entry.key || entry.config_key || '—'}</Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 150 }}>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                        {JSON.stringify(entry.before ?? entry.old_value) ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 150 }}>
                      <Typography variant="caption" noWrap sx={{ display: 'block' }}>
                        {JSON.stringify(entry.after ?? entry.new_value) ?? '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Reset Confirmation */}
      <Dialog
        open={resetConfirm}
        onClose={() => setResetConfirm(false)}
        PaperProps={{ sx: { bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.12)' } }}
      >
        <DialogTitle>Reset to Defaults</DialogTitle>
        <DialogContent>
          <Typography>This will reset ALL configuration values to their defaults. Your current settings will be overwritten. This action is recorded in the change history.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetConfirm(false)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleReset} disabled={resetting} sx={{ color: '#ef4444' }}>
            {resetting ? <CircularProgress size={16} /> : 'Reset to Defaults'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
