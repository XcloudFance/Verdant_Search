import React, { useEffect, useState } from 'react';
import {
  Box, Container, Typography, Tabs, Tab, Paper, Stack, Button, Skeleton,
  Pagination, IconButton, Chip, Switch, FormControlLabel, Drawer, Tooltip,
  Divider
} from '@mui/material';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import TimerIcon from '@mui/icons-material/Timer';
import Navbar from '../components/layout/Navbar';
import AmbientBackground from '../components/common/AmbientBackground';
import AISummary from '../components/features/AISummary';
import ChatWidget from '../components/features/ChatWidget';
import PeopleAlsoAsk from '../components/features/PeopleAlsoAsk';
import { useHistory } from '../context/HistoryContext';
import AnimatedPage from '../components/layout/AnimatedPage';

const Results = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const query = searchParams.get('q') || '';
    const currentPage = parseInt(searchParams.get('page')) || 1;
    const pageSize = parseInt(searchParams.get('page_size')) || 10;

    const [loading, setLoading] = useState(true);
    const [results, setResults] = useState([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [tab, setTab] = useState(0);
    const [chatQuestion, setChatQuestion] = useState(null);

    // Reranker toggle
    const [rerankerEnabled, setRerankerEnabled] = useState(false);

    // Stage timings
    const [stageTimings, setStageTimings] = useState(null);

    // Research Workspace (pinned docs)
    const [pinnedDocs, setPinnedDocs] = useState([]);
    const [workspaceOpen, setWorkspaceOpen] = useState(false);

    // Search history stack
    const [searchHistory, setSearchHistory] = useState([]);
    const [canGoBack, setCanGoBack] = useState(false);

    const { addToHistory } = useHistory();

    const handleQuestionClick = (question) => {
        if (query) {
            setSearchHistory(prev => [...prev, { query, results, page: currentPage }]);
            setCanGoBack(true);
        }
        navigate(`/results?q=${encodeURIComponent(question)}`);
    };

    const handleGoBack = () => {
        if (searchHistory.length > 0) {
            const previous = searchHistory[searchHistory.length - 1];
            setSearchHistory(prev => prev.slice(0, -1));
            setCanGoBack(searchHistory.length > 1);
            navigate(`/results?q=${encodeURIComponent(previous.query)}&page=${previous.page || 1}`);
        }
    };

    const togglePin = (item) => {
        const id = item.id || item.url || item.title;
        setPinnedDocs(prev => {
            const already = prev.some(p => (p.id || p.url || p.title) === id);
            if (already) return prev.filter(p => (p.id || p.url || p.title) !== id);
            return [...prev, item];
        });
    };

    const isPinned = (item) => {
        const id = item.id || item.url || item.title;
        return pinnedDocs.some(p => (p.id || p.url || p.title) === id);
    };

    useEffect(() => {
        const fetchResults = async () => {
            if (location.state?.imageSearch && location.state?.results) {
                setResults(location.state.results);
                setTotal(location.state.total || 0);
                setTotalPages(location.state.totalPages || 0);
                setLoading(false);
                return;
            }

            if (!query) {
                setResults([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setStageTimings(null);

            try {
                const url = `http://localhost:8001/api/search`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: query,
                        page: currentPage,
                        page_size: pageSize,
                        reranker_enabled: rerankerEnabled,
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    setResults(data.results || []);
                    setTotal(data.total || 0);
                    setTotalPages(data.total_pages || 0);
                    if (data.stage_timings) setStageTimings(data.stage_timings);
                } else {
                    setResults([]);
                    setTotal(0);
                    setTotalPages(0);
                }
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
                setTotal(0);
                setTotalPages(0);
            } finally {
                setLoading(false);
                if (currentPage === 1 && query && query !== '[Image Search]') {
                    addToHistory(query);
                }
            }
        };

        fetchResults();
    }, [query, currentPage, pageSize, rerankerEnabled]);

    const handlePageChange = (event, value) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', value);
        navigate(`/results?${params.toString()}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getRankDeltaChip = (delta) => {
        if (delta == null) return null;
        if (delta === 0) return null;
        const up = delta > 0;
        return (
            <Chip
                label={`${up ? '+' : ''}${delta}`}
                size="small"
                sx={{
                    bgcolor: up ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: up ? '#10b981' : '#ef4444',
                    fontWeight: 700,
                    fontSize: 11,
                    height: 20,
                    ml: 0.5,
                }}
            />
        );
    };

    return (
        <AnimatedPage>
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                <AmbientBackground />
                <Navbar initialQuery={query} />

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 2, md: 18 } }}>
                    <Tabs value={tab} onChange={(e, v) => setTab(v)} textColor="primary" indicatorColor="primary">
                        <Tab label="All" />
                        <Tab label="Images" />
                        <Tab label="Videos" />
                        <Tab label="News" />
                    </Tabs>
                </Box>

                <Container maxWidth="xl" sx={{ display: 'flex', mt: 4, gap: 2 }}>
                    {/* Main Results */}
                    <Box sx={{ flex: 2, maxWidth: '800px', ml: { md: 10 } }}>

                        {/* Reranker Toggle + Stage Timings */}
                        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={rerankerEnabled}
                                        onChange={e => setRerankerEnabled(e.target.checked)}
                                        size="small"
                                        sx={{
                                            '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' },
                                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'rgba(16,185,129,0.5)' },
                                        }}
                                    />
                                }
                                label={
                                    <Typography variant="body2" color="text.secondary">
                                        Reranker {rerankerEnabled ? <Chip label="ON" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: 10, height: 18 }} /> : <Chip label="OFF" size="small" sx={{ bgcolor: 'rgba(107,114,128,0.2)', color: '#9ca3af', fontSize: 10, height: 18 }} />}
                                    </Typography>
                                }
                            />
                            {stageTimings && (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <TimerIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                    {Object.entries(stageTimings).map(([k, v]) => (
                                        <Chip
                                            key={k}
                                            label={`${k.replace('_ms', '')}: ${v}ms`}
                                            size="small"
                                            sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'text.secondary', fontSize: 10, height: 18 }}
                                        />
                                    ))}
                                </Stack>
                            )}
                        </Box>

                        {/* Back Button */}
                        {canGoBack && (
                            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Button
                                    startIcon={<ArrowBackIcon />}
                                    onClick={handleGoBack}
                                    variant="outlined"
                                    size="small"
                                    sx={{
                                        borderColor: 'rgba(255,255,255,0.2)',
                                        color: 'text.secondary',
                                        '&:hover': {
                                            borderColor: 'primary.main',
                                            color: 'primary.main',
                                            bgcolor: 'rgba(16, 185, 129, 0.1)'
                                        }
                                    }}
                                >
                                    Back to previous search
                                </Button>
                            </Box>
                        )}

                        {/* Image Search Preview */}
                        {location.state?.previewImage && (
                            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                                <Typography variant="subtitle1" color="text.secondary">Searching for image:</Typography>
                                <Box
                                    component="img"
                                    src={location.state.previewImage}
                                    sx={{ height: 80, borderRadius: 1, border: '1px solid rgba(255,255,255,0.2)' }}
                                />
                            </Box>
                        )}

                        {/* AI Overview */}
                        <AISummary query={query} results={results} searchLoading={loading} onSuggestedSearch={handleQuestionClick} />

                        {/* Results Count */}
                        {!loading && total > 0 && (
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                About {total} results (page {currentPage} of {totalPages})
                            </Typography>
                        )}

                        {/* Search Results List */}
                        <Stack spacing={4}>
                            {loading ? (
                                [1, 2, 3].map((i) => (
                                    <Box key={i}>
                                        <Skeleton width="30%" height={20} />
                                        <Skeleton width="60%" height={30} />
                                        <Skeleton width="90%" />
                                    </Box>
                                ))
                            ) : results.length > 0 ? (
                                results.map((item, index) => (
                                    <Box key={index}>
                                        <Stack direction="row" alignItems="flex-start" spacing={1} mb={0.5}>
                                            <Box sx={{ flex: 1 }}>
                                                <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                                                    <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                                                        {item.url && item.url.length > 8 ? item.url[8] : '🔍'}
                                                    </Box>
                                                    <Stack>
                                                        <Typography variant="caption" color="text.primary">
                                                            {item.displayUrl ? item.displayUrl.split(' > ')[0] : (item.url || 'Internal Document')}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">{item.displayUrl || item.url || 'No URL'}</Typography>
                                                    </Stack>
                                                </Stack>

                                                <Stack direction="row" alignItems="center" mb={0.5}>
                                                    <Typography
                                                        component={item.url ? "a" : "div"}
                                                        href={item.url || undefined}
                                                        target={item.url ? "_blank" : undefined}
                                                        rel={item.url ? "noopener noreferrer" : undefined}
                                                        variant="h5"
                                                        color="secondary.main"
                                                        sx={{
                                                            textDecoration: 'none',
                                                            '&:hover': { textDecoration: item.url ? 'underline' : 'none', cursor: item.url ? 'pointer' : 'default' },
                                                            flex: 1,
                                                        }}
                                                    >
                                                        {item.title}
                                                    </Typography>
                                                    {/* Rank delta badge */}
                                                    {rerankerEnabled && getRankDeltaChip(item.rank_delta)}
                                                    {/* Relevance score */}
                                                    {item.score != null && (
                                                        <Chip
                                                            label={Number(item.score).toFixed(3)}
                                                            size="small"
                                                            sx={{
                                                                ml: 1,
                                                                bgcolor: item.score >= 0.8 ? 'rgba(16,185,129,0.15)' : item.score >= 0.5 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                                                color: item.score >= 0.8 ? '#10b981' : item.score >= 0.5 ? '#f59e0b' : '#ef4444',
                                                                fontSize: 11,
                                                                height: 20,
                                                            }}
                                                        />
                                                    )}
                                                </Stack>

                                                <Typography variant="body2" color="text.secondary" mb={1}>
                                                    {item.snippet}
                                                </Typography>
                                            </Box>

                                            {/* Pin Button */}
                                            <Tooltip title={isPinned(item) ? 'Remove from Workspace' : 'Pin to Workspace'}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => { togglePin(item); setWorkspaceOpen(true); }}
                                                    sx={{
                                                        color: isPinned(item) ? '#10b981' : 'text.disabled',
                                                        '&:hover': { color: '#10b981', bgcolor: 'rgba(16,185,129,0.1)' },
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    {isPinned(item) ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>

                                        {/* Result Images */}
                                        {item.images && item.images.length > 0 && (
                                            <Box sx={{ mt: 1.5, display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
                                                {item.images.slice(0, 4).map((img, idx) => (
                                                    <Box
                                                        key={idx}
                                                        component="img"
                                                        src={img.base64_data ? `data:image/jpeg;base64,${img.base64_data}` : img.url}
                                                        alt={img.alt_text || 'Result image'}
                                                        title={img.alt_text}
                                                        sx={{
                                                            height: 100,
                                                            minWidth: 100,
                                                            borderRadius: 2,
                                                            objectFit: 'cover',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            cursor: 'zoom-in',
                                                            transition: 'transform 0.2s',
                                                            '&:hover': { transform: 'scale(1.05)' }
                                                        }}
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                ))}
                                            </Box>
                                        )}
                                    </Box>
                                ))
                            ) : (
                                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                                    <Typography variant="h6" color="text.secondary">
                                        No results found
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" mt={1}>
                                        Try different keywords
                                    </Typography>
                                </Paper>
                            )}
                        </Stack>

                        {/* Pagination */}
                        {!loading && totalPages > 1 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6, mb: 4 }}>
                                <Pagination
                                    count={totalPages}
                                    page={currentPage}
                                    onChange={handlePageChange}
                                    color="primary"
                                    size="large"
                                    showFirstButton
                                    showLastButton
                                    sx={{
                                        '& .MuiPaginationItem-root': {
                                            color: 'text.primary',
                                            borderColor: 'rgba(255,255,255,0.1)',
                                            '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' },
                                        },
                                        '& .Mui-selected': {
                                            bgcolor: 'primary.main',
                                            color: 'white',
                                            '&:hover': { bgcolor: 'primary.dark' },
                                        },
                                    }}
                                />
                            </Box>
                        )}
                    </Box>

                    {/* People Also Ask Sidebar */}
                    <Box sx={{ flex: 1, display: { xs: 'none', lg: 'block' }, maxWidth: '400px' }}>
                        <PeopleAlsoAsk
                            query={query}
                            results={results}
                            searchLoading={loading}
                            onQuestionClick={handleQuestionClick}
                        />
                    </Box>

                    {/* Research Workspace Toggle Button */}
                    <Box sx={{ display: { xs: 'none', xl: 'flex' }, alignItems: 'flex-start', pt: 1 }}>
                        <Tooltip title={workspaceOpen ? 'Close Workspace' : `Research Workspace (${pinnedDocs.length} pinned)`}>
                            <IconButton
                                onClick={() => setWorkspaceOpen(v => !v)}
                                sx={{
                                    bgcolor: pinnedDocs.length > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                                    border: '1px solid',
                                    borderColor: pinnedDocs.length > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)',
                                    color: pinnedDocs.length > 0 ? '#10b981' : 'text.secondary',
                                    '&:hover': { bgcolor: 'rgba(16,185,129,0.15)' },
                                }}
                            >
                                {workspaceOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Container>

                {/* Research Workspace Drawer */}
                <Drawer
                    anchor="right"
                    open={workspaceOpen}
                    onClose={() => setWorkspaceOpen(false)}
                    variant="persistent"
                    PaperProps={{
                        sx: {
                            width: 320,
                            bgcolor: '#111117',
                            borderLeft: '1px solid rgba(255,255,255,0.08)',
                            top: 0,
                            height: '100vh',
                        }
                    }}
                >
                    <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={600}>Research Workspace</Typography>
                            <Typography variant="caption" color="text.secondary">{pinnedDocs.length} pinned document{pinnedDocs.length !== 1 ? 's' : ''}</Typography>
                        </Box>
                        <IconButton size="small" onClick={() => setWorkspaceOpen(false)} sx={{ color: 'text.secondary' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
                        {pinnedDocs.length === 0 ? (
                            <Box sx={{ textAlign: 'center', pt: 4 }}>
                                <PushPinOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    Pin documents from search results to compare them here.
                                </Typography>
                            </Box>
                        ) : (
                            <Stack spacing={1.5}>
                                {pinnedDocs.map((doc, i) => {
                                    const docId = doc.id || doc.url || doc.title;
                                    return (
                                        <Paper key={i} sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1.5 }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                <Box sx={{ flex: 1, mr: 1 }}>
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={600}
                                                        component={doc.url ? 'a' : 'span'}
                                                        href={doc.url || undefined}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        sx={{ textDecoration: 'none', color: 'secondary.main', '&:hover': { textDecoration: 'underline' } }}
                                                    >
                                                        {doc.title || 'Untitled'}
                                                    </Typography>
                                                    {doc.url && (
                                                        <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>
                                                            {doc.url}
                                                        </Typography>
                                                    )}
                                                    {doc.snippet && (
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                            {doc.snippet.slice(0, 120)}{doc.snippet.length > 120 ? '...' : ''}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => togglePin(doc)}
                                                    sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' }, flexShrink: 0 }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => setPinnedDocs([])}
                                    sx={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' }, mt: 1 }}
                                >
                                    Clear All
                                </Button>
                            </Stack>
                        )}
                    </Box>
                </Drawer>

                {/* Chat Widget */}
                <ChatWidget
                    query={query}
                    results={results}
                    externalQuestion={chatQuestion}
                    onQuestionSent={() => setChatQuestion(null)}
                />
            </Box>
        </AnimatedPage>
    );
};

export default Results;
