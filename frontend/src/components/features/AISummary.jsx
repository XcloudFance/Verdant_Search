import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Stack, CircularProgress, IconButton, Collapse, Chip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AISummary = ({ query, results, searchLoading, onSuggestedSearch }) => {
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(true);
    const [lastGeneratedQuery, setLastGeneratedQuery] = useState('');
    const [suggestedQueries, setSuggestedQueries] = useState([]);

    const generateSummary = async (skipCache = false) => {
        if (!results || results.length === 0) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('http://localhost:8001/api/llm/summary', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    results: results.map(r => ({
                        title: r.title,
                        url: r.url,
                        snippet: r.snippet
                    })),
                    skip_cache: skipCache
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate summary');
            }

            const data = await response.json();
            setSummary(data.summary);

            // 生成建议的搜索关键词
            if (!skipCache) {
                generateSuggestedQueries();
            }
        } catch (err) {
            console.error('Summary generation error:', err);
            setError('Unable to generate AI summary. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const generateSuggestedQueries = async () => {
        // 基于当前查询和结果，生成建议的follow-up搜索
        // 这里我们可以调用 suggest-questions API 或者从summary中提取关键词
        try {
            const response = await fetch('http://localhost:8001/api/llm/suggest-questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    results: results.slice(0, 3).map(r => ({
                        title: r.title,
                        url: r.url,
                        snippet: r.snippet
                    }))
                })
            });

            if (response.ok) {
                const data = await response.json();
                // 转换问题为关键词
                const keywords = data.questions.slice(0, 3).map(q =>
                    q.replace(/[?？]/g, '').trim()
                );
                setSuggestedQueries(keywords);
            }
        } catch (err) {
            console.error('Suggested queries generation error:', err);
        }
    };

    useEffect(() => {
        // 只在搜索完成、有结果、且是新查询时才生成summary
        if (!searchLoading && query && results && results.length > 0 && query !== lastGeneratedQuery) {
            console.log('Generating AI Summary for query:', query);
            setLastGeneratedQuery(query);
            generateSummary(false);
        }
    }, [searchLoading, query, results]);  // ✅ 添加 results 依赖，确保数据最新

    if (!results || results.length === 0) return null;

    return (
        <Paper sx={{
            p: 3,
            mb: 4,
            borderRadius: 3,
            background: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.05), rgba(56, 189, 248, 0.05))',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #10b981, #38bdf8)' }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <AutoAwesomeIcon color="primary" />
                    <Typography variant="h6" fontWeight="bold">AI Overview</Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                    {!loading && (
                        <IconButton size="small" onClick={() => generateSummary(true)} title="Regenerate">
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    )}
                    <IconButton size="small" onClick={() => setExpanded(!expanded)}>
                        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </Stack>
            </Stack>

            <Collapse in={expanded}>
                {loading ? (
                    <Stack direction="row" spacing={2} alignItems="center" py={2}>
                        <CircularProgress size={24} />
                        <Typography variant="body2" color="text.secondary">
                            Generating AI summary...
                        </Typography>
                    </Stack>
                ) : error ? (
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                ) : summary ? (
                    <>
                        <Box sx={{
                            '& h2': { fontSize: '1.25rem', fontWeight: 600, mt: 2, mb: 1 },
                            '& h3': { fontSize: '1.1rem', fontWeight: 600, mt: 1.5, mb: 0.75 },
                            '& p': { lineHeight: 1.8, mb: 1.5 },
                            '& ul, & ol': { pl: 3, mb: 1.5 },
                            '& li': { mb: 0.5 },
                            '& strong': { fontWeight: 600, color: 'primary.light' },
                            '& code': {
                                bgcolor: 'rgba(255,255,255,0.05)',
                                px: 0.75,
                                py: 0.25,
                                borderRadius: 0.5,
                                fontSize: '0.9em'
                            }
                        }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {summary}
                            </ReactMarkdown>
                        </Box>

                        {/* Suggested Follow-up Searches */}
                        {suggestedQueries.length > 0 && onSuggestedSearch && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                                    <Typography variant="subtitle2" color="text.secondary" fontWeight="medium">
                                        Related searches:
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    {suggestedQueries.map((suggested, index) => (
                                        <Chip
                                            key={index}
                                            label={suggested}
                                            onClick={() => onSuggestedSearch(suggested)}
                                            size="small"
                                            variant="outlined"
                                            sx={{
                                                borderColor: 'rgba(0, 0, 0, 0.1)',
                                                bgcolor: 'rgba(0,0,0,0.02)',
                                                color: 'text.secondary',
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: 'rgba(0,0,0,0.05)',
                                                    borderColor: 'primary.main',
                                                    color: 'primary.main'
                                                },
                                            }}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        )}
                    </>
                ) : null}
            </Collapse>
        </Paper>
    );
};

export default AISummary;
