import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, Tabs, Tab, Paper, Stack, Button, Skeleton, Pagination, IconButton } from '@mui/material';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
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

    // 搜索历史栈
    const [searchHistory, setSearchHistory] = useState([]);
    const [canGoBack, setCanGoBack] = useState(false);

    const { addToHistory } = useHistory();

    // 处理点击问题 - 触发新搜索
    const handleQuestionClick = (question) => {
        console.log('Question clicked, starting new search:', question);

        // 保存当前搜索到历史
        if (query) {
            setSearchHistory(prev => [...prev, { query, results, page: currentPage }]);
            setCanGoBack(true);
        }

        // 触发新搜索
        navigate(`/results?q=${encodeURIComponent(question)}`);
    };

    // 返回上一次搜索
    const handleGoBack = () => {
        if (searchHistory.length > 0) {
            const previous = searchHistory[searchHistory.length - 1];
            setSearchHistory(prev => prev.slice(0, -1));
            setCanGoBack(searchHistory.length > 1);

            // 恢复上一次搜索
            navigate(`/results?q=${encodeURIComponent(previous.query)}&page=${previous.page || 1}`);
        }
    };

    useEffect(() => {
        const fetchResults = async () => {
            // 优先检查是否有图片搜索结果（通过 state 传递）
            if (location.state?.imageSearch && location.state?.results) {
                console.log('Using image search results from state');
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

            console.log('Fetching results:', { query, currentPage, pageSize });
            setLoading(true);

            try {
                // 指向 Python 后端 (8001)，使用 POST 方法
                const url = `http://localhost:8001/api/search`;
                console.log('Fetch URL:', url, 'Method: POST');

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: query,
                        page: currentPage,
                        page_size: pageSize
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('Search response:', {
                        resultsCount: data.results?.length || 0,
                        total: data.total,
                        page: data.page,
                        totalPages: data.total_pages
                    });

                    setResults(data.results || []);
                    setTotal(data.total || 0);
                    setTotalPages(data.total_pages || 0);
                } else {
                    console.error('Search failed with status:', response.status);
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

                // Add to history only on first page
                if (currentPage === 1 && query && query !== '[Image Search]') {
                    addToHistory(query);
                }
            }
        };

        fetchResults();
    }, [query, currentPage, pageSize]);  // ✅ 移除 addToHistory，避免无限循环

    const handlePageChange = (event, value) => {
        // 更新URL参数
        const params = new URLSearchParams(searchParams);
        params.set('page', value);
        navigate(`/results?${params.toString()}`);
        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

                <Container maxWidth="xl" sx={{ display: 'flex', mt: 4, gap: 4 }}>
                    {/* Main Results */}
                    <Box sx={{ flex: 2, maxWidth: '800px', ml: { md: 10 } }}>

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
                                    返回上一次搜索
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
                                找到约 {total} 条结果 (第 {currentPage} 页，共 {totalPages} 页)
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
                                                display: 'block',
                                                mb: 1
                                            }}
                                        >
                                            {item.title}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {item.snippet}
                                        </Typography>

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
                                        没有找到相关结果
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" mt={1}>
                                        尝试使用不同的关键词搜索
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
                                            '&:hover': {
                                                bgcolor: 'rgba(16, 185, 129, 0.1)',
                                            },
                                        },
                                        '& .Mui-selected': {
                                            bgcolor: 'primary.main',
                                            color: 'white',
                                            '&:hover': {
                                                bgcolor: 'primary.dark',
                                            },
                                        },
                                    }}
                                />
                            </Box>
                        )}

                    </Box>

                    {/* Sidebar */}
                    <Box sx={{ flex: 1, display: { xs: 'none', lg: 'block' }, maxWidth: '400px' }}>
                        <PeopleAlsoAsk
                            query={query}
                            results={results}
                            searchLoading={loading}
                            onQuestionClick={handleQuestionClick}
                        />
                    </Box>
                </Container>

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
