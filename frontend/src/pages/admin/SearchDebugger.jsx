import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Chip, Stack, Tabs, Tab,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  CircularProgress, Alert, Divider, Tooltip, LinearProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import { PYTHON_API } from '../../config';

const sx = {
  card: { bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, p: 2.5 },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'text.disabled', textTransform: 'uppercase', mb: 1 },
  scoreChip: (score) => ({
    bgcolor: score > 0.5 ? 'rgba(16,185,129,0.15)' : score > 0.1 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)',
    color: score > 0.5 ? '#10b981' : score > 0.1 ? '#f59e0b' : '#ef4444',
    fontWeight: 700, fontSize: 11, height: 20,
  }),
};

const TimingChips = ({ timings }) => (
  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
    {Object.entries(timings || {}).map(([k, v]) => (
      <Chip key={k} label={`${k.replace('_ms', '')}: ${v}ms`} size="small"
        sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary', fontSize: 10, height: 18 }} />
    ))}
  </Stack>
);

const TokenChip = ({ token, index }) => {
  const colors = ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#84cc16'];
  return (
    <Chip
      label={token}
      size="small"
      sx={{
        bgcolor: colors[index % colors.length] + '22',
        color: colors[index % colors.length],
        border: `1px solid ${colors[index % colors.length]}44`,
        fontWeight: 600,
        fontSize: 12,
        height: 26,
        fontFamily: 'monospace',
      }}
    />
  );
};

const ResultsTable = ({ rows, showSources, showDelta }) => (
  <TableContainer component={Paper} sx={{ bgcolor: 'transparent', mt: 1 }}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 0.5, width: 40 }}>#</TableCell>
          <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 0.5 }}>Title</TableCell>
          <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 0.5, width: 90 }}>Score</TableCell>
          {showSources && <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 0.5, width: 120 }}>Sources</TableCell>}
          {showDelta && <TableCell sx={{ color: 'text.disabled', fontSize: 11, py: 0.5, width: 100 }}>Rank Δ</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {(rows || []).map((r, i) => (
          <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
            <TableCell sx={{ color: 'text.secondary', fontSize: 12, py: 0.75, fontWeight: 600 }}>{r.rank || i + 1}</TableCell>
            <TableCell sx={{ py: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, color: 'text.primary', lineHeight: 1.3 }}>{r.title}</Typography>
              {r.snippet && <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>{r.snippet}</Typography>}
            </TableCell>
            <TableCell sx={{ py: 0.75 }}>
              <Chip label={typeof r.score === 'number' ? r.score.toFixed(6) : r.score} size="small" sx={sx.scoreChip(r.score)} />
            </TableCell>
            {showSources && (
              <TableCell sx={{ py: 0.75 }}>
                <Stack direction="row" spacing={0.5}>
                  {(r.sources || []).map(s => (
                    <Chip key={s} label={s} size="small" sx={{
                      bgcolor: s === 'bm25' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)',
                      color: s === 'bm25' ? '#3b82f6' : '#8b5cf6',
                      fontSize: 10, height: 18, fontWeight: 600,
                    }} />
                  ))}
                </Stack>
              </TableCell>
            )}
            {showDelta && (
              <TableCell sx={{ py: 0.75 }}>
                {r.rank_delta == null || r.rank_delta === 0 ? (
                  <Chip icon={<RemoveIcon sx={{ fontSize: 12 }} />} label="same" size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'text.disabled', fontSize: 10, height: 18 }} />
                ) : r.rank_delta > 0 ? (
                  <Chip icon={<ArrowUpwardIcon sx={{ fontSize: 12 }} />} label={`+${r.rank_delta}`} size="small"
                    sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 10, height: 18, fontWeight: 700 }} />
                ) : (
                  <Chip icon={<ArrowDownwardIcon sx={{ fontSize: 12 }} />} label={`${r.rank_delta}`} size="small"
                    sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 10, height: 18, fontWeight: 700 }} />
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const RerankerDiff = ({ rrf, reranker }) => {
  if (!reranker || !rrf) return <Alert severity="info">Run a query with reranker results to see diff.</Alert>;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      <Box>
        <Typography sx={sx.label}>Before Reranking (RRF order)</Typography>
        {rrf.results?.slice(0, 10).map((r, i) => (
          <Paper key={i} sx={{ mb: 0.75, p: 1, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ color: 'text.disabled', fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{i + 1}</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</Typography>
              <Chip label={r.score.toFixed(6)} size="small" sx={sx.scoreChip(r.score)} />
            </Box>
          </Paper>
        ))}
      </Box>
      <Box>
        <Typography sx={sx.label}>After Reranking</Typography>
        {reranker.results?.map((r, i) => {
          const delta = r.rank_delta;
          const moved = delta !== 0 && delta != null;
          return (
            <Paper key={i} sx={{
              mb: 0.75, p: 1,
              bgcolor: moved ? (delta > 0 ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)') : 'rgba(255,255,255,0.02)',
              border: `1px solid ${moved ? (delta > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1
            }}>
              <Typography sx={{ color: 'text.disabled', fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{i + 1}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</Typography>
                <Stack direction="row" spacing={0.5} mt={0.25}>
                  <Chip label={r.score.toFixed(6)} size="small" sx={sx.scoreChip(r.score)} />
                  {moved && (
                    delta > 0
                      ? <Chip icon={<ArrowUpwardIcon sx={{ fontSize: 10 }} />} label={`+${delta} positions`} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 9, height: 18, fontWeight: 700 }} />
                      : <Chip icon={<ArrowDownwardIcon sx={{ fontSize: 10 }} />} label={`${delta} positions`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 9, height: 18, fontWeight: 700 }} />
                  )}
                </Stack>
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

export default function SearchDebugger() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(20);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);

  // Separate tokenizer test
  const [tokenizerText, setTokenizerText] = useState('');
  const [tokenizerResult, setTokenizerResult] = useState(null);
  const [tokenizerLoading, setTokenizerLoading] = useState(false);

  const runDebug = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const res = await fetch(`${PYTHON_API}/api/admin/search-debug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), top_k: topK }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setData(await res.json());
      setTab(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runTokenizer = async () => {
    if (!tokenizerText.trim()) return;
    setTokenizerLoading(true);
    try {
      const res = await fetch(`${PYTHON_API}/api/tokenize?text=${encodeURIComponent(tokenizerText.trim())}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTokenizerResult(await res.json());
    } catch (e) {
      setTokenizerResult({ error: e.message });
    } finally {
      setTokenizerLoading(false);
    }
  };

  const tabLabels = [
    { label: 'Tokenizer', count: data?.tokenization?.token_count },
    { label: 'BM25', count: data?.bm25?.count },
    { label: 'Vector', count: data?.vector?.count },
    { label: 'RRF Fusion', count: data?.rrf?.count },
    { label: 'Reranker Diff', count: data?.reranker?.results?.length },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>Search Pipeline Debugger</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Visualize every stage: tokenization → BM25 → vector → RRF fusion → reranker
      </Typography>

      {/* ── Tokenizer Tester ─────────────────────────────────────────── */}
      <Paper sx={sx.card} elevation={0}>
        <Typography sx={sx.label}>Tokenizer Tester (Jieba)</Typography>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            fullWidth
            size="small"
            placeholder="Enter text to tokenize (Chinese / English)…"
            value={tokenizerText}
            onChange={e => setTokenizerText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runTokenizer()}
            sx={{ '& .MuiInputBase-root': { fontSize: 14 } }}
          />
          <Button
            variant="contained"
            onClick={runTokenizer}
            disabled={tokenizerLoading || !tokenizerText.trim()}
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, whiteSpace: 'nowrap', minWidth: 110 }}
          >
            {tokenizerLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Tokenize'}
          </Button>
        </Stack>
        {tokenizerResult && !tokenizerResult.error && (
          <Box mt={2}>
            <Stack direction="row" spacing={1} mb={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {tokenizerResult.token_count} tokens
              </Typography>
              <Divider orientation="vertical" flexItem />
              <Typography variant="caption" color="text.secondary">Keywords: </Typography>
              {(tokenizerResult.keywords || []).map((k, i) => (
                <Chip key={i} label={k} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 11, height: 20, fontWeight: 600 }} />
              ))}
            </Stack>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {(tokenizerResult.tokens || []).map((t, i) => <TokenChip key={i} token={t} index={i} />)}
            </Stack>
          </Box>
        )}
        {tokenizerResult?.error && <Alert severity="error" sx={{ mt: 1 }}>{tokenizerResult.error}</Alert>}
      </Paper>

      {/* ── Full Pipeline Debug ───────────────────────────────────────── */}
      <Paper sx={{ ...sx.card, mt: 2 }} elevation={0}>
        <Typography sx={sx.label}>Full Pipeline Debug</Typography>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            fullWidth
            size="small"
            placeholder="Enter search query to trace through all pipeline stages…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runDebug()}
            sx={{ '& .MuiInputBase-root': { fontSize: 14 } }}
          />
          <TextField
            label="Top-K"
            type="number"
            size="small"
            value={topK}
            onChange={e => setTopK(Number(e.target.value))}
            sx={{ width: 80, '& .MuiInputBase-root': { fontSize: 13 } }}
            inputProps={{ min: 5, max: 100, step: 5 }}
          />
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SearchIcon />}
            onClick={runDebug}
            disabled={loading || !query.trim()}
            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, whiteSpace: 'nowrap', minWidth: 130 }}
          >
            {loading ? 'Running…' : 'Run Debug'}
          </Button>
        </Stack>
        {loading && <LinearProgress sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {data && (
        <Box mt={2}>
          {/* Stage timing summary */}
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.disabled">Stage timings:</Typography>
            <TimingChips timings={data.stage_timings} />
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              mb: 2,
              '& .MuiTab-root': { fontSize: 13, textTransform: 'none', minHeight: 40 },
              '& .Mui-selected': { color: '#10b981' },
              '& .MuiTabs-indicator': { bgcolor: '#10b981' },
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {tabLabels.map((t, i) => (
              <Tab key={i} label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <span>{t.label}</span>
                  {t.count != null && (
                    <Chip label={t.count} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: 'text.secondary', fontSize: 10, height: 18 }} />
                  )}
                </Stack>
              } />
            ))}
          </Tabs>

          {/* Tab 0: Tokenizer results */}
          {tab === 0 && (
            <Paper sx={sx.card} elevation={0}>
              <Typography sx={sx.label}>Tokenization — {data.tokenization.token_count} tokens</Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mb={2}>
                {data.tokenization.tokens.map((t, i) => <TokenChip key={i} token={t} index={i} />)}
              </Stack>
              {data.tokenization.keywords?.length > 0 && (
                <>
                  <Typography sx={{ ...sx.label, mt: 1 }}>Extracted Keywords (TF-IDF)</Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {data.tokenization.keywords.map((k, i) => (
                      <Chip key={i} label={k} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, height: 24, fontWeight: 600 }} />
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          )}

          {/* Tab 1: BM25 */}
          {tab === 1 && (
            <Paper sx={sx.card} elevation={0}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography sx={sx.label}>BM25 Results — {data.bm25.count} docs matched</Typography>
                <Chip label={`${data.bm25.time_ms}ms`} size="small" sx={{ bgcolor: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontSize: 11, height: 20 }} />
              </Stack>
              <ResultsTable rows={data.bm25.results} />
            </Paper>
          )}

          {/* Tab 2: Vector */}
          {tab === 2 && (
            <Paper sx={sx.card} elevation={0}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography sx={sx.label}>Vector (HNSW) Results — {data.vector.count} docs matched</Typography>
                <Chip label={`${data.vector.time_ms}ms`} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontSize: 11, height: 20 }} />
              </Stack>
              <ResultsTable rows={data.vector.results} />
            </Paper>
          )}

          {/* Tab 3: RRF */}
          {tab === 3 && (
            <Paper sx={sx.card} elevation={0}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography sx={sx.label}>RRF Fusion — {data.rrf.count} results</Typography>
                <Chip label={`${data.rrf.time_ms}ms`} size="small" sx={{ bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 11, height: 20 }} />
              </Stack>
              <Alert severity="info" sx={{ mb: 1.5, fontSize: 12 }}>
                RRF score = 1/(60 + bm25_rank) + 1/(60 + vector_rank). Blue = BM25 hit, Purple = vector hit, both = found by both retrievers.
              </Alert>
              <ResultsTable rows={data.rrf.results} showSources />
            </Paper>
          )}

          {/* Tab 4: Reranker Diff */}
          {tab === 4 && (
            <Paper sx={sx.card} elevation={0}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography sx={sx.label}>Reranker — Before vs After</Typography>
                <Stack direction="row" spacing={1}>
                  {data.reranker.enabled
                    ? <Chip label={`${data.reranker.time_ms}ms`} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 11, height: 20 }} />
                    : <Chip label="Reranker failed / skipped" size="small" sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: 11, height: 20 }} />
                  }
                </Stack>
              </Stack>
              {data.reranker.results && data.reranker.results.length > 0 ? (
                <>
                  <Alert severity="success" sx={{ mb: 2, fontSize: 12 }}>
                    Green rows moved UP, red rows moved DOWN after reranking. "same" = position unchanged.
                  </Alert>
                  <RerankerDiff rrf={data.rrf} reranker={data.reranker} />
                  <Box mt={2}>
                    <Typography sx={sx.label}>Reranked Results Table</Typography>
                    <ResultsTable rows={data.reranker.results} showDelta />
                  </Box>
                </>
              ) : (
                <Alert severity="warning">
                  Reranker did not return results. Check if the reranker service is configured and the ANTHROPIC_API_KEY is set.
                </Alert>
              )}
            </Paper>
          )}
        </Box>
      )}
    </Box>
  );
}
