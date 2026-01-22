import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, InputBase, IconButton, Stack, Chip, Button, Avatar, Menu, MenuItem, Popper, Paper, List, ListItem, ListItemText, ListItemIcon, Fade, ClickAwayListener } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import MicIcon from '@mui/icons-material/Mic';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ImageIcon from '@mui/icons-material/Image';
import SpaIcon from '@mui/icons-material/Spa';
import CodeIcon from '@mui/icons-material/Code';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FlightIcon from '@mui/icons-material/Flight';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import AppsIcon from '@mui/icons-material/Apps';
import HistoryIcon from '@mui/icons-material/History';
import { useNavigate } from 'react-router-dom';
import AmbientBackground from '../components/common/AmbientBackground';
import { useAuth } from '../context/AuthContext';
import AnimatedPage from '../components/layout/AnimatedPage';

const SearchBar = styled('div')(({ theme }) => ({
    position: 'relative',
    borderRadius: 24,
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    backdropFilter: 'blur(12px)',
    border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
    '&:hover': {
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.2)}`,
        borderColor: theme.palette.primary.main,
    },
    marginRight: 0,
    marginLeft: 0,
    width: '100%',
    maxWidth: '680px',
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1, 2),
    transition: 'all 0.3s ease',
    boxShadow: theme.shadows[4],
}));

const StyledInput = styled(InputBase)(({ theme }) => ({
    flex: 1,
    marginLeft: theme.spacing(2),
    color: 'inherit',
    fontSize: '1.1rem',
}));

const Home = () => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchBarRef = useRef(null);
    const [appsAnchor, setAppsAnchor] = useState(null);
    const [userAnchor, setUserAnchor] = useState(null);
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (!query.trim()) {
                setSuggestions([]);
                return;
            }
            try {
                const res = await fetch(`http://localhost:8001/api/suggestions?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setSuggestions(data.suggestions || []);
                    setShowSuggestions(true);
                }
            } catch (e) {
                console.error("Failed to fetch suggestions", e);
            }
        };

        const timer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSearch = (e) => {
        if ((e.key === 'Enter' || e.type === 'click') && query.trim()) {
            navigate(`/results?q=${encodeURIComponent(query)}&page=1&page_size=10`);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setQuery(suggestion);
        navigate(`/results?q=${encodeURIComponent(suggestion)}&page=1&page_size=10`);
        setShowSuggestions(false);
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;

            try {
                // Use python backend port 8001
                const response = await fetch('http://localhost:8001/api/search/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64String, top_k: 10 })
                });

                if (response.ok) {
                    const data = await response.json();

                    navigate('/results?q=[Image Search]', {
                        state: {
                            imageSearch: true,
                            results: data.results,
                            total: data.total,
                            totalPages: data.total_pages,
                            previewImage: base64String
                        }
                    });
                } else {
                    console.error("Image search failed:", response.statusText);
                }
            } catch (error) {
                console.error("Image search error", error);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleLogout = () => {
        logout();
        setUserAnchor(null);
        navigate('/login');
    };

    const quickLinks = [
        { icon: <CodeIcon />, label: 'Coding' },
        { icon: <TrendingUpIcon />, label: 'Finance' },
        { icon: <FlightIcon />, label: 'Travel' },
        { icon: <NewspaperIcon />, label: 'News' },
    ];

    return (
        <AnimatedPage>
            <Box sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                p: 2
            }}>
                <AmbientBackground />

                {/* Top Header Bar */}
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    p: 2,
                    gap: 2
                }}>
                    {/* Apps Menu */}
                    <IconButton
                        sx={{
                            color: 'text.secondary',
                            '&:hover': {
                                bgcolor: 'rgba(255,255,255,0.1)',
                                color: 'primary.main'
                            }
                        }}
                        onClick={(e) => setAppsAnchor(e.currentTarget)}
                    >
                        <AppsIcon />
                    </IconButton>
                    <Menu
                        anchorEl={appsAnchor}
                        open={Boolean(appsAnchor)}
                        onClose={() => setAppsAnchor(null)}
                        PaperProps={{
                            sx: {
                                mt: 1,
                                bgcolor: 'background.paper',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }
                        }}
                    >
                        <MenuItem onClick={() => { navigate('/'); setAppsAnchor(null); }}>
                            <SpaIcon sx={{ mr: 2, color: 'primary.main' }} /> Search
                        </MenuItem>
                        <MenuItem onClick={() => { navigate('/history'); setAppsAnchor(null); }}>
                            <HistoryIcon sx={{ mr: 2, color: 'primary.main' }} /> History
                        </MenuItem>
                    </Menu>

                    {/* User Avatar or Login */}
                    {user ? (
                        <>
                            <IconButton
                                onClick={(e) => setUserAnchor(e.currentTarget)}
                                sx={{ p: 0 }}
                            >
                                <Avatar
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        bgcolor: 'primary.main',
                                        border: '2px solid rgba(255,255,255,0.2)',
                                        fontWeight: 'bold',
                                        fontSize: '1.2rem'
                                    }}
                                >
                                    {user.avatar}
                                </Avatar>
                            </IconButton>
                            <Menu
                                anchorEl={userAnchor}
                                open={Boolean(userAnchor)}
                                onClose={() => setUserAnchor(null)}
                                PaperProps={{
                                    sx: {
                                        mt: 1,
                                        minWidth: 200,
                                        bgcolor: 'background.paper',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }
                                }}
                            >
                                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <Typography variant="subtitle1" fontWeight="bold">{user.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                                </Box>
                                <MenuItem onClick={() => { navigate('/history'); setUserAnchor(null); }}>
                                    Search History
                                </MenuItem>
                                <MenuItem onClick={handleLogout}>
                                    Logout
                                </MenuItem>
                            </Menu>
                        </>
                    ) : (
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => navigate('/login')}
                            sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': {
                                    bgcolor: 'primary.main',
                                    color: 'white'
                                }
                            }}
                        >
                            Login
                        </Button>
                    )}
                </Box>

                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100%',
                    maxWidth: '800px',
                    mb: 8
                }}>
                    {/* Brand */}
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 6 }}>
                        <SpaIcon sx={{ fontSize: 60, color: 'primary.main', filter: 'drop-shadow(0 0 15px rgba(16,185,129,0.4))' }} />
                        <Typography variant="h1" sx={{
                            fontSize: '4rem',
                            background: 'linear-gradient(135deg, #fff 0%, #cbd5e1 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>
                            Verdant
                        </Typography>
                    </Stack>

                    {/* Search Bar */}
                    <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
                        <Box sx={{ width: '100%', maxWidth: '680px', position: 'relative' }}>
                            <SearchBar ref={searchBarRef}>
                                <SearchIcon sx={{ color: 'text.secondary', fontSize: 28 }} />
                                <StyledInput
                                    placeholder="Ask anything..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyPress={handleSearch}
                                    onFocus={() => {
                                        if (suggestions.length > 0) setShowSuggestions(true);
                                    }}
                                    autoFocus
                                />
                                <Stack direction="row" spacing={1}>
                                    <IconButton size="small" sx={{ color: 'text.secondary' }}><MicIcon /></IconButton>
                                    <input
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        id="home-image-upload"
                                        type="file"
                                        onChange={handleImageUpload}
                                    />
                                    <label htmlFor="home-image-upload">
                                        <IconButton
                                            size="small"
                                            component="span"
                                            sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                                        >
                                            <ImageIcon />
                                        </IconButton>
                                    </label>
                                </Stack>
                            </SearchBar>

                            <Popper
                                open={showSuggestions && suggestions.length > 0}
                                anchorEl={searchBarRef.current}
                                placement="bottom-start"
                                transition
                                style={{ width: searchBarRef.current?.clientWidth, zIndex: 1300 }}
                            >
                                {({ TransitionProps }) => (
                                    <Fade {...TransitionProps} timeout={200}>
                                        <Paper sx={{
                                            mt: 1,
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                            bgcolor: 'background.paper',
                                            border: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <List>
                                                {suggestions.map((s, i) => (
                                                    <ListItem
                                                        button
                                                        key={i}
                                                        onClick={() => handleSuggestionClick(s)}
                                                        sx={{
                                                            '&:hover': { bgcolor: 'action.hover' }
                                                        }}
                                                    >
                                                        <ListItemIcon sx={{ minWidth: 40 }}>
                                                            <SearchIcon fontSize="small" color="action" />
                                                        </ListItemIcon>
                                                        <ListItemText primary={s} />
                                                    </ListItem>
                                                ))}
                                            </List>
                                        </Paper>
                                    </Fade>
                                )}
                            </Popper>
                        </Box>
                    </ClickAwayListener>

                    {/* Quick Links */}
                    <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
                        {quickLinks.map((link) => (
                            <Chip
                                key={link.label}
                                icon={link.icon}
                                label={link.label}
                                onClick={() => navigate(`/results?q=${link.label}&page=1&page_size=10`)}
                                sx={{
                                    bgcolor: 'background.paper',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main', transform: 'translateY(-2px)' },
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }}
                            />
                        ))}
                    </Stack>
                </Box>

                <Box component="footer" sx={{ position: 'absolute', bottom: 20, width: '100%', display: 'flex', justifyContent: 'center', gap: 4, color: 'text.secondary', fontSize: '0.9rem' }}>
                    <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }}>About</Typography>
                    <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }}>Privacy</Typography>
                    <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }}>Terms</Typography>
                </Box>
            </Box>
        </AnimatedPage>
    );
};

export default Home;
