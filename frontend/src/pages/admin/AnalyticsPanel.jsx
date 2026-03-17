import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Paper, Typography, Stack, Grid, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress, Divider
} from '@mui/material';

const PYTHON_API = 'http://localhost:8001';
const SURF = '#0d0d1a';
const BORDER = 'rgba(255,255,255,0.07)';

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(null);
  useEffect(() => {
    if (target == null) return;
    const n = typeof target === 'number' ? target : parseFloat(String(target).replace(/,/g, ''));
    if (isNaN(n)) { setVal(target); return; }
    if (n === 0) { setVal(0); return; }
    const start = Date.now();
    const isFloat = !Number.isInteger(n);
    const timer = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - (1 - p) ** 3;
      const cur = isFloat ? +(n * ease).toFixed(1) : Math.round(n * ease);
      setVal(cur);
      if (p >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return val;
}

// ── Label ─────────────────────────────────────────────────────────────────────
function Label({ children, color = '#475569' }) {
  return (
    <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color }}>
      {children}
    </Typography>
  );
}

// ── KPI tile with count-up ────────────────────────────────────────────────────
function KpiTile({ label, rawValue, sub, accent, format = 'int' }) {
  const counted = useCountUp(rawValue);
  const display = counted == null
    ? '—'
    : format === 'float' ? Number(counted).toFixed(1)
    : Number(counted).toLocaleString();

  return (
    <Paper sx={{
      px: 4, py: 5, bgcolor: SURF, width: '100%',
      border: `1px solid ${BORDER}`, borderTop: `2px solid ${accent}`, borderRadius: '4px',
      transition: 'box-shadow 0.2s',
      '&:hover': { boxShadow: `0 0 24px ${accent}22` },
    }}>
      <Label>{label}</Label>
      <Typography sx={{
        fontSize: 44, fontWeight: 800, lineHeight: 1.05, mt: 2, mb: 1.25,
        color: accent, fontVariantNumeric: 'tabular-nums',
        textShadow: `0 0 32px ${accent}55`,
      }}>
        {display}
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#475569', minHeight: 18 }}>{sub ?? ' '}</Typography>
    </Paper>
  );
}

// ── Period picker ─────────────────────────────────────────────────────────────
function PeriodPicker({ value, onChange }) {
  return (
    <Stack direction="row" sx={{ border: `1px solid ${BORDER}`, borderRadius: '4px', overflow: 'hidden' }}>
      {[['hourly', 'Hourly'], ['daily', 'Daily'], ['weekly', 'Weekly']].map(([v, label]) => (
        <Box key={v} onClick={() => onChange(v)} sx={{
          px: 2.5, py: 1, cursor: 'pointer', fontSize: 12, fontWeight: 500, userSelect: 'none',
          color: value === v ? '#10b981' : '#64748b',
          bgcolor: value === v ? 'rgba(16,185,129,0.1)' : 'transparent',
          borderRight: `1px solid ${BORDER}`, '&:last-child': { borderRight: 'none' },
          '&:hover': { bgcolor: value === v ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)' },
          transition: 'all 0.12s',
        }}>
          {label}
        </Box>
      ))}
    </Stack>
  );
}

// ── Smooth bezier line chart with animated draw ───────────────────────────────
function LineChart({ data, labelKey = 'time', valueKey = 'count', color = '#10b981', height = 160 }) {
  const pathRef = useRef(null);
  const areaRef = useRef(null);

  const values = (data || []).map(d => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const W = 500; const H = height;
  const pL = 40; const pR = 8; const pT = 14; const pB = 28;
  const cw = W - pL - pR; const ch = H - pT - pB;

  const cx = (i) => pL + (i / Math.max(data.length - 1, 1)) * cw;
  const cy = (v) => pT + (1 - v / maxVal) * ch;

  // Smooth bezier path
  const smooth = (pts) => {
    if (pts.length < 2) return '';
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], c = pts[i];
      const cpx = p.x + (c.x - p.x) * 0.5;
      d += ` C${cpx},${p.y} ${cpx},${c.y} ${c.x},${c.y}`;
    }
    return d;
  };

  const pts = (data || []).map((d, i) => ({ x: cx(i), y: cy(Number(d[valueKey]) || 0) }));
  const linePath = smooth(pts);
  const areaPath = pts.length
    ? `${linePath} L${pts[pts.length - 1].x},${pT + ch} L${pts[0].x},${pT + ch} Z`
    : '';

  // Animate line draw on mount / data change
  useEffect(() => {
    if (!pathRef.current || !linePath) return;
    const len = pathRef.current.getTotalLength?.() || 0;
    if (!len) return;
    pathRef.current.style.transition = 'none';
    pathRef.current.style.strokeDasharray = len;
    pathRef.current.style.strokeDashoffset = len;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (pathRef.current) {
          pathRef.current.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)';
          pathRef.current.style.strokeDashoffset = '0';
        }
      });
    });
  }, [linePath]);

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const step = Math.max(1, Math.floor((data || []).length / 5));
  const gid = `lg${color.replace('#', '')}`;

  if (!data || data.length < 2) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height }}>
      <Typography sx={{ fontSize: 13, color: '#334155' }}>Not enough data</Typography>
    </Box>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grid */}
      {yTicks.map(v => (
        <line key={v} x1={pL} y1={cy(v)} x2={pL + cw} y2={cy(v)}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 4" />
      ))}
      {/* y labels */}
      {yTicks.map(v => (
        <text key={v} x={pL - 6} y={cy(v) + 4} textAnchor="end" fill="#334155" fontSize="9" fontFamily="inherit">
          {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
        </text>
      ))}
      {/* area */}
      <path ref={areaRef} d={areaPath} fill={`url(#${gid})`} />
      {/* animated line */}
      <path ref={pathRef} d={linePath} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />
      {/* dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke={SURF} strokeWidth="2" />
      ))}
      {/* x labels */}
      {(data || []).filter((_, i) => i % step === 0 || i === data.length - 1).map((d, j) => {
        const idx = data.indexOf(d);
        return (
          <text key={j} x={cx(idx)} y={H - 6} textAnchor="middle" fill="#334155" fontSize="9" fontFamily="inherit">
            {String(d[labelKey] ?? '').slice(-5)}
          </text>
        );
      })}
    </svg>
  );
}

// ── Keyword leaderboard ───────────────────────────────────────────────────────
const RANK_COLORS = ['#f59e0b', '#94a3b8', '#b45309'];
const RANK_GLOW   = ['rgba(245,158,11,0.2)', 'rgba(148,163,184,0.1)', 'rgba(180,83,9,0.1)'];

function KeywordLeaderboard({ data }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  if (!data || data.length === 0) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
      <Typography sx={{ fontSize: 13, color: '#334155' }}>No keyword data yet</Typography>
    </Box>
  );

  const maxVal = Math.max(...data.map(d => Number(d.count) || 0), 1);

  return (
    <Stack spacing={0.75}>
      {data.slice(0, 12).map((item, i) => {
        const pct = ((Number(item.count) || 0) / maxVal) * 100;
        const isTop = i < 3;
        const rankColor = RANK_COLORS[i] ?? '#3b82f6';
        const glowColor = RANK_GLOW[i] ?? 'rgba(59,130,246,0.08)';
        const delay = `${i * 50}ms`;

        return (
          <Box key={i} sx={{
            position: 'relative', overflow: 'hidden', borderRadius: '4px',
            border: `1px solid ${isTop ? rankColor + '30' : BORDER}`,
            bgcolor: isTop ? glowColor : 'rgba(255,255,255,0.01)',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: isTop ? glowColor : 'rgba(255,255,255,0.03)',
              transform: 'translateX(2px)',
            },
            ...(i === 0 ? { boxShadow: `0 0 20px rgba(245,158,11,0.12)` } : {}),
            animation: `fadeSlideIn 0.4s ease both`,
            animationDelay: delay,
            '@keyframes fadeSlideIn': {
              from: { opacity: 0, transform: 'translateX(-8px)' },
              to:   { opacity: 1, transform: 'translateX(0)' },
            },
          }}>
            {/* background progress bar */}
            <Box sx={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: mounted ? `${pct}%` : '0%',
              bgcolor: rankColor,
              opacity: 0.07,
              transition: `width 0.9s cubic-bezier(0.4,0,0.2,1) ${delay}`,
              borderRadius: '4px',
            }} />

            <Stack direction="row" alignItems="center" spacing={2}
              sx={{ position: 'relative', px: 2.5, py: isTop ? 2 : 1.5 }}>
              {/* rank number */}
              <Typography sx={{
                fontSize: isTop ? 32 : 22, fontWeight: 800,
                color: rankColor, width: isTop ? 52 : 40, flexShrink: 0,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                textShadow: isTop ? `0 0 16px ${rankColor}88` : 'none',
              }}>
                {String(i + 1).padStart(2, '0')}
              </Typography>

              {/* keyword */}
              <Typography sx={{
                flex: 1,
                fontSize: isTop ? 15 : 13,
                fontWeight: isTop ? 700 : 500,
                textTransform: 'uppercase',
                letterSpacing: isTop ? '0.06em' : '0.04em',
                color: isTop ? '#e2e8f0' : '#94a3b8',
              }} noWrap>
                {item.keyword || '—'}
              </Typography>

              {/* count */}
              <Typography sx={{
                fontSize: isTop ? 20 : 15, fontWeight: 700,
                color: rankColor, fontVariantNumeric: 'tabular-nums',
              }}>
                {Number(item.count).toLocaleString()}
              </Typography>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

// ── Health bar ────────────────────────────────────────────────────────────────
function HealthBar({ label, value, color }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.75}>
        <Typography sx={{ fontSize: 12, color: '#64748b' }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
          {value != null ? `${Number(value).toFixed(0)}%` : '—'}
        </Typography>
      </Stack>
      <Box sx={{ height: 6, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
        <Box sx={{
          height: '100%',
          width: mounted ? `${Math.min(value || 0, 100)}%` : '0%',
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: '3px',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 8px ${color}66`,
        }} />
      </Box>
    </Box>
  );
}

// ── Table styles ──────────────────────────────────────────────────────────────
const TH = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderColor: 'rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.02)', py: 1.5 };
const TD = { fontSize: 13, borderColor: 'rgba(255,255,255,0.04)', py: 1.5 };
const ROW = { '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }, transition: 'background 0.1s', cursor: 'default' };

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalyticsPanel() {
  const [dashboardStats, setDashboardStats] = useState(null);
  const [topKeywords, setTopKeywords]       = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [queryVolume, setQueryVolume]       = useState([]);
  const [zeroResults, setZeroResults]       = useState([]);
  const [systemHealth, setSystemHealth]     = useState(null);
  const [period, setPeriod]                 = useState('daily');
  const [loading, setLoading]               = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const res = await Promise.allSettled([
      fetch(`${PYTHON_API}/api/analytics/dashboard-stats`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/top-keywords`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/recent-searches`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/query-volume?period=${period}`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/zero-results`).then(r => r.json()),
      fetch(`${PYTHON_API}/api/analytics/system-health-full`).then(r => r.json()),
    ]);
    if (res[0].status === 'fulfilled') setDashboardStats(res[0].value);
    if (res[1].status === 'fulfilled') setTopKeywords(res[1].value?.keywords || res[1].value || []);
    if (res[2].status === 'fulfilled') setRecentSearches(res[2].value?.searches || res[2].value || []);
    if (res[3].status === 'fulfilled') setQueryVolume(res[3].value?.data || res[3].value?.volume || []);
    if (res[4].status === 'fulfilled') setZeroResults(res[4].value?.zero_result_queries || res[4].value?.queries || []);
    if (res[5].status === 'fulfilled') setSystemHealth(res[5].value);
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const cpuPct = systemHealth?.cpu_percent;
  const memPct = systemHealth?.memory?.percent;
  const gpuPct = systemHealth?.gpu_percent;

  const kpis = [
    { label: 'Total Searches',  rawValue: dashboardStats?.total_searches,          accent: '#10b981', sub: 'all time',        format: 'int'   },
    { label: 'Unique Queries',  rawValue: dashboardStats?.unique_queries,           accent: '#3b82f6', sub: 'distinct',         format: 'int'   },
    { label: 'Avg Results',     rawValue: dashboardStats?.avg_results_per_query,    accent: '#f59e0b', sub: 'per query',        format: 'float' },
    { label: 'Zero Results',    rawValue: dashboardStats?.zero_result_queries,      accent: '#ef4444',
      sub: dashboardStats?.total_searches
        ? `${((dashboardStats.zero_result_queries / dashboardStats.total_searches) * 100).toFixed(1)}% of all`
        : ' ',
      format: 'int',
    },
  ];

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>Analytics</Typography>
        <PeriodPicker value={period} onChange={setPeriod} />
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
          <CircularProgress size={28} sx={{ color: '#10b981' }} />
        </Box>
      ) : <>
        {/* KPI row */}
        <Grid container spacing={2} mb={2.5} columns={12}>
          {kpis.map(k => (
            <Grid item xs={12} sm={6} lg={3} key={k.label} sx={{ display: 'flex' }}>
              <KpiTile {...k} />
            </Grid>
          ))}
        </Grid>

        {/* Volume chart — full width */}
        <Paper sx={{ px: 3.5, py: 3.5, mb: 2.5, bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
            <Label>Query Volume — {period}</Label>
            <Typography sx={{ fontSize: 11, color: '#334155' }}>{queryVolume.length} data points</Typography>
          </Stack>
          <LineChart data={queryVolume} labelKey="time" valueKey="count" height={160} />
        </Paper>

        {/* Keywords (5) | Zero results (4) | System health (3) */}
        <Grid container spacing={2} mb={2.5}>
          <Grid item xs={12} md={5}>
            <Paper sx={{ px: 3.5, py: 3.5, bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px', height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
                <Label>Top Keywords</Label>
                <Typography sx={{ fontSize: 11, color: '#334155' }}>{topKeywords.length} terms</Typography>
              </Stack>
              <KeywordLeaderboard data={topKeywords} />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ px: 3.5, py: 3.5, bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px', height: '100%' }}>
              <Label>Zero-Result Queries</Label>
              <Divider sx={{ my: 2, borderColor: BORDER }} />
              {zeroResults.length === 0 ? (
                <Stack sx={{ height: 80, justifyContent: 'center', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 13, color: '#334155' }}>None — great coverage!</Typography>
                </Stack>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={TH}>Query</TableCell>
                        <TableCell sx={{ ...TH, textAlign: 'right' }}>Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {zeroResults.slice(0, 12).map((q, i) => (
                        <TableRow key={i} sx={ROW}>
                          <TableCell sx={{ ...TD, maxWidth: 180 }}>
                            <Typography sx={{ fontSize: 13 }} noWrap>{q.query || '—'}</Typography>
                          </TableCell>
                          <TableCell sx={{ ...TD, textAlign: 'right', color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                            {q.count || 1}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={3}>
            <Paper sx={{ px: 3, py: 3.5, bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px', height: '100%' }}>
              <Label>System Health</Label>
              <Divider sx={{ my: 2, borderColor: BORDER }} />
              {systemHealth ? (
                <Stack spacing={3}>
                  <HealthBar label="CPU"    value={cpuPct} color={cpuPct > 80 ? '#ef4444' : '#10b981'} />
                  <HealthBar label="Memory" value={memPct} color={memPct > 85 ? '#ef4444' : '#3b82f6'} />
                  {gpuPct != null && <HealthBar label="GPU" value={gpuPct} color="#a855f7" />}
                  <Divider sx={{ borderColor: BORDER }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>Redis</Typography>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Box sx={{
                        width: 6, height: 6, borderRadius: '50%',
                        bgcolor: systemHealth.redis?.status === 'healthy' ? '#10b981' : '#ef4444',
                        boxShadow: systemHealth.redis?.status === 'healthy' ? '0 0 6px #10b981' : 'none',
                      }} />
                      <Typography sx={{ fontSize: 11, color: systemHealth.redis?.status === 'healthy' ? '#10b981' : '#ef4444' }}>
                        {systemHealth.redis?.status ?? 'unknown'}
                      </Typography>
                    </Stack>
                  </Stack>
                  {systemHealth.disk && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: 12, color: '#64748b' }}>Disk</Typography>
                      <Typography sx={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                        {systemHealth.disk.used_gb?.toFixed(1)}/{systemHealth.disk.total_gb?.toFixed(0)} GB
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              ) : (
                <Typography sx={{ fontSize: 13, color: '#334155' }}>Unavailable</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Recent searches */}
        <Paper sx={{ px: 3.5, py: 3.5, bgcolor: SURF, border: `1px solid ${BORDER}`, borderRadius: '4px' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Label>Recent Searches</Label>
            <Typography sx={{ fontSize: 11, color: '#334155' }}>{recentSearches.length} entries</Typography>
          </Stack>
          <Divider sx={{ borderColor: BORDER }} />
          {recentSearches.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: '#334155' }}>No search history</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={TH}>Query</TableCell>
                    <TableCell sx={{ ...TH, textAlign: 'right' }}>Results</TableCell>
                    <TableCell sx={TH}>Reranker</TableCell>
                    <TableCell sx={TH}>Session</TableCell>
                    <TableCell sx={TH}>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentSearches.slice(0, 25).map((s, i) => {
                    const resultCount = s.total_results ?? s.result_count;
                    const ts = s.timestamp ? new Date(s.timestamp * 1000) : null;
                    return (
                      <TableRow key={i} sx={ROW}>
                        <TableCell sx={{ ...TD, maxWidth: 320 }}>
                          <Typography sx={{ fontSize: 13 }} noWrap>{s.query || '—'}</Typography>
                        </TableCell>
                        <TableCell sx={{ ...TD, textAlign: 'right' }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: resultCount > 0 ? '#10b981' : '#ef4444' }}>
                            {resultCount ?? 0}
                          </Typography>
                        </TableCell>
                        <TableCell sx={TD}>
                          <Box sx={{
                            width: 6, height: 6, borderRadius: '50%',
                            bgcolor: s.reranker_enabled ? '#10b981' : '#334155',
                            boxShadow: s.reranker_enabled ? '0 0 6px #10b981' : 'none',
                          }} />
                        </TableCell>
                        <TableCell sx={{ ...TD, color: '#475569', fontFamily: 'monospace', fontSize: 11 }}>
                          {s.session_id ? s.session_id.slice(0, 8) : '—'}
                        </TableCell>
                        <TableCell sx={{ ...TD, color: '#475569', whiteSpace: 'nowrap' }}>
                          {ts ? ts.toLocaleString() : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </>}
    </Box>
  );
}
