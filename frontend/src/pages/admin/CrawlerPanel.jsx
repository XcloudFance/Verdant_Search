import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Drawer, CircularProgress,
  Tooltip, Divider, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  LinkOff as DeadIcon,
  DeleteSweep as ClearIcon,
  Circle as DotIcon,
} from '@mui/icons-material';

import { PYTHON_API } from '../../config';

const SURF   = '#0d0d1a';
const BORDER = 'rgba(255,255,255,0.07)';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <Typography sx={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.12em', color: '#475569',
    }}>
      {children}
    </Typography>
  );
}

function KpiTile({ label, value, accent, sub }) {
  return (
    <Paper sx={{
      px: 3, py: 3.5,
      bgcolor: SURF,
      border: `1px solid ${BORDER}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: '4px',
      height: '100%',
    }}>
      <Label>{label}</Label>
      <Typography sx={{
        fontSize: 36, fontWeight: 700, lineHeight: 1.1, mt: 1.5, mb: 0.75,
        color: '#e2e8f0', fontVariantNumeric: 'tabular-nums',
      }}>
        {value ?? '—'}
      </Typography>
      <Typography sx={{ fontSize: 12, color: '#475569', minHeight: 16 }}>{sub ?? ' '}</Typography>
    </Paper>
  );
}

// ── Worker status badge ───────────────────────────────────────────────────────

const STATUS_COLOR = {
  ACTIVE:   '#10b981',
  DEGRADED: '#f59e0b',
  DEAD:     '#ef4444',
  IDLE:     '#334155',
};

function StatusBadge({ status }) {
  const color  = STATUS_COLOR[status] || STATUS_COLOR.IDLE;
  const pulse  = status === 'ACTIVE';
  const flash  = status === 'DEAD';
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{
        width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0,
        animation: pulse ? 'wpulse 2.4s ease-in-out infinite'
                 : flash ? 'wflash 1s ease-in-out infinite'
                 : 'none',
        '@keyframes wpulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
        '@keyframes wflash': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.1 } },
      }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {status || 'UNKNOWN'}
      </Typography>
    </Stack>
  );
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({ title, action, children }) {
  return (
    <Paper sx={{ bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px', overflow: 'hidden' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"
        sx={{ px: 3, py: 2, borderBottom: `1px solid ${BORDER}` }}>
        <Label>{title}</Label>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CrawlerPanel() {
  const [stats,       setStats]       = useState(null);
  const [workers,     setWorkers]     = useState([]);
  const [queue,       setQueue]       = useState({ tasks: [], total: 0 });
  const [jobs,        setJobs]        = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading,     setLoading]     = useState(true);

  // Add-URLs drawer
  const [addDrawer, setAddDrawer] = useState(false);
  const [urlInput,  setUrlInput]  = useState('');
  const [addStatus, setAddStatus] = useState(null); // { ok, message }

  // Logs drawer
  const [logsDrawer, setLogsDrawer] = useState({ open: false, worker: null, logs: [], loading: false });

  // Confirm dialogs
  const [clearConfirm,  setClearConfirm]  = useState(false);
  const [deregConfirm,  setDeregConfirm]  = useState({ open: false, workerId: null });

  // ── Fetch all data ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    const [statsR, workersR, queueR, jobsR] = await Promise.allSettled([
      fetch(`${PYTHON_API}/api/v1/admin/crawler/stats`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/v1/admin/crawler/workers`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/v1/admin/crawler/queue/pending?limit=100`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/v1/admin/crawler/jobs`).then(r => r.json()),
    ]);

    if (statsR.status   === 'fulfilled') setStats(statsR.value);
    if (workersR.status === 'fulfilled') setWorkers(workersR.value?.workers || []);
    if (queueR.status   === 'fulfilled') setQueue(queueR.value || { tasks: [], total: 0 });
    if (jobsR.status    === 'fulfilled') setJobs(jobsR.value?.jobs || []);

    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 8000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  // ── Add URLs ────────────────────────────────────────────────────────────────

  const handleAddUrls = async () => {
    const urls = urlInput.split('\n').map(s => s.trim()).filter(Boolean);
    if (!urls.length) return;
    try {
      const res = await fetch(`${PYTHON_API}/api/v1/admin/crawler/queue/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      setAddStatus({ ok: true, message: `Added ${data.added} URLs. Queue: ${data.total}` });
      setUrlInput('');
      fetchAll();
    } catch (e) {
      setAddStatus({ ok: false, message: `Error: ${e.message}` });
    }
  };

  // ── Clear queue ─────────────────────────────────────────────────────────────

  const handleClearQueue = async () => {
    setClearConfirm(false);
    await fetch(`${PYTHON_API}/api/v1/admin/crawler/queue/clear`, { method: 'DELETE' });
    fetchAll();
  };

  // ── Deregister worker ───────────────────────────────────────────────────────

  const handleDeregister = async (workerId) => {
    setDeregConfirm({ open: false, workerId: null });
    await fetch(`${PYTHON_API}/api/v1/admin/crawler/workers/${workerId}`, { method: 'DELETE' });
    fetchAll();
  };

  // ── View logs ───────────────────────────────────────────────────────────────

  const openLogs = async (worker) => {
    setLogsDrawer({ open: true, worker, logs: [], loading: true });
    try {
      const res  = await fetch(`${PYTHON_API}/api/v1/admin/crawler/logs/${worker.id}`);
      const data = await res.json();
      setLogsDrawer(prev => ({ ...prev, logs: data?.logs || [], loading: false }));
    } catch {
      setLogsDrawer(prev => ({ ...prev, logs: [], loading: false }));
    }
  };

  const fmt  = v => v != null ? Number(v).toLocaleString() : '—';
  const fmtD = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  };
  const shortId = id => id ? `${id.slice(0, 8)}…` : '—';

  // ── KPI tiles ───────────────────────────────────────────────────────────────

  const kpis = [
    {
      label: 'Queue Pending', value: fmt(stats?.queue_pending ?? queue.total),
      accent: '#f59e0b', sub: 'URLs waiting to crawl',
    },
    {
      label: 'Active Workers', value: fmt(stats?.active_workers),
      accent: '#10b981', sub: `of ${fmt(stats?.total_workers)} registered`,
    },
    {
      label: 'Pages Crawled', value: fmt(stats?.total_jobs_completed),
      accent: '#3b82f6', sub: `${fmt(stats?.total_jobs_failed)} failed`,
    },
    {
      label: 'Avg Pages / min', value: stats?.avg_pages_per_min != null
        ? Number(stats.avg_pages_per_min).toFixed(1) : '—',
      accent: '#a855f7', sub: 'across active workers',
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>
            Crawler Management
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.75 }}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · auto-refresh 8s` : 'Loading…'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<AddIcon />}
            onClick={() => { setAddDrawer(true); setAddStatus(null); }}
            variant="contained" size="small"
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, fontSize: 12 }}
          >
            Add URLs
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchAll}
            variant="outlined" size="small"
            sx={{ borderColor: BORDER, color: '#475569', fontSize: 12 }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* KPI strip */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 3 }}>
        {kpis.map(k => <KpiTile key={k.label} {...k} />)}
      </Box>

      {/* Worker Fleet */}
      <Box mb={3}>
        <Panel
          title={`Worker Fleet (${workers.length})`}
          action={
            <Typography sx={{ fontSize: 11, color: '#334155' }}>
              Refreshes every 8 s
            </Typography>
          }
        >
          {loading ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <CircularProgress size={28} sx={{ color: '#10b981' }} />
            </Box>
          ) : workers.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <DeadIcon sx={{ fontSize: 40, color: '#1e293b', mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: '#334155' }}>
                No workers registered
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#1e293b', mt: 0.5 }}>
                Start the crawler: <code style={{ color: '#475569' }}>cd backend/crawler && bash start_crawler.sh</code>
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': {
                    bgcolor: 'rgba(255,255,255,0.02)',
                    fontWeight: 700, fontSize: 11,
                    color: '#334155', py: 1.5,
                    borderColor: BORDER,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}}>
                    <TableCell>Worker ID</TableCell>
                    <TableCell>Host / IP</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Current URL</TableCell>
                    <TableCell align="right">Done</TableCell>
                    <TableCell align="right">Failed</TableCell>
                    <TableCell align="right">p/min</TableCell>
                    <TableCell>Last Beat</TableCell>
                    <TableCell>Capabilities</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workers.map((w, i) => {
                    const liveStatus = w.live_status || w.status || 'IDLE';
                    const ppm = w.live_pages_per_min ?? w.pages_per_min;
                    return (
                      <TableRow key={w.id || i} sx={{
                        '& td': { borderColor: BORDER, fontSize: 12, py: 1.25 },
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.015)' },
                      }}>
                        {/* Worker ID */}
                        <TableCell>
                          <Stack>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: 11, color: '#10b981' }}>
                              {shortId(w.id)}
                            </Typography>
                            {w._unregistered && (
                              <Chip label="Redis only" size="small" sx={{
                                fontSize: 9, height: 14, bgcolor: 'rgba(245,158,11,0.15)',
                                color: '#f59e0b', mt: 0.25,
                              }} />
                            )}
                          </Stack>
                        </TableCell>

                        {/* Host / IP */}
                        <TableCell>
                          <Typography sx={{ fontSize: 12, color: '#cbd5e1' }}>
                            {w.hostname || '—'}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                            {w.ip_address || ''}
                          </Typography>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <StatusBadge status={liveStatus} />
                          {w.heartbeat_ttl > 0 && (
                            <Typography sx={{ fontSize: 10, color: '#334155', mt: 0.25 }}>
                              TTL {w.heartbeat_ttl}s
                            </Typography>
                          )}
                        </TableCell>

                        {/* Current URL */}
                        <TableCell sx={{ maxWidth: 200 }}>
                          {w.current_url ? (
                            <Tooltip title={w.current_url}>
                              <Typography sx={{
                                fontSize: 11, color: '#64748b', fontFamily: 'monospace',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: 190,
                              }}>
                                {w.current_url}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography sx={{ fontSize: 11, color: '#1e293b' }}>idle</Typography>
                          )}
                        </TableCell>

                        {/* Counters */}
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 12, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(w.live_jobs_completed ?? w.jobs_completed)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{
                            fontSize: 12,
                            color: (w.jobs_failed > 0) ? '#ef4444' : '#475569',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {fmt(w.jobs_failed)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 12, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                            {ppm != null ? Number(ppm).toFixed(1) : '—'}
                          </Typography>
                        </TableCell>

                        {/* Last heartbeat */}
                        <TableCell>
                          <Typography sx={{ fontSize: 11, color: '#475569' }}>
                            {fmtD(w.last_heartbeat_at)}
                          </Typography>
                        </TableCell>

                        {/* Capabilities */}
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {(w.capabilities || []).map(cap => (
                              <Chip key={cap} label={cap} size="small" sx={{
                                fontSize: 9, height: 16,
                                bgcolor: 'rgba(59,130,246,0.12)', color: '#60a5fa',
                              }} />
                            ))}
                          </Stack>
                        </TableCell>

                        {/* Actions */}
                        <TableCell align="center">
                          <Stack direction="row" justifyContent="center" spacing={0.5}>
                            <Tooltip title="View crawl logs">
                              <IconButton size="small" onClick={() => openLogs(w)}
                                sx={{ color: '#475569', '&:hover': { color: '#10b981' } }}>
                                <ViewIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            {!w._unregistered && (
                              <Tooltip title="Deregister worker">
                                <IconButton size="small"
                                  onClick={() => setDeregConfirm({ open: true, workerId: w.id })}
                                  sx={{ color: '#475569', '&:hover': { color: '#ef4444' } }}>
                                  <DeleteIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Panel>
      </Box>

      {/* Queue */}
      <Box mb={3}>
        <Panel
          title={`Pending Queue (${fmt(queue.total)} URLs)`}
          action={
            <Button
              startIcon={<ClearIcon />}
              onClick={() => setClearConfirm(true)}
              size="small"
              disabled={queue.total === 0}
              sx={{ fontSize: 11, color: '#ef4444', minWidth: 0,
                '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' } }}
            >
              Clear Queue
            </Button>
          }
        >
          {queue.total === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: '#334155' }}>
                Queue is empty
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#1e293b', mt: 0.5 }}>
                Click <strong style={{ color: '#10b981' }}>Add URLs</strong> to seed the crawler
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': {
                      bgcolor: 'rgba(255,255,255,0.02)', fontSize: 11, fontWeight: 700,
                      color: '#334155', borderColor: BORDER, py: 1,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}}>
                      <TableCell>#</TableCell>
                      <TableCell>URL</TableCell>
                      <TableCell align="right">Depth</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {queue.tasks.map((task, i) => (
                      <TableRow key={i} sx={{
                        '& td': { borderColor: BORDER, fontSize: 12, py: 1 },
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.015)' },
                      }}>
                        <TableCell>
                          <Typography sx={{ fontSize: 11, color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                            {i + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{
                            fontSize: 12, color: '#94a3b8', fontFamily: 'monospace',
                            wordBreak: 'break-all',
                          }}>
                            {task.url}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontSize: 11, color: '#475569' }}>
                            {task.depth ?? 0}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              {queue.total > queue.tasks.length && (
                <Box sx={{ px: 3, py: 1.5, borderTop: `1px solid ${BORDER}` }}>
                  <Typography sx={{ fontSize: 11, color: '#334155' }}>
                    Showing {queue.tasks.length} of {fmt(queue.total)} pending URLs
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Panel>
      </Box>

      {/* Crawl Jobs */}
      <Box mb={3}>
        <Panel title={`Crawl Jobs (${jobs.length})`}>
          {jobs.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: '#334155' }}>No crawl jobs</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': {
                    bgcolor: 'rgba(255,255,255,0.02)', fontSize: 11, fontWeight: 700,
                    color: '#334155', borderColor: BORDER, py: 1.5,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}}>
                    <TableCell>ID</TableCell>
                    <TableCell>Seed URL</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Depth</TableCell>
                    <TableCell align="right">Max Pages</TableCell>
                    <TableCell>Frequency</TableCell>
                    <TableCell>Created</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobs.map((job, i) => {
                    const statusColor = job.status === 'running' ? '#10b981'
                      : job.status === 'failed' ? '#ef4444' : '#475569';
                    return (
                      <TableRow key={job.id || i} sx={{
                        '& td': { borderColor: BORDER, fontSize: 12, py: 1.25 },
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.015)' },
                      }}>
                        <TableCell>
                          <Typography sx={{ fontFamily: 'monospace', fontSize: 11, color: '#3b82f6' }}>
                            #{job.id}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>
                          <Tooltip title={job.seed_url || ''}>
                            <Typography sx={{
                              fontSize: 12, color: '#94a3b8', fontFamily: 'monospace',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              maxWidth: 250,
                            }}>
                              {job.seed_url || '—'}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Chip label={job.status || 'pending'} size="small" sx={{
                            fontSize: 10, height: 18,
                            bgcolor: `${statusColor}22`,
                            color: statusColor,
                            fontWeight: 700,
                          }} />
                        </TableCell>
                        <TableCell align="right">{job.max_depth ?? '—'}</TableCell>
                        <TableCell align="right">{fmt(job.max_pages)}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 11, color: '#475569' }}>
                            {job.crawl_frequency || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 11, color: '#334155' }}>
                            {fmtD(job.created_at)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Panel>
      </Box>

      {/* ── Add URLs Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={addDrawer}
        onClose={() => setAddDrawer(false)}
        PaperProps={{ sx: { width: 480, bgcolor: SURF, borderLeft: `1px solid ${BORDER}` } }}
      >
        <Box sx={{ px: 3.5, py: 3, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
            Add URLs to Queue
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.5 }}>
            One URL per line. URLs are pushed to Redis and picked up by workers.
          </Typography>
        </Box>

        <Box sx={{ px: 3.5, py: 3, flex: 1 }}>
          {addStatus && (
            <Alert
              severity={addStatus.ok ? 'success' : 'error'}
              sx={{ mb: 2, fontSize: 12 }}
              onClose={() => setAddStatus(null)}
            >
              {addStatus.message}
            </Alert>
          )}
          <TextField
            multiline
            rows={14}
            fullWidth
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder={'https://example.com/\nhttps://docs.example.com/\nhttps://blog.example.com/'}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: '#060612',
                fontSize: 12,
                fontFamily: 'monospace',
                '& fieldset': { borderColor: BORDER },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                '&.Mui-focused fieldset': { borderColor: '#10b981' },
              },
              '& textarea': { color: '#94a3b8' },
            }}
          />

          <Stack direction="row" spacing={1.5} mt={2.5}>
            <Button
              variant="contained" fullWidth
              onClick={handleAddUrls}
              disabled={!urlInput.trim()}
              sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, fontSize: 13 }}
            >
              Push to Queue
            </Button>
            <Button
              variant="outlined" fullWidth
              onClick={() => setAddDrawer(false)}
              sx={{ borderColor: BORDER, color: '#475569', fontSize: 13 }}
            >
              Cancel
            </Button>
          </Stack>

          <Box mt={3} sx={{ bgcolor: '#060612', border: `1px solid ${BORDER}`, borderRadius: '4px', p: 2 }}>
            <Label>Queue status</Label>
            <Stack direction="row" spacing={4} mt={1.5}>
              <Box>
                <Typography sx={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pending</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(queue.total)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Workers</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(stats?.active_workers)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Drawer>

      {/* ── Logs Drawer ─────────────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={logsDrawer.open}
        onClose={() => setLogsDrawer(prev => ({ ...prev, open: false }))}
        PaperProps={{ sx: { width: 560, bgcolor: SURF, borderLeft: `1px solid ${BORDER}` } }}
      >
        <Box sx={{ px: 3, py: 2.5, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
            Crawl Logs
          </Typography>
          {logsDrawer.worker && (
            <Typography sx={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', mt: 0.5 }}>
              {logsDrawer.worker.hostname} · {logsDrawer.worker.id}
            </Typography>
          )}
        </Box>

        <Box sx={{ p: 2, overflow: 'auto', height: 'calc(100vh - 90px)' }}>
          {logsDrawer.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 5 }}>
              <CircularProgress size={28} sx={{ color: '#10b981' }} />
            </Box>
          ) : logsDrawer.logs.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: '#334155', textAlign: 'center', pt: 5 }}>
              No logs yet for this worker
            </Typography>
          ) : (
            <Stack spacing={1}>
              {logsDrawer.logs.map((log, i) => {
                const code = log.status_code || log.http_status;
                const ok   = code >= 200 && code < 400;
                return (
                  <Paper key={i} sx={{
                    p: 1.5, bgcolor: '#060612',
                    border: `1px solid ${BORDER}`, borderRadius: '4px',
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
                      <Typography sx={{
                        fontSize: 11, color: '#64748b', fontFamily: 'monospace',
                        wordBreak: 'break-all', flex: 1, pr: 1,
                      }}>
                        {log.url || '—'}
                      </Typography>
                      <Chip label={code || '—'} size="small" sx={{
                        fontSize: 10, height: 18, flexShrink: 0,
                        bgcolor: ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color:   ok ? '#10b981' : '#ef4444',
                        fontWeight: 700,
                      }} />
                    </Stack>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      {[
                        ['Words', log.word_count],
                        ['Images', log.image_count],
                        ['Depth', log.depth],
                        ['Latency', log.latency_ms ? `${log.latency_ms}ms` : null],
                      ].map(([lbl, val]) => (
                        <Typography key={lbl} sx={{ fontSize: 11, color: '#334155' }}>
                          {lbl}: <span style={{ color: '#475569' }}>{val ?? '—'}</span>
                        </Typography>
                      ))}
                    </Stack>
                    <Typography sx={{ fontSize: 10, color: '#1e293b', mt: 0.5 }}>
                      {fmtD(log.crawled_at)}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>
      </Drawer>

      {/* ── Clear queue confirm ──────────────────────────────────────────────── */}
      <Dialog open={clearConfirm} onClose={() => setClearConfirm(false)}
        PaperProps={{ sx: { bgcolor: SURF, border: `1px solid ${BORDER}` } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>Clear Pending Queue</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
            This will delete all {fmt(queue.total)} pending URLs from the queue.
            Workers currently processing will finish their current page.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setClearConfirm(false)} sx={{ color: '#475569' }}>Cancel</Button>
          <Button onClick={handleClearQueue}
            sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
            Clear Queue
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Deregister confirm ───────────────────────────────────────────────── */}
      <Dialog open={deregConfirm.open} onClose={() => setDeregConfirm({ open: false, workerId: null })}
        PaperProps={{ sx: { bgcolor: SURF, border: `1px solid ${BORDER}` } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>Deregister Worker</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
            Mark this worker as deregistered. It will be hidden from the fleet table.
            The worker process itself is not stopped.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeregConfirm({ open: false, workerId: null })} sx={{ color: '#475569' }}>
            Cancel
          </Button>
          <Button onClick={() => handleDeregister(deregConfirm.workerId)}
            sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
            Deregister
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
