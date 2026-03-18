import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Tabs, Tab, TextField,
  Drawer, CircularProgress, Alert, IconButton, Tooltip, Grid, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import {
  Search as SearchIcon, Delete as DeleteIcon, Close as CloseIcon,
  Refresh as RefreshIcon, Build as BuildIcon, Visibility as ViewIcon
} from '@mui/icons-material';

import { PYTHON_API } from '../../config';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

export default function IndexPanel() {
  const [tab, setTab] = useState(0);
  const [indexOverview, setIndexOverview] = useState(null);
  const [sourceBreakdown, setSourceBreakdown] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [operationResult, setOperationResult] = useState(null);
  const [operationLoading, setOperationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // Document detail drawer
  const [docDrawer, setDocDrawer] = useState({ open: false, doc: null, loading: false });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, docId: null });

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [overviewRes, sourceRes] = await Promise.allSettled([
        fetch(`${PYTHON_API}/api/v1/admin/index/overview`).then(r => r.json()),
        fetch(`${PYTHON_API}/api/v1/admin/index/stats/source-breakdown`).then(r => r.json()),
      ]);
      if (overviewRes.status === 'fulfilled') setIndexOverview(overviewRes.value);
      if (sourceRes.status === 'fulfilled') setSourceBreakdown(sourceRes.value?.breakdown || []);
    } catch {
      setError('Failed to load index overview');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchDocuments = useCallback(async (search = '', off = 0) => {
    setDocsLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: off });
      if (search) params.set('search', search);
      const res = await fetch(`${PYTHON_API}/api/v1/admin/index/documents?${params}`);
      const data = await res.json();
      setDocuments(data?.documents || data || []);
    } catch {
      setError('Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    if (tab === 0) fetchDocuments(searchQuery, offset);
  }, [tab, searchQuery, offset, fetchDocuments]);

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setOffset(0);
  };

  const openDocDetail = async (docId) => {
    setDocDrawer({ open: true, doc: null, loading: true });
    try {
      const res = await fetch(`${PYTHON_API}/api/v1/admin/index/documents/${docId}`);
      const data = await res.json();
      setDocDrawer({ open: true, doc: data, loading: false });
    } catch {
      setDocDrawer({ open: true, doc: null, loading: false });
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await fetch(`${PYTHON_API}/api/v1/admin/index/documents/${docId}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => (d.id || d.doc_id) !== docId));
      if (docDrawer.open) setDocDrawer({ open: false, doc: null, loading: false });
    } catch {
      setError('Failed to delete document');
    }
    setDeleteConfirm({ open: false, docId: null });
  };

  const handleReindexStats = async () => {
    setOperationLoading(true);
    setOperationResult(null);
    try {
      const res = await fetch(`${PYTHON_API}/api/v1/admin/index/reindex-stats`, { method: 'POST' });
      const data = await res.json();
      setOperationResult({ success: true, message: data?.message || 'Stats rebuilt successfully', data });
      fetchOverview();
    } catch (e) {
      setOperationResult({ success: false, message: `Failed: ${e.message}` });
    } finally {
      setOperationLoading(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString(); } catch { return ts; }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Index & Database</Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchOverview}
          variant="outlined"
          size="small"
          sx={{ borderColor: 'rgba(255,255,255,0.2)', color: 'text.secondary' }}
        >
          Refresh
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          '& .MuiTab-root': { color: 'text.secondary', fontSize: 13 },
          '& .Mui-selected': { color: '#10b981' },
          '& .MuiTabs-indicator': { bgcolor: '#10b981' },
        }}
      >
        <Tab label="Documents" />
        <Tab label="Stats" />
        <Tab label="Operations" />
      </Tabs>

      {/* Documents Tab */}
      <TabPanel value={tab} index={0}>
        <Stack direction="row" spacing={1} mb={2}>
          <TextField
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search documents..."
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />,
            }}
          />
          <Button onClick={handleSearch} variant="contained" size="small" sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
            Search
          </Button>
          {searchQuery && (
            <Button onClick={() => { setSearchQuery(''); setSearchInput(''); setOffset(0); }} size="small" sx={{ color: 'text.secondary' }}>
              Clear
            </Button>
          )}
        </Stack>

        <Paper sx={{ bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
          {docsLoading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={32} sx={{ color: '#10b981' }} /></Box>
          ) : documents.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No documents found</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: 'rgba(255,255,255,0.03)', fontWeight: 600, fontSize: 12, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.06)' } }}>
                    <TableCell>Title</TableCell>
                    <TableCell>Source Type</TableCell>
                    <TableCell align="right">Words</TableCell>
                    <TableCell align="right">Images</TableCell>
                    <TableCell>Indexed At</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc, i) => (
                    <TableRow
                      key={doc.id || doc.doc_id || i}
                      sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', fontSize: 13 }, '&:hover': { bgcolor: 'rgba(255,255,255,0.02)', cursor: 'pointer' } }}
                      onClick={() => openDocDetail(doc.id || doc.doc_id)}
                    >
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Tooltip title={doc.title || ''}>
                          <Typography variant="body2" noWrap fontWeight={500}>{doc.title || '—'}</Typography>
                        </Tooltip>
                        {doc.url && (
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 280 }}>
                            {doc.url}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={doc.source_type || 'unknown'} size="small" sx={{ fontSize: 11, height: 20 }} />
                      </TableCell>
                      <TableCell align="right">{doc.doc_length ?? doc.word_count ?? '—'}</TableCell>
                      <TableCell align="right">{doc.image_count ?? 0}</TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{formatDate(doc.created_at || doc.indexed_at)}</Typography>
                      </TableCell>
                      <TableCell align="center" onClick={e => e.stopPropagation()}>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => openDocDetail(doc.id || doc.doc_id)} sx={{ color: 'text.secondary' }}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirm({ open: true, docId: doc.id || doc.doc_id })}
                            sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {documents.length === LIMIT && (
          <Stack direction="row" justifyContent="center" spacing={1} mt={2}>
            <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} size="small">Previous</Button>
            <Button onClick={() => setOffset(offset + LIMIT)} size="small">Next</Button>
          </Stack>
        )}
      </TabPanel>

      {/* Stats Tab */}
      <TabPanel value={tab} index={1}>
        {overviewLoading ? (
          <Box sx={{ textAlign: 'center', pt: 4 }}><CircularProgress size={32} sx={{ color: '#10b981' }} /></Box>
        ) : (
          <>
            <Grid container spacing={2} mb={3}>
              {[
                { label: 'Total Documents', value: indexOverview?.total_documents?.toLocaleString(), color: '#10b981' },
                { label: 'Total Embeddings', value: indexOverview?.total_embeddings?.toLocaleString(), color: '#3b82f6' },
                { label: 'Total Terms', value: indexOverview?.total_terms?.toLocaleString(), color: '#f59e0b' },
                { label: 'Avg Doc Length', value: indexOverview?.avg_doc_length ? `${Number(indexOverview.avg_doc_length).toFixed(1)} tokens` : '—', color: '#a78bfa' },
              ].map(({ label, value, color }) => (
                <Grid item xs={12} sm={6} md={3} key={label}>
                  <Paper sx={{ p: 2.5, bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="h4" fontWeight={700} sx={{ color }}>{value ?? '—'}</Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>{label}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Paper sx={{ bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography variant="subtitle1" fontWeight={600}>Source Breakdown</Typography>
              </Box>
              {sourceBreakdown.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">No source data available</Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ '& th': { bgcolor: 'rgba(255,255,255,0.03)', fontWeight: 600, fontSize: 12, color: 'text.secondary', borderColor: 'rgba(255,255,255,0.06)' } }}>
                        <TableCell>Source Type</TableCell>
                        <TableCell align="right">Documents</TableCell>
                        <TableCell align="right">Total Terms</TableCell>
                        <TableCell>Last Indexed</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sourceBreakdown.map((s, i) => (
                        <TableRow key={i} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)', fontSize: 13 } }}>
                          <TableCell>
                            <Chip label={s.source_type || s.source || '—'} size="small" sx={{ fontSize: 11 }} />
                          </TableCell>
                          <TableCell align="right">{s.document_count?.toLocaleString() ?? '—'}</TableCell>
                          <TableCell align="right">{s.total_terms?.toLocaleString() ?? '—'}</TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">{formatDate(s.last_indexed)}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </>
        )}
      </TabPanel>

      {/* Operations Tab */}
      <TabPanel value={tab} index={2}>
        <Stack spacing={2} maxWidth={500}>
          {operationResult && (
            <Alert severity={operationResult.success ? 'success' : 'error'} onClose={() => setOperationResult(null)}>
              {operationResult.message}
            </Alert>
          )}

          <Paper sx={{ p: 3, bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1}>Rebuild Index Statistics</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Recalculates all BM25 statistics, document counts, term frequencies and vocabulary size from the current index contents.
            </Typography>
            <Button
              onClick={handleReindexStats}
              disabled={operationLoading}
              variant="contained"
              startIcon={operationLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <BuildIcon />}
              sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
            >
              {operationLoading ? 'Rebuilding...' : 'Rebuild Stats'}
            </Button>
          </Paper>

          <Paper sx={{ p: 3, bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} mb={1}>Index Information</Typography>
            <Stack spacing={1}>
              {[
                { label: 'Documents', value: indexOverview?.total_documents?.toLocaleString() },
                { label: 'Embeddings', value: indexOverview?.total_embeddings?.toLocaleString() },
                { label: 'Terms', value: indexOverview?.total_terms?.toLocaleString() },
                { label: 'Total Postings', value: indexOverview?.total_postings?.toLocaleString() },
              ].map(({ label, value }) => (
                <Stack key={label} direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{value ?? '—'}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </TabPanel>

      {/* Document Detail Drawer */}
      <Drawer
        anchor="right"
        open={docDrawer.open}
        onClose={() => setDocDrawer({ open: false, doc: null, loading: false })}
        PaperProps={{ sx: { width: 540, bgcolor: '#111117', borderLeft: '1px solid rgba(255,255,255,0.1)' } }}
      >
        <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight={600}>Document Details</Typography>
          <IconButton onClick={() => setDocDrawer({ open: false, doc: null, loading: false })} size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ p: 2.5, overflow: 'auto', height: 'calc(100vh - 80px)' }}>
          {docDrawer.loading ? (
            <Box sx={{ textAlign: 'center', pt: 4 }}><CircularProgress size={32} sx={{ color: '#10b981' }} /></Box>
          ) : !docDrawer.doc ? (
            <Typography color="text.secondary" textAlign="center" pt={4}>Failed to load document</Typography>
          ) : (
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="h6" fontWeight={600}>{docDrawer.doc.title || 'Untitled'}</Typography>
                {docDrawer.doc.url && (
                  <Typography variant="caption" sx={{ color: '#10b981', wordBreak: 'break-all' }}>{docDrawer.doc.url}</Typography>
                )}
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
              <Grid container spacing={1.5}>
                {[
                  { label: 'Source Type', value: docDrawer.doc.source_type },
                  { label: 'Doc Length', value: docDrawer.doc.doc_length },
                  { label: 'Image Count', value: docDrawer.doc.image_count },
                  { label: 'Indexed At', value: formatDate(docDrawer.doc.created_at || docDrawer.doc.indexed_at) },
                ].map(({ label, value }) => (
                  <Grid item xs={6} key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={500}>{value ?? '—'}</Typography>
                  </Grid>
                ))}
              </Grid>

              {docDrawer.doc.top_terms && docDrawer.doc.top_terms.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} mb={1}>Top Terms</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {docDrawer.doc.top_terms.slice(0, 30).map((term, i) => (
                      <Chip
                        key={i}
                        label={typeof term === 'object' ? `${term.term} (${term.tf})` : term}
                        size="small"
                        sx={{ fontSize: 11, height: 22, bgcolor: 'rgba(16,185,129,0.1)', color: '#10b981' }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              {docDrawer.doc.content && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} mb={1}>Content Preview</Typography>
                  <Paper sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {docDrawer.doc.content.slice(0, 1000)}{docDrawer.doc.content.length > 1000 ? '...' : ''}
                    </Typography>
                  </Paper>
                </Box>
              )}

              <Button
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteConfirm({ open: true, docId: docDrawer.doc.id || docDrawer.doc.doc_id })}
                sx={{ color: '#ef4444', alignSelf: 'flex-start', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
              >
                Delete Document
              </Button>
            </Stack>
          )}
        </Box>
      </Drawer>

      {/* Delete Confirmation */}
      <Dialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, docId: null })}
        PaperProps={{ sx: { bgcolor: '#111117', border: '1px solid rgba(255,255,255,0.12)' } }}
      >
        <DialogTitle>Delete Document</DialogTitle>
        <DialogContent>
          <Typography>This will permanently remove the document from the search index. This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, docId: null })} sx={{ color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={() => handleDeleteDoc(deleteConfirm.docId)} sx={{ color: '#ef4444' }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
