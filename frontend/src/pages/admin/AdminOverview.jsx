import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  LinearProgress, Divider, CircularProgress, Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Search as SearchIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Hub as HubIcon,
  TrendingUp as TrendingIcon,
  HealthAndSafety as HealthIcon,
  BugReport as BugIcon,
  Bolt as BoltIcon,
} from '@mui/icons-material';

import { PYTHON_API, GO_API } from '../../config';

const SURF   = '#0d0d1a';
const SURF2  = '#060612';
const BORDER = 'rgba(255,255,255,0.07)';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function Panel({ title, icon, action, children, accent }) {
  return (
    <Paper sx={{ bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px', overflow: 'hidden', height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"
        sx={{ px: 3, py: 2, borderBottom: `1px solid ${BORDER}`,
          ...(accent ? { borderLeft: `3px solid ${accent}` } : {}) }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          {icon && React.cloneElement(icon, { sx: { fontSize: 15, color: accent || '#475569' } })}
          <Label>{title}</Label>
        </Stack>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function KpiTile({ label, value, accent, sub, icon }) {
  return (
    <Paper sx={{
      px: 3, py: 3,
      bgcolor: SURF,
      border: `1px solid ${BORDER}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: '4px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* ghost icon */}
      {icon && React.cloneElement(icon, {
        sx: {
          position: 'absolute', right: 14, top: 14,
          fontSize: 32, color: accent, opacity: 0.07,
          pointerEvents: 'none',
        },
      })}
      <Label>{label}</Label>
      <Typography sx={{
        fontSize: 34, fontWeight: 700, lineHeight: 1.1, mt: 1.25, mb: 0.5,
        color: '#e2e8f0', fontVariantNumeric: 'tabular-nums',
      }}>
        {value ?? '—'}
      </Typography>
      <Typography sx={{ fontSize: 11, color: '#475569', minHeight: 15 }}>{sub ?? ' '}</Typography>
    </Paper>
  );
}

function ServiceDot({ label, status }) {
  const color = status === 'up' ? '#10b981' : status === 'down' ? '#ef4444' : '#334155';
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{
        width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0,
        ...(status === 'up' ? {
          animation: 'spulse 2.4s ease-in-out infinite',
          '@keyframes spulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
        } : {}),
      }} />
      <Typography sx={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{label}</Typography>
    </Stack>
  );
}

function HealthBar({ label, value, color, max = 100 }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : null;
  const displayColor = value > 85 ? '#ef4444' : value > 65 ? '#f59e0b' : color;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
        <Typography sx={{ fontSize: 12, color: '#64748b' }}>{label}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: displayColor, fontVariantNumeric: 'tabular-nums' }}>
          {pct != null ? `${Number(value).toFixed(0)}%` : '—'}
        </Typography>
      </Stack>
      <LinearProgress
        variant={pct != null ? 'determinate' : 'indeterminate'}
        value={pct ?? 0}
        sx={{
          height: 4, borderRadius: 2,
          bgcolor: 'rgba(255,255,255,0.05)',
          '& .MuiLinearProgress-bar': { bgcolor: displayColor, borderRadius: 2 },
        }}
      />
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminOverview() {
  const [indexStats,    setIndexStats]    = useState(null);
  const [crawlerStats,  setCrawlerStats]  = useState(null);
  const [analyticsStats,setAnalyticsStats]= useState(null);
  const [rerankerStatus,setRerankerStatus]= useState(null);
  const [health,        setHealth]        = useState(null);
  const [topKeywords,   setTopKeywords]   = useState([]);
  const [recentSearches,setRecentSearches]= useState([]);
  const [svcStatus,     setSvcStatus]     = useState({ go:'unknown', python:'unknown', redis:'unknown', pg:'unknown' });
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [loading,       setLoading]       = useState(true);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      fetch(`${PYTHON_API}/api/v1/admin/index/overview`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/v1/admin/crawler/stats`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/dashboard-stats`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/v1/admin/reranker/status`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/system-health-full`).then(r => r.json()),
      fetch(`${GO_API}/health`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/top-keywords?limit=15`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/recent-searches?limit=12`).then(r => r.json()),
    ]).then(([idx, craw, ana, rer, hlth, go, kw, recent]) => {
      const pgOk    = idx.status    === 'fulfilled';
      const pyOk    = ana.status    === 'fulfilled';
      const goOk    = go.status     === 'fulfilled';
      const hlthData = hlth.status  === 'fulfilled' ? hlth.value : null;
      const redisOk  = hlthData?.redis?.status === 'healthy';

      if (pgOk)                   setIndexStats(idx.value);
      if (craw.status === 'fulfilled') setCrawlerStats(craw.value);
      if (pyOk)                   setAnalyticsStats(ana.value);
      if (rer.status  === 'fulfilled') setRerankerStatus(rer.value);
      if (hlthData)               setHealth(hlthData);

      // top keywords
      if (kw.status === 'fulfilled') {
        const data = kw.value;
        setTopKeywords(Array.isArray(data) ? data : (data?.keywords || data?.top_keywords || []));
      }
      // recent searches
      if (recent.status === 'fulfilled') {
        const data = recent.value;
        setRecentSearches(Array.isArray(data) ? data : (data?.searches || data?.recent || []));
      }

      setSvcStatus({
        go:     goOk    ? 'up' : 'down',
        python: pyOk    ? 'up' : 'down',
        redis:  redisOk ? 'up' : hlthData ? 'down' : 'unknown',
        pg:     pgOk    ? 'up' : 'down',
      });

      setLastUpdated(new Date());
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmt  = v => v != null ? Number(v).toLocaleString() : null;
  const fmtF = (v, d = 1) => v != null ? Number(v).toFixed(d) : null;

  const cpuPct = health?.cpu_percent;
  const memPct = health?.memory?.percent;
  const gpuPct = health?.gpu_percent;

  const kpis = [
    {
      label: 'Documents',
      value: fmt(indexStats?.total_documents),
      accent: '#10b981',
      sub: indexStats?.total_embeddings != null ? `${fmt(indexStats.total_embeddings)} embeddings` : ' ',
      icon: <StorageIcon />,
    },
    {
      label: 'Unique Terms',
      value: fmt(indexStats?.total_terms),
      accent: '#3b82f6',
      sub: indexStats?.total_postings != null ? `${fmt(indexStats.total_postings)} postings` : ' ',
      icon: <HubIcon />,
    },
    {
      label: 'Total Searches',
      value: fmt(analyticsStats?.total_searches),
      accent: '#06b6d4',
      sub: analyticsStats?.unique_queries != null ? `${fmt(analyticsStats.unique_queries)} unique queries` : ' ',
      icon: <SearchIcon />,
    },
    {
      label: 'Active Workers',
      value: crawlerStats?.active_workers != null
        ? `${crawlerStats.active_workers} / ${crawlerStats.total_workers ?? '?'}`
        : null,
      accent: '#f59e0b',
      sub: crawlerStats?.total_jobs_completed != null
        ? `${fmt(crawlerStats.total_jobs_completed)} jobs done` : ' ',
      icon: <SpeedIcon />,
    },
    {
      label: 'Zero Results',
      value: fmt(analyticsStats?.zero_result_queries),
      accent: '#ef4444',
      sub: analyticsStats?.total_searches
        ? `${((analyticsStats.zero_result_queries / analyticsStats.total_searches) * 100).toFixed(1)}% of searches`
        : ' ',
      icon: <BugIcon />,
    },
    {
      label: 'Reranker',
      value: rerankerStatus == null ? '…'
        : rerankerStatus?.available ? 'Online' : 'Offline',
      accent: rerankerStatus?.available ? '#10b981'
        : rerankerStatus == null ? '#334155' : '#ef4444',
      sub: rerankerStatus?.model ?? ' ',
      icon: <BoltIcon />,
    },
  ];

  // Decide main table content
  const hasKeywords = topKeywords.length > 0;
  const hasRecent   = recentSearches.length > 0;

  return (
    <Box>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>
            System Overview
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.75 }}>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : 'Loading…'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          {/* Service status strip */}
          <Paper sx={{
            display: 'flex', alignItems: 'center', gap: 2.5,
            px: 2.5, py: 1.5,
            bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px',
          }}>
            <ServiceDot label="Go"         status={svcStatus.go}     />
            <ServiceDot label="Python"     status={svcStatus.python}  />
            <ServiceDot label="Redis"      status={svcStatus.redis}   />
            <ServiceDot label="PostgreSQL" status={svcStatus.pg}      />
          </Paper>

          <Button
            startIcon={loading ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <RefreshIcon />}
            onClick={fetchAll}
            disabled={loading}
            variant="outlined" size="small"
            sx={{ borderColor: BORDER, color: '#475569', fontSize: 12, '&:hover': { borderColor: '#475569' } }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* ── KPI grid — 3 × 2 ────────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, mb: 3 }}>
        {kpis.map(k => <KpiTile key={k.label} {...k} />)}
      </Box>

      {/* ── Main content — 2 columns ─────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 2, mb: 2 }}>

        {/* Left: query activity table */}
        <Panel
          title={hasKeywords ? 'Top Search Queries' : hasRecent ? 'Recent Searches' : 'Search Activity'}
          icon={<TrendingIcon />}
          accent="#06b6d4"
          action={
            <Typography sx={{ fontSize: 11, color: '#334155' }}>
              {analyticsStats?.total_searches != null
                ? `${fmt(analyticsStats.total_searches)} total`
                : ''}
            </Typography>
          }
        >
          {loading ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <CircularProgress size={26} sx={{ color: '#06b6d4' }} />
            </Box>
          ) : !hasKeywords && !hasRecent ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <SearchIcon sx={{ fontSize: 38, color: '#1e293b', mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: '#334155' }}>No search data yet</Typography>
              <Typography sx={{ fontSize: 12, color: '#1e293b', mt: 0.5 }}>
                Queries will appear here once users start searching
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': {
                    bgcolor: 'rgba(255,255,255,0.02)', fontWeight: 700, fontSize: 11,
                    color: '#334155', py: 1.5, borderColor: BORDER,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}}>
                    <TableCell>#</TableCell>
                    <TableCell>Query</TableCell>
                    <TableCell align="right">Count</TableCell>
                    {hasKeywords && <TableCell align="right">Avg Results</TableCell>}
                    {hasRecent   && <TableCell>Time</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(hasKeywords ? topKeywords : recentSearches).map((row, i) => {
                    const query   = row.query   ?? row.keyword ?? row.term ?? row;
                    const count   = row.count   ?? row.frequency ?? null;
                    const avgRes  = row.avg_results ?? null;
                    const ts      = row.created_at ?? row.timestamp ?? null;
                    return (
                      <TableRow key={i} sx={{
                        '& td': { borderColor: BORDER, fontSize: 12, py: 1.25 },
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.015)' },
                      }}>
                        <TableCell>
                          <Typography sx={{ fontSize: 11, color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                            {i + 1}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontSize: 13, color: '#cbd5e1' }}>
                            {typeof query === 'string' ? query : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {count != null ? (
                            <Chip label={count} size="small" sx={{
                              fontSize: 11, height: 20, fontVariantNumeric: 'tabular-nums',
                              bgcolor: 'rgba(6,182,212,0.12)', color: '#06b6d4', fontWeight: 700,
                            }} />
                          ) : <Typography sx={{ fontSize: 11, color: '#334155' }}>—</Typography>}
                        </TableCell>
                        {hasKeywords && (
                          <TableCell align="right">
                            <Typography sx={{ fontSize: 12, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                              {avgRes != null ? Number(avgRes).toFixed(1) : '—'}
                            </Typography>
                          </TableCell>
                        )}
                        {hasRecent && (
                          <TableCell>
                            <Typography sx={{ fontSize: 11, color: '#334155' }}>
                              {ts ? new Date(ts).toLocaleString() : '—'}
                            </Typography>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Panel>

        {/* Right: system health */}
        <Panel title="System Health" icon={<HealthIcon />} accent="#a855f7">
          <Box sx={{ px: 3, py: 2.5 }}>
            {health ? (
              <Stack spacing={2.5}>
                <HealthBar label="CPU"    value={cpuPct} color="#3b82f6" />
                <HealthBar label="Memory" value={memPct} color="#10b981" />
                {gpuPct != null && (
                  <HealthBar label="GPU" value={gpuPct} color="#a855f7" />
                )}

                <Divider sx={{ borderColor: BORDER }} />

                {/* Memory detail */}
                {health.memory && (
                  <Box>
                    <Label>Memory Detail</Label>
                    <Stack spacing={0.75} mt={1.5}>
                      {[
                        ['Used',      health.memory.used_gb,      'GB', '#e2e8f0'],
                        ['Available', health.memory.available_gb, 'GB', '#475569'],
                        ['Total',     health.memory.total_gb,     'GB', '#334155'],
                      ].map(([lbl, val, unit, color]) => (
                        <Stack key={lbl} direction="row" justifyContent="space-between">
                          <Typography sx={{ fontSize: 12, color: '#475569' }}>{lbl}</Typography>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
                            {val != null ? `${Number(val).toFixed(1)} ${unit}` : '—'}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}

                <Divider sx={{ borderColor: BORDER }} />

                {/* Redis */}
                <Box>
                  <Label>Redis</Label>
                  <Stack spacing={0.75} mt={1.5}>
                    {[
                      ['Status',       health.redis?.status,       null,  health.redis?.status === 'healthy' ? '#10b981' : '#ef4444'],
                      ['Used Memory',  health.redis?.used_memory,  null,  '#cbd5e1'],
                      ['Cache Hits',   health.redis?.hits,         null,  '#3b82f6'],
                      ['Cache Misses', health.redis?.misses,       null,  '#475569'],
                    ].map(([lbl, val, unit, color]) => (
                      <Stack key={lbl} direction="row" justifyContent="space-between">
                        <Typography sx={{ fontSize: 12, color: '#475569' }}>{lbl}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: color || '#cbd5e1', fontVariantNumeric: 'tabular-nums' }}>
                          {val != null ? `${val}${unit ? ' ' + unit : ''}` : '—'}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Stack>
            ) : loading ? (
              <Box sx={{ textAlign: 'center', pt: 4 }}>
                <CircularProgress size={24} sx={{ color: '#a855f7' }} />
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', pt: 4 }}>
                <MemoryIcon sx={{ fontSize: 36, color: '#1e293b', mb: 1 }} />
                <Typography sx={{ fontSize: 12, color: '#334155' }}>
                  Health data unavailable
                </Typography>
              </Box>
            )}
          </Box>
        </Panel>

      </Box>

      {/* ── Bottom row — 3 panels ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>

        {/* Index */}
        <Panel title="Index" icon={<StorageIcon />} accent="#10b981">
          <Box sx={{ px: 3, py: 2 }}>
            <Stack spacing={0}>
              {[
                ['Documents',       fmt(indexStats?.total_documents),              '#10b981'],
                ['Embeddings',      fmt(indexStats?.total_embeddings),             null],
                ['Image Embeds',    fmt(indexStats?.total_image_embeddings),       null],
                ['Unique Terms',    fmt(indexStats?.total_terms),                  null],
                ['Postings',        fmt(indexStats?.total_postings),               null],
                ['Avg Doc Length',  indexStats?.avg_doc_length
                  ? `${fmtF(indexStats.avg_doc_length, 0)} tok` : null, null],
              ].map(([label, value, accent]) => (
                <Stack key={label} direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ py: 1.25, borderBottom: `1px solid ${BORDER}`, '&:last-child': { borderBottom: 'none' } }}>
                  <Typography sx={{ fontSize: 13, color: '#64748b' }}>{label}</Typography>
                  <Typography sx={{
                    fontSize: 13, fontWeight: 600,
                    color: accent || '#cbd5e1', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {value ?? '—'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Panel>

        {/* Crawler */}
        <Panel title="Crawler Fleet" icon={<SpeedIcon />} accent="#f59e0b">
          <Box sx={{ px: 3, py: 2 }}>
            <Stack spacing={0}>
              {[
                ['Total Workers',   fmt(crawlerStats?.total_workers),              null],
                ['Active Workers',  fmt(crawlerStats?.active_workers),             '#f59e0b'],
                ['Queue Pending',   fmt(crawlerStats?.queue_pending),              null],
                ['Jobs Completed',  fmt(crawlerStats?.total_jobs_completed),       null],
                ['Jobs Failed',     fmt(crawlerStats?.total_jobs_failed),
                  crawlerStats?.total_jobs_failed > 0 ? '#ef4444' : null],
                ['Avg Pages / min', crawlerStats?.avg_pages_per_min != null
                  ? Number(crawlerStats.avg_pages_per_min).toFixed(1) : null, null],
              ].map(([label, value, accent]) => (
                <Stack key={label} direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ py: 1.25, borderBottom: `1px solid ${BORDER}`, '&:last-child': { borderBottom: 'none' } }}>
                  <Typography sx={{ fontSize: 13, color: '#64748b' }}>{label}</Typography>
                  <Typography sx={{
                    fontSize: 13, fontWeight: 600,
                    color: accent || '#cbd5e1', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {value ?? '—'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Panel>

        {/* Search stats */}
        <Panel title="Search &amp; Generation" icon={<SearchIcon />} accent="#06b6d4">
          <Box sx={{ px: 3, py: 2 }}>
            <Stack spacing={0}>
              {[
                ['Total Searches',     fmt(analyticsStats?.total_searches),        null],
                ['Unique Queries',     fmt(analyticsStats?.unique_queries),        null],
                ['Avg Results / Query',analyticsStats?.avg_results_per_query != null
                  ? fmtF(analyticsStats.avg_results_per_query) : null, null],
                ['Zero-Result Queries',fmt(analyticsStats?.zero_result_queries),
                  analyticsStats?.zero_result_queries > 0 ? '#ef4444' : null],
                ['Reranker',           rerankerStatus == null ? '…'
                  : rerankerStatus?.available ? 'Online' : 'Offline',
                  rerankerStatus?.available ? '#10b981' : '#ef4444'],
                ['Model',              rerankerStatus?.model || rerankerStatus?.current_model || null, null],
              ].map(([label, value, accent]) => (
                <Stack key={label} direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ py: 1.25, borderBottom: `1px solid ${BORDER}`, '&:last-child': { borderBottom: 'none' } }}>
                  <Typography sx={{ fontSize: 13, color: '#64748b' }}>{label}</Typography>
                  <Typography sx={{
                    fontSize: 13, fontWeight: 600,
                    color: accent || '#cbd5e1', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {value ?? '—'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Panel>

      </Box>
    </Box>
  );
}
