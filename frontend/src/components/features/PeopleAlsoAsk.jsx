import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Skeleton, Stack } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const PeopleAlsoAsk = ({ query, results, searchLoading, onQuestionClick }) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastGeneratedQuery, setLastGeneratedQuery] = useState('');

    const generateQuestions = async () => {
        if (!query || !results || results.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('http://localhost:8001/api/llm/suggest-questions', {
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
                    }))
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate questions');
            }

            const data = await response.json();
            setQuestions(data.questions || []);
        } catch (error) {
            console.error('Question generation error:', error);
            setQuestions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // 只在搜索完成、有结果、且是新查询时才生成questions
        if (!searchLoading && query && results && results.length > 0 && query !== lastGeneratedQuery) {
            console.log('Generating People Also Ask for query:', query);
            setLastGeneratedQuery(query);
            generateQuestions();
        }
    }, [searchLoading, query]);  // ✅ 只依赖 query 和 loading，避免重复

    if (!query || !results || results.length === 0) return null;

    return (
        <Paper sx={{
            p: 2,
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(10px)'
        }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                <HelpOutlineIcon color="primary" fontSize="small" />
                <Typography variant="h6" fontWeight="600">
                    People also ask
                </Typography>
            </Stack>

            {loading ? (
                <Stack spacing={1.5}>
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton
                            key={i}
                            variant="text"
                            height={40}
                            sx={{ borderRadius: 1 }}
                        />
                    ))}
                </Stack>
            ) : questions.length > 0 ? (
                <Stack spacing={0}>
                    {questions.map((question, i) => (
                        <Box
                            key={i}
                            sx={{
                                py: 1.5,
                                borderBottom: i < questions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    color: 'primary.main',
                                    pl: 1,
                                    bgcolor: 'rgba(16, 185, 129, 0.05)'
                                }
                            }}
                            onClick={() => {
                                if (onQuestionClick) {
                                    onQuestionClick(question);
                                }
                            }}
                        >
                            <Typography variant="body2" lineHeight={1.6}>
                                {question}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            ) : (
                <Typography variant="body2" color="text.secondary">
                    No related questions available.
                </Typography>
            )}
        </Paper>
    );
};

export default PeopleAlsoAsk;

