import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Stack, Chip, Divider,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip, LinearProgress, Table,
  TableBody, TableCell, TableHead, TableRow, TableContainer,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import StorageIcon from '@mui/icons-material/Storage';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { PYTHON_API } from '../../config';

// ── helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function parseDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const sx = {
  card: {
    bgcolor: '#111117',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 2.5,
    p: 3,
  },
  terminalBox: {
    bgcolor: '#0a0a0f',
    border: '1px solid rgba(16,185,129,0.2)',
    borderRadius: 1.5,
    p: 2,
    fontFamily: 'monospace',
    fontSize: 12.5,
    color: '#10b981',
    lineHeight: 1.7,
    maxHeight: 220,
    overflowY: 'auto',
    mt: 2,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: 'text.disabled',
    textTransform: 'uppercase',
    mb: 1,
  },
};

// ── Terminal log component ─────────────────────────────────────────────────────

function TerminalLog({ lines, title = 'Output' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  if (!lines || lines.length === 0) return null;
  return (
    <Box ref={ref} sx={sx.terminalBox}>
      {lines.map((l, i) => {
        const isErr = /error/i.test(l);
        const isDone = /done|complete|✓/i.test(l);
        return (
          <Box key={i} component="div" sx={{ color: isErr ? '#ef4444' : isDone ? '#34d399' : '#10b981' }}>
            {l}
          </Box>
        );
      })}
    </Box>
  );
}

// ── Size bar ─────────────────────────────────────────────────────────────────

function SizeBar({ sizeBytes, maxBytes }) {
  const pct = Math.min(100, (sizeBytes / maxBytes) * 100);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1, height: 4, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: '#10b981', borderRadius: 2, transition: 'width 0.6s' }} />
      </Box>
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BackupPanel() {
  const [backups, setBackups] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupLogs, setBackupLogs] = useState([]);
  const [backupResult, setBackupResult] = useState(null); // {success, filename, size_human}
  const [restoreTarget, setRestoreTarget] = useState(null); // filename to restore
  const [restoreRunning, setRestoreRunning] = useState(false);
  const [restoreLogs, setRestoreLogs] = useState([]);
  const [restoreResult, setRestoreResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [error, setError] = useState('');

  const maxSize = backups.length > 0 ? Math.max(...backups.map(b => b.size_bytes)) : 1;

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const res = await fetch(`${PYTHON_API}/api/admin/backup/list`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const runBackup = async () => {
    setBackupRunning(true);
    setBackupLogs(['[--:--:--] Initiating backup…']);
    setBackupResult(null);
    try {
      const res = await fetch(`${PYTHON_API}/api/admin/backup/run`, { method: 'POST' });
      const data = await res.json();
      setBackupLogs(data.logs || []);
      setBackupResult(data);
      if (data.success) fetchList();
    } catch (e) {
      setBackupLogs(prev => [...prev, `ERROR: ${e.message}`]);
      setBackupResult({ success: false });
    } finally {
      setBackupRunning(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoreRunning(true);
    setRestoreLogs(['[--:--:--] Starting restore…']);
    setRestoreResult(null);
    try {
      const res = await fetch(`${PYTHON_API}/api/admin/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: restoreTarget, confirm: true }),
      });
      const data = await res.json();
      setRestoreLogs(data.logs || []);
      setRestoreResult(data);
    } catch (e) {
      setRestoreLogs(prev => [...prev, `ERROR: ${e.message}`]);
      setRestoreResult({ success: false });
    } finally {
      setRestoreRunning(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteRunning(true);
    try {
      await fetch(`${PYTHON_API}/api/admin/backup/${encodeURIComponent(deleteTarget)}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchList();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleteRunning(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700} mb={0.5}>Database Backup</Typography>
          <Typography variant="body2" color="text.secondary">
            PostgreSQL → gzip → Google Drive&nbsp;
            <Chip label="hongyigoogledrive:searchengine_db" size="small"
              sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 11, height: 20, fontFamily: 'monospace' }} />
          </Typography>
        </Box>
        <Tooltip title="Refresh backup list">
          <IconButton onClick={fetchList} disabled={loadingList}
            sx={{ color: 'text.secondary', '&:hover': { color: '#10b981', bgcolor: 'rgba(16,185,129,0.08)' } }}>
            <RefreshIcon sx={{ animation: loadingList ? 'spin 1s linear infinite' : 'none',
              '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Stats row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        {[
          { icon: <CloudDoneIcon />, label: 'Total Backups', value: backups.length, color: '#10b981' },
          { icon: <StorageIcon />, label: 'Latest Size', value: backups[0]?.size_human || '—', color: '#3b82f6' },
          { icon: <ScheduleIcon />, label: 'Last Backup', value: relativeTime(backups[0]?.created_at), color: '#f59e0b' },
        ].map((s, i) => (
          <Paper key={i} sx={{ ...sx.card, p: 2 }} elevation={0}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ p: 1, bgcolor: s.color + '18', borderRadius: 1.5, color: s.color, display: 'flex' }}>{s.icon}</Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5 }}>{s.label}</Typography>
                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, color: s.color }}>{s.value}</Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      {/* Run Backup */}
      <Paper sx={sx.card} elevation={0}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={backupLogs.length ? 0 : 0}>
          <Box>
            <Typography sx={sx.label}>New Backup</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
              Dumps the current database, compresses it, and uploads to Google Drive.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={backupRunning
              ? <CircularProgress size={16} sx={{ color: 'white' }} />
              : <CloudUploadIcon />}
            onClick={runBackup}
            disabled={backupRunning}
            sx={{
              bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' },
              minWidth: 160, fontWeight: 600,
              boxShadow: '0 0 20px rgba(16,185,129,0.3)',
            }}
          >
            {backupRunning ? 'Running…' : 'Backup Now'}
          </Button>
        </Stack>

        {backupRunning && (
          <LinearProgress sx={{ mt: 2, bgcolor: 'rgba(16,185,129,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />
        )}

        {backupLogs.length > 0 && <TerminalLog lines={backupLogs} />}

        {backupResult && (
          <Alert
            icon={backupResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
            severity={backupResult.success ? 'success' : 'error'}
            sx={{ mt: 1.5 }}
          >
            {backupResult.success
              ? `Backup complete: ${backupResult.filename} (${backupResult.size_human})`
              : `Backup failed: ${backupResult.error}`}
          </Alert>
        )}
      </Paper>

      {/* Backup List */}
      <Paper sx={{ ...sx.card, mt: 2 }} elevation={0}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography sx={sx.label}>Backups on Google Drive ({backups.length})</Typography>
          {loadingList && <CircularProgress size={16} sx={{ color: '#10b981' }} />}
        </Stack>

        {backups.length === 0 && !loadingList ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <CloudDoneIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No backups found on Google Drive.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.06)' }}>File</TableCell>
                  <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.06)', width: 180 }}>Created</TableCell>
                  <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.06)', width: 120 }}>Size</TableCell>
                  <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 1, borderColor: 'rgba(255,255,255,0.06)', width: 80 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {backups.map((b, i) => (
                  <TableRow key={b.filename} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                    <TableCell sx={{ py: 1.5, borderColor: 'rgba(255,255,255,0.04)' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.primary', fontWeight: 600 }}>
                          {b.filename}
                        </Typography>
                        {i === 0 && (
                          <Chip label="latest" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 10, height: 18, fontWeight: 700 }} />
                        )}
                      </Stack>
                      <SizeBar sizeBytes={b.size_bytes} maxBytes={maxSize} />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, borderColor: 'rgba(255,255,255,0.04)' }}>
                      <Typography variant="body2" sx={{ fontSize: 12, color: 'text.primary' }}>{parseDate(b.created_at)}</Typography>
                      <Typography variant="caption" color="text.disabled">{relativeTime(b.created_at)}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, borderColor: 'rgba(255,255,255,0.04)' }}>
                      <Chip label={b.size_human} size="small"
                        sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 11, height: 20, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, borderColor: 'rgba(255,255,255,0.04)' }}>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Restore this backup">
                          <IconButton size="small" onClick={() => { setRestoreTarget(b.filename); setRestoreLogs([]); setRestoreResult(null); }}
                            sx={{ color: '#f59e0b', '&:hover': { bgcolor: 'rgba(245,158,11,0.1)' } }}>
                            <RestoreIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete backup">
                          <IconButton size="small" onClick={() => setDeleteTarget(b.filename)}
                            sx={{ color: 'text.disabled', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Restore Modal ─────────────────────────────────────────────────── */}
      <Dialog open={!!restoreTarget} onClose={() => !restoreRunning && setRestoreTarget(null)}
        PaperProps={{ sx: { bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, minWidth: 480 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <WarningAmberIcon sx={{ color: '#f59e0b' }} />
            <Typography fontWeight={700}>Confirm Restore</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will overwrite the current database with the selected backup. This action cannot be undone.
          </Alert>
          <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1.5, p: 1.5 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#10b981' }}>{restoreTarget}</Typography>
          </Paper>
          {restoreRunning && (
            <LinearProgress sx={{ mt: 2, bgcolor: 'rgba(245,158,11,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#f59e0b' } }} />
          )}
          {restoreLogs.length > 0 && <TerminalLog lines={restoreLogs} />}
          {restoreResult && (
            <Alert severity={restoreResult.success ? 'success' : 'error'} sx={{ mt: 1.5 }}>
              {restoreResult.success ? 'Restore completed successfully.' : `Restore failed: ${restoreResult.error}`}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRestoreTarget(null)} disabled={restoreRunning}
            sx={{ color: 'text.secondary' }}>Cancel</Button>
          {!restoreResult && (
            <Button
              variant="contained"
              startIcon={restoreRunning ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <RestoreIcon />}
              onClick={confirmRestore}
              disabled={restoreRunning}
              sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' }, fontWeight: 600 }}
            >
              {restoreRunning ? 'Restoring…' : 'Yes, Restore'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Delete Modal ──────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, minWidth: 420 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <DeleteOutlineIcon sx={{ color: '#ef4444' }} />
            <Typography fontWeight={700}>Delete Backup</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Permanently delete this backup from Google Drive?
          </Typography>
          <Paper sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1.5, p: 1.5 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: '#ef4444' }}>{deleteTarget}</Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" startIcon={deleteRunning ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <DeleteOutlineIcon />}
            onClick={confirmDelete} disabled={deleteRunning}
            sx={{ bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, fontWeight: 600 }}>
            {deleteRunning ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
