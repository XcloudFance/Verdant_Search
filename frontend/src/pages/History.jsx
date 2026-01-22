import React from 'react';
import { Box, Container, Typography, Paper, List, ListItem, ListItemText, IconButton, Button, Stack } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import Navbar from '../components/layout/Navbar';
import AmbientBackground from '../components/common/AmbientBackground';
import { useHistory } from '../context/HistoryContext';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../components/layout/AnimatedPage';

const History = () => {
    const { history, clearHistory, removeFromHistory } = useHistory();
    const navigate = useNavigate();

    return (
        <AnimatedPage>
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                <AmbientBackground />
                <Navbar />

                <Container maxWidth="md" sx={{ mt: 8 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <HistoryIcon color="primary" fontSize="large" />
                            <Typography variant="h4" fontWeight="bold">Search History</Typography>
                        </Stack>
                        {history.length > 0 && (
                            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={clearHistory}>
                                Clear All
                            </Button>
                        )}
                    </Stack>

                    <Paper sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(30, 41, 59, 0.5)', backdropFilter: 'blur(10px)' }}>
                        {history.length === 0 ? (
                            <Box sx={{ p: 8, textAlign: 'center', color: 'text.secondary' }}>
                                <Typography variant="h6">No search history yet</Typography>
                                <Typography variant="body2">Your past searches will appear here.</Typography>
                            </Box>
                        ) : (
                            <List>
                                {history.map((item) => (
                                    <ListItem
                                        key={item.id}
                                        secondaryAction={
                                            <IconButton edge="end" aria-label="delete" onClick={() => removeFromHistory(item.id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        }
                                        sx={{
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
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
