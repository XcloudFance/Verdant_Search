import React, { useState, useEffect, useRef } from 'react';
import { AppBar, Toolbar, Typography, InputBase, IconButton, Avatar, Box, Menu, MenuItem, Button, Popper, Paper, List, ListItem, ListItemText, ListItemIcon, Fade, ClickAwayListener } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';

import AppsIcon from '@mui/icons-material/Apps';
import FilterListIcon from '@mui/icons-material/FilterList';
import SpaIcon from '@mui/icons-material/Spa';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Search = styled('div')(({ theme }) => ({
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(theme.palette.common.white, 0.15),
    '&:hover': {
        backgroundColor: alpha(theme.palette.common.white, 0.25),
    },
    marginRight: theme.spacing(2),
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
        marginLeft: theme.spacing(3),
        width: 'auto',
    },
    display: 'flex',
    alignItems: 'center',
    border: `1px solid ${theme.palette.divider}`,
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
    padding: theme.spacing(0, 2),
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.text.secondary,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
    color: 'inherit',
    '& .MuiInputBase-input': {
        padding: theme.spacing(1, 1, 1, 0),
        paddingLeft: `calc(1em + ${theme.spacing(4)})`,
        transition: theme.transitions.create('width'),
        width: '100%',
        [theme.breakpoints.up('md')]: {
            width: '40ch',
        },
    },
}));

const Navbar = ({ initialQuery = '' }) => {
    const [query, setQuery] = useState(initialQuery);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef(null);
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);

    useEffect(() => {
        setQuery(initialQuery);
    }, [initialQuery]);

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
                }
            } catch (e) {
                console.error("Failed to fetch suggestions", e);
            }
        };

        const timer = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSearch = (e) => {
        if (e.key === 'Enter' && query.trim()) {
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
                    setQuery("[Image Search]");
                    setShowSuggestions(false);
                } else {
                    console.error("Image search failed:", response.statusText);
                }
            } catch (error) {
                console.error("Image search error", error);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        logout();
        handleClose();
        navigate('/login');
    };

    return (
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(15, 23, 42, 0.8)' }}>
            <Toolbar>
                <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mr: 2 }} onClick={() => navigate('/')}>
                    <SpaIcon sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography variant="h6" noWrap component="div" sx={{ fontFamily: 'Outfit', fontWeight: 700, display: { xs: 'none', sm: 'block' } }}>
                        Verdant
                    </Typography>
                </Box>

                <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
                    <Box sx={{ position: 'relative' }}>
                        <Search ref={searchRef}>
                            <SearchIconWrapper>
                                <SearchIcon />
                            </SearchIconWrapper>
                            <StyledInputBase
                                placeholder="Search or upload image..."
                                inputProps={{ 'aria-label': 'search' }}
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    if (e.target.value.trim()) setShowSuggestions(true);
                                }}
                                onFocus={() => {
                                    if (query.trim() && suggestions.length > 0) setShowSuggestions(true);
                                }}
                                onKeyPress={handleSearch}
                            />
                            {/* Image Upload Button */}
                            <input
                                accept="image/*"
                                style={{ display: 'none' }}
                                id="icon-button-file"
                                type="file"
                                onChange={handleImageUpload}
                            />
                            <label htmlFor="icon-button-file">
                                <IconButton color="primary" aria-label="upload picture" component="span" sx={{ p: '10px', mr: 0.5 }}>
                                    <ImageIcon />
                                </IconButton>
                            </label>
                        </Search>
                        <Popper
                            open={showSuggestions && suggestions.length > 0}
                            anchorEl={searchRef.current}
                            placement="bottom-start"
                            transition
                            style={{ zIndex: 1300, width: searchRef.current?.clientWidth }}
                        >
                            {({ TransitionProps }) => (
                                <Fade {...TransitionProps} timeout={200}>
                                    <Paper sx={{
                                        mt: 1,
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                                        bgcolor: 'background.paper',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <List dense>
                                            {suggestions.map((s, i) => (
                                                <ListItem
                                                    button
                                                    key={i}
                                                    onClick={() => handleSuggestionClick(s)}
                                                    sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                                                >
                                                    <ListItemIcon sx={{ minWidth: 36 }}>
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

                <Box sx={{ flexGrow: 1 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton size="large" color="inherit">
                        <AppsIcon />
                    </IconButton>

                    {user ? (
                        <>
                            <IconButton
                                size="large"
                                edge="end"
                                aria-label="account of current user"
                                aria-controls="menu-appbar"
                                aria-haspopup="true"
                                onClick={handleMenu}
                                color="inherit"
                            >
                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>{user.avatar}</Avatar>
                            </IconButton>
                            <Menu
                                id="menu-appbar"
                                anchorEl={anchorEl}
                                anchorOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                keepMounted
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                open={Boolean(anchorEl)}
                                onClose={handleClose}
                            >
                                <MenuItem onClick={() => { navigate('/history'); handleClose(); }}>Search History</MenuItem>
                                <MenuItem onClick={handleLogout}>Logout</MenuItem>
                            </Menu>
                        </>
                    ) : (
                        <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;
