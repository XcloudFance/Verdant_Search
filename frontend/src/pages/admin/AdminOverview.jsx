import React, { useEffect, useState, useCallback } from 'react';
import { Box, Grid, Paper, Typography, Stack, Divider } from '@mui/material';

import { PYTHON_API, GO_API } from '../../config';


const SURF = '#0d0d1a';
const BORDER = 'rgba(255,255,255,0.07)';

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

function ServiceDot({ label, status }) {
  const color = status === 'up' ? '#10b981' : status === 'down' ? '#ef4444' : '#334155';
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box sx={{
        width: 7, height: 7, borderRadius: '50%', bgcolor: color, flexShrink: 0,
        ...(status === 'up' ? {
          animation: 'spulse 2.4s ease-in-out infinite',
          '@keyframes spulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
        } : {}),
      }} />
      <Typography sx={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{label}</Typography>
    </Stack>
  );
}

function KpiTile({ label, value, accent, sub }) {
  return (
    <Paper sx={{
      px: 4, py: 5,
      bgcolor: SURF,
      border: `1px solid ${BORDER}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: '4px',
      height: '100%',
    }}>
      <Label>{label}</Label>
      <Typography sx={{
        fontSize: 42, fontWeight: 700, lineHeight: 1.05, mt: 2, mb: 1.25,
        color: '#e2e8f0', fontVariantNumeric: 'tabular-nums',
      }}>
        {value ?? '—'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#475569', minHeight: 18 }}>{sub ?? ' '}</Typography>
    </Paper>
  );
}

function DataRow({ label, value, accent }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5 }}>
      <Typography sx={{ fontSize: 14, color: '#64748b' }}>{label}</Typography>
      <Typography sx={{
        fontSize: 14, fontWeight: 600,
        color: accent || '#cbd5e1',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value ?? '—'}
      </Typography>
    </Stack>
  );
}

function Panel({ title, children }) {
  return (
    <Paper sx={{ px: 4, py: 4.5, bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px', height: '100%' }}>
      <Label>{title}</Label>
      <Divider sx={{ my: 2.5, borderColor: BORDER }} />
      <Stack spacing={0}>{children}</Stack>
    </Paper>
  );
}

export default function AdminOverview() {
  const [indexStats, setIndexStats] = useState(null);
  const [crawlerStats, setCrawlerStats] = useState(null);
  const [analyticsStats, setAnalyticsStats] = useState(null);
  const [rerankerStatus, setRerankerStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [svcStatus, setSvcStatus] = useState({ go: 'unknown', python: 'unknown', redis: 'unknown', pg: 'unknown' });
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAll = useCallback(() => {
    Promise.allSettled([
      fetch(`${PYTHON_API}/api/v1/admin/index/overview`).then(r => r.json()),       // [0]
      fetch(`${PYTHON_API}/api/v1/admin/crawler/stats`).then(r => r.json()),         // [1]
      fetch(`${PYTHON_API}/api/analytics/dashboard-stats`).then(r => r.json()),      // [2]
      fetch(`${PYTHON_API}/api/v1/admin/reranker/status`).then(r => r.json()),       // [3]
      fetch(`${PYTHON_API}/api/analytics/system-health-full`).then(r => r.json()),   // [4]
      fetch(`${GO_API}/health`).then(r => r.json()),                                 // [5]
    ]).then(([idx, craw, ana, rer, hlth, go]) => {
      const pgOk = idx.status === 'fulfilled';
      const pyOk = ana.status === 'fulfilled';
      const goOk = go.status === 'fulfilled';
      const hlthData = hlth.status === 'fulfilled' ? hlth.value : null;
      const redisOk = hlthData?.redis?.status === 'healthy';

      if (pgOk) setIndexStats(idx.value);
      if (craw.status === 'fulfilled') setCrawlerStats(craw.value);
      if (pyOk) setAnalyticsStats(ana.value);
      if (rer.status === 'fulfilled') setRerankerStatus(rer.value);
      if (hlthData) setHealth(hlthData);

      setSvcStatus({
        go:     goOk    ? 'up' : 'down',
        python: pyOk    ? 'up' : 'down',
        redis:  redisOk ? 'up' : hlthData ? 'down' : 'unknown',
        pg:     pgOk    ? 'up' : 'down',
      });

      setLastUpdated(new Date());
    });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmt  = (v) => v != null ? Number(v).toLocaleString() : null;
  const fmtF = (v, d = 1) => v != null ? Number(v).toFixed(d) : null;

  const cpuPct  = health?.cpu_percent;
  const memPct  = health?.memory?.percent;
  const gpuPct  = health?.gpu_percent;

  const kpiTiles = [
    { label: 'Documents',     value: fmt(indexStats?.total_documents),  accent: '#10b981',
      sub: indexStats?.total_embeddings != null ? `${fmt(indexStats.total_embeddings)} embeddings` : ' ' },
    { label: 'Unique Terms',  value: fmt(indexStats?.total_terms),       accent: '#3b82f6',
      sub: indexStats?.total_postings != null ? `${fmt(indexStats.total_postings)} postings` : ' ' },
    { label: 'Active Workers',
      value: crawlerStats?.active_workers != null
        ? `${crawlerStats.active_workers} / ${crawlerStats.total_workers ?? '?'}`
        : null,
      accent: '#f59e0b',
      sub: crawlerStats?.total_jobs_completed != null ? `${fmt(crawlerStats.total_jobs_completed)} jobs done` : ' ' },
    { label: 'Total Searches', value: fmt(analyticsStats?.total_searches), accent: '#06b6d4',
      sub: analyticsStats?.unique_queries != null ? `${fmt(analyticsStats.unique_queries)} unique queries` : ' ' },
    { label: 'Zero Results',  value: fmt(analyticsStats?.zero_result_queries), accent: '#ef4444',
      sub: analyticsStats?.total_searches
        ? `${((analyticsStats.zero_result_queries / analyticsStats.total_searches) * 100).toFixed(1)}% of all searches`
        : ' ' },
    { label: 'Reranker',
      value: rerankerStatus == null ? '…' : rerankerStatus?.available ? 'Online' : 'Offline',
      accent: rerankerStatus?.available ? '#10b981' : rerankerStatus == null ? '#334155' : '#ef4444',
      sub: rerankerStatus?.model ?? ' ' },
  ];

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2 }}>
            System Overview
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.75 }}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
          </Typography>
        </Box>

        {/* Service status strip */}
        <Paper sx={{
          display: 'flex', alignItems: 'center', gap: 3,
          px: 3, py: 2,
          bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px',
        }}>
          <Label>Services</Label>
          <ServiceDot label="Go API"     status={svcStatus.go}     />
          <ServiceDot label="Python API" status={svcStatus.python}  />
          <ServiceDot label="Redis"      status={svcStatus.redis}   />
          <ServiceDot label="PostgreSQL" status={svcStatus.pg}      />
        </Paper>
      </Stack>

      {/* KPI tiles — 3 per row */}
      <Grid container spacing={2} mb={2.5}>
        {kpiTiles.map((tile) => (
          <Grid item xs={12} sm={6} md={4} key={tile.label}>
            <KpiTile {...tile} />
          </Grid>
        ))}
      </Grid>

      {/* Detail panels */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Panel title="Index Health">
            <DataRow label="Total Documents"   value={fmt(indexStats?.total_documents)}   accent="#10b981" />
            <DataRow label="Total Embeddings"  value={fmt(indexStats?.total_embeddings)}  />
            <DataRow label="Image Embeddings"  value={fmt(indexStats?.total_image_embeddings)} />
            <DataRow label="Unique Terms"      value={fmt(indexStats?.total_terms)}       />
            <DataRow label="Total Postings"    value={fmt(indexStats?.total_postings)}    />
            <DataRow label="Avg Doc Length"
              value={indexStats?.avg_doc_length ? `${fmtF(indexStats.avg_doc_length)} tokens` : null}
            />
          </Panel>
        </Grid>

        <Grid item xs={12} md={4}>
          <Panel title="Crawler Fleet">
            <DataRow label="Total Workers"   value={fmt(crawlerStats?.total_workers)}  />
            <DataRow label="Active Workers"  value={fmt(crawlerStats?.active_workers)} accent="#f59e0b" />
            <DataRow label="Jobs Completed"  value={fmt(crawlerStats?.total_jobs_completed)} />
            <DataRow label="Jobs Failed"
              value={fmt(crawlerStats?.total_jobs_failed)}
              accent={crawlerStats?.total_jobs_failed > 0 ? '#ef4444' : null}
            />
            <DataRow label="Avg Pages / min"
              value={crawlerStats?.avg_pages_per_min ? fmtF(crawlerStats.avg_pages_per_min) : null}
            />
            <DataRow label="Queue Pending"   value={fmt(crawlerStats?.queue_pending)} />
          </Panel>
        </Grid>

        <Grid item xs={12} md={4}>
          <Panel title="Search &amp; System">
            <DataRow label="Total Searches"      value={fmt(analyticsStats?.total_searches)} />
            <DataRow label="Unique Queries"       value={fmt(analyticsStats?.unique_queries)} />
            <DataRow label="Avg Results / Query"
              value={analyticsStats?.avg_results_per_query ? fmtF(analyticsStats.avg_results_per_query) : null}
            />
            <DataRow label="Zero-Result Queries"
              value={fmt(analyticsStats?.zero_result_queries)}
              accent={analyticsStats?.zero_result_queries > 0 ? '#ef4444' : null}
            />
            {health && <>
              <Divider sx={{ borderColor: BORDER }} />
              <DataRow label="CPU Usage"
                value={cpuPct != null ? `${fmtF(cpuPct, 0)}%` : null}
                accent={cpuPct > 80 ? '#ef4444' : '#10b981'}
              />
              <DataRow label="Memory Usage"
                value={memPct != null ? `${fmtF(memPct, 0)}%` : null}
                accent={memPct > 85 ? '#ef4444' : '#3b82f6'}
              />
              {gpuPct != null && (
                <DataRow label="GPU Usage" value={`${fmtF(gpuPct, 0)}%`} accent="#a855f7" />
              )}
            </>}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
