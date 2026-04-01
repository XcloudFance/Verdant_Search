import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Paper, List, ListItem, ListItemText,
  IconButton, Button, Stack, TextField, InputAdornment, Collapse,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import Navbar from '../components/layout/Navbar';
import AmbientBackground from '../components/common/AmbientBackground';
import { useHistory } from '../context/HistoryContext';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/layout/AnimatedPage';
import { GO_API } from '../config';

const History = () => {
    const { clearHistory, removeFromHistory } = useHistory();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [q, setQ] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const fetchFiltered = useCallback(async () => {
        const token = localStorage.getItem('verdant_token');
        if (!token) return;
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        try {
            const res = await fetch(`${GO_API}/api/history?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setItems(await res.json() || []);
        } catch (e) {
            console.error('Failed to fetch history:', e);
        }
    }, [q, from, to]);

    useEffect(() => {
        fetchFiltered();
    }, [fetchFiltered]);

    const handleClearAll = async () => {
        await clearHistory();
        setItems([]);
    };

    const handleRemove = async (id) => {
        await removeFromHistory(id);
        setItems(prev => prev.filter(i => i.id !== id));
    };

    return (
        <AnimatedPage>
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                <AmbientBackground />
                <Navbar />

                <Container maxWidth="md" sx={{ mt: 8 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <HistoryIcon color="primary" fontSize="large" />
                            <Typography variant="h4" fontWeight="bold">Search History</Typography>
                        </Stack>
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="outlined"
                                startIcon={<FilterListIcon />}
                                onClick={() => setShowFilters(v => !v)}
                                sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'text.secondary' }}
                            >
                                Filter
                            </Button>
                            {items.length > 0 && (
                                <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleClearAll}>
                                    Clear All
                                </Button>
                            )}
                        </Stack>
                    </Stack>

                    {/* Search + date filters */}
                    <Collapse in={showFilters}>
                        <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'rgba(30,41,59,0.5)', backdropFilter: 'blur(10px)' }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    size="small"
                                    placeholder="Search queries…"
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ flex: 1 }}
                                />
                                <TextField
                                    size="small"
                                    label="From"
                                    type="date"
                                    value={from}
                                    onChange={e => setFrom(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ minWidth: 150 }}
                                />
                                <TextField
                                    size="small"
                                    label="To"
                                    type="date"
                                    value={to}
                                    onChange={e => setTo(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ minWidth: 150 }}
                                />
                                <Button
                                    variant="text"
                                    onClick={() => { setQ(''); setFrom(''); setTo(''); }}
                                    sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                                >
                                    Clear filters
                                </Button>
                            </Stack>
                        </Paper>
                    </Collapse>

                    <Paper sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)' }}>
                        {items.length === 0 ? (
                            <Box sx={{ p: 8, textAlign: 'center', color: 'text.secondary' }}>
                                <Typography variant="h6">No results</Typography>
                                <Typography variant="body2">
                                    {q || from || to ? 'No history matches your filters.' : 'Your past searches will appear here.'}
                                </Typography>
                            </Box>
                        ) : (
                            <List>
                                {items.map((item) => (
                                    <ListItem
                                        key={item.id}
                                        secondaryAction={
                                            <IconButton edge="end" aria-label="delete" onClick={() => handleRemove(item.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        }
                                        sx={{
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                                        }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Typography
                                                    variant="body1"
                                                    sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                                                    onClick={() => navigate(`/results?q=${encodeURIComponent(item.query)}`)}
                                                >
                                                    {item.query}
                                                </Typography>
                                            }
                                            secondary={new Date(item.timestamp).toLocaleString()}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Paper>
                </Container>
            </Box>
        </AnimatedPage>
    );
};

export default History;
