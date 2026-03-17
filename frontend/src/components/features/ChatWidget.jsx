import React, { useState, useRef, useEffect } from 'react';
import {
    Box, Paper, IconButton, TextField, Typography, Stack, Fade, CircularProgress,
    Avatar, Chip, Tooltip, Divider
} from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import MinimizeIcon from '@mui/icons-material/Minimize';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import DataObjectIcon from '@mui/icons-material/DataObject';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useNavigate } from 'react-router-dom';

const ChatWidget = ({ query, results, externalQuestion, onQuestionSent }) => {
    const resultsRef = useRef(results);

    useEffect(() => {
        resultsRef.current = results;
    }, [results]);

    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [refining, setRefining] = useState(false);
    const [showPromptView, setShowPromptView] = useState(false);
    const [capturedPrompt, setCapturedPrompt] = useState(null);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (query) {
            setCapturedPrompt(null);
            setShowPromptView(false);
            if (results && results.length > 0) {
                setMessages([{
                    role: 'assistant',
                    content: `Hi! I can help you understand the search results for "${query}". What would you like to know?`
                }]);
            } else {
                setMessages([{
                    role: 'assistant',
                    content: `Hi! I'm here to help. You can ask me anything!`
                }]);
            }
        }
    }, [query]);

    useEffect(() => {
        if (externalQuestion) {
            setOpen(true);
            setMinimized(false);
            setInput(externalQuestion);
            setTimeout(() => {
                sendMessageWithText(externalQuestion);
                if (onQuestionSent) onQuestionSent();
            }, 300);
        }
    }, [externalQuestion]);

    const sendMessageWithText = async (messageText) => {
        if (!messageText || !messageText.trim() || loading) return;

        const userMessage = messageText.trim();
        setInput('');

        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const history = messages
                .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && !msg.content.includes('Hi!')))
                .map(msg => ({ role: msg.role, content: msg.content }));

            const currentResults = resultsRef.current;
            const isFirst = history.length === 0;

            // Extract document IDs — only needed on first message
            const documentIds = isFirst && currentResults?.length > 0
                ? currentResults.map(r => r.id || r.Id).filter(id => id != null)
                : [];

            // Fallback snippet results (used if document_ids is empty)
            const mappedResults = isFirst && currentResults?.length > 0
                ? currentResults.map(r => ({
                    title: r.title || r.Title || '',
                    url: r.url || r.URL || '',
                    snippet: r.snippet || r.Snippet || '',
                }))
                : [];

            const payload = {
                message: userMessage,
                query: query || 'general',
                history: history,
                ...(isFirst && {
                    document_ids: documentIds,
                    results: mappedResults,
                }),
            };

            const response = await fetch('http://localhost:8001/api/llm/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Chat request failed');

            const data = await response.json();

            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);

            if (data.debug_prompt && !capturedPrompt) {
                setCapturedPrompt(data.debug_prompt);
            }

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;
        await sendMessageWithText(input);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const refineAndSearch = async () => {
        if (refining || !query) return;
        setRefining(true);
        try {
            const history = messages
                .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && !msg.content.includes('Hi!')))
                .map(msg => ({ role: msg.role, content: msg.content }));

            const response = await fetch('http://localhost:8001/api/llm/refine-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ original_query: query, chat_history: history }),
            });

            if (!response.ok) throw new Error('Query refinement failed');

            const data = await response.json();
            navigate(`/results?q=${encodeURIComponent(data.refined_query)}&page=1&page_size=10`);

        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error refining search: ${error.message}. Please try again.`
            }]);
        } finally {
            setRefining(false);
        }
    };

    const canRefine = !refining && query;

    if (!open) {
        return (
            <IconButton
                onClick={() => setOpen(true)}
                sx={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    width: 60,
                    height: 60,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                    boxShadow: 4,
                    zIndex: 1000,
                }}
            >
                <ChatIcon />
            </IconButton>
        );
    }

    const widgetWidth = expanded ? 800 : (minimized ? 320 : 400);
    const widgetHeight = expanded ? '90vh' : (minimized ? 60 : 600);

    return (
        <Fade in={open}>
            <Paper sx={{
                position: 'fixed',
                bottom: minimized ? 'auto' : (expanded ? '5vh' : 24),
                right: expanded ? '50%' : 24,
                transform: expanded ? 'translateX(50%)' : 'none',
                width: widgetWidth,
                height: widgetHeight,
                display: 'flex',
                flexDirection: 'column',
                boxShadow: expanded ? 12 : 6,
                borderRadius: 3,
                overflow: 'hidden',
                zIndex: 1000,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
                {/* Header */}
                <Box sx={{
                    p: 2,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <SmartToyIcon />
                        <Typography variant="h6" fontWeight="bold">AI Assistant</Typography>
                        <Chip
                            label={`${resultsRef.current?.length || 0} res`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', ml: 1 }}
                        />
                        {capturedPrompt && (
                            <Chip
                                label="prompt"
                                size="small"
                                sx={{
                                    bgcolor: showPromptView
                                        ? 'rgba(255,255,255,0.9)'
                                        : 'rgba(255,255,255,0.15)',
                                    color: showPromptView ? '#059669' : 'white',
                                    fontSize: '0.65rem',
                                    height: 18,
                                    cursor: 'pointer',
                                }}
                                onClick={() => setShowPromptView(v => !v)}
                            />
                        )}
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                        {/* Prompt viewer toggle */}
                        <Tooltip title={capturedPrompt ? (showPromptView ? "Back to chat" : "View prompt") : "Send first message to capture prompt"} arrow>
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => setShowPromptView(v => !v)}
                                    disabled={!capturedPrompt}
                                    sx={{
                                        color: showPromptView ? '#fbbf24' : 'white',
                                        opacity: capturedPrompt ? 1 : 0.35,
                                    }}
                                >
                                    {showPromptView
                                        ? <ChatBubbleOutlineIcon fontSize="small" />
                                        : <DataObjectIcon fontSize="small" />
                                    }
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={expanded ? "Shrink" : "Expand"} arrow>
                            <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: 'white' }}>
                                {expanded ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => setMinimized(!minimized)} sx={{ color: 'white' }}>
                            <MinimizeIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'white' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                </Box>

                {!minimized && (
                    <>
                        {/* Main content area — Chat or Prompt View */}
                        {showPromptView && capturedPrompt ? (
                            <Box sx={{
                                flex: 1,
                                overflowY: 'auto',
                                bgcolor: '#0d1117',
                                display: 'flex',
                                flexDirection: 'column',
                            }}>
                                {/* Prompt view header bar */}
                                <Box sx={{
                                    px: 2,
                                    py: 1,
                                    bgcolor: '#161b22',
                                    borderBottom: '1px solid #30363d',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    flexShrink: 0,
                                }}>
                                    <DataObjectIcon sx={{ color: '#58a6ff', fontSize: 16 }} />
                                    <Typography variant="caption" sx={{ color: '#58a6ff', fontFamily: 'monospace', fontWeight: 600 }}>
                                        PROMPT ENGINEERING — TURN 1
                                    </Typography>
                                    <Box sx={{ flex: 1 }} />
                                    <Chip
                                        label={`${capturedPrompt.length} chars`}
                                        size="small"
                                        sx={{ bgcolor: '#21262d', color: '#8b949e', fontSize: '0.6rem', height: 16 }}
                                    />
                                </Box>

                                {/* Prompt sections */}
                                <Box sx={{ p: 2, flex: 1 }}>
                                    {capturedPrompt.split(/(\[SYSTEM\]|\[USER — Turn 1\][^\n]*)/).filter(Boolean).map((part, i) => {
                                        if (part.startsWith('[SYSTEM]')) {
                                            return (
                                                <Box key={i} sx={{ mb: 2 }}>
                                                    <Typography variant="caption" sx={{
                                                        color: '#f0883e',
                                                        fontFamily: 'monospace',
                                                        fontWeight: 700,
                                                        display: 'block',
                                                        mb: 0.5,
                                                    }}>
                                                        ● SYSTEM
                                                    </Typography>
                                                </Box>
                                            );
                                        }
                                        if (part.match(/^\[USER — Turn 1\]/)) {
                                            return (
                                                <Box key={i} sx={{ mb: 1 }}>
                                                    <Typography variant="caption" sx={{
                                                        color: '#3fb950',
                                                        fontFamily: 'monospace',
                                                        fontWeight: 700,
                                                        display: 'block',
                                                        mb: 0.5,
                                                    }}>
                                                        ● USER — TURN 1
                                                    </Typography>
                                                    {part.includes('image') && (
                                                        <Box sx={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 0.5,
                                                            bgcolor: '#1f2937',
                                                            border: '1px solid #374151',
                                                            borderRadius: 1,
                                                            px: 1,
                                                            py: 0.3,
                                                            mb: 1,
                                                        }}>
                                                            <Typography variant="caption" sx={{ color: '#a78bfa', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                                                {part.match(/\[([^\]]+image[^\]]*)\]/i)?.[0] || ''}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                            );
                                        }
                                        // Body text
                                        return (
                                            <Box key={i} sx={{
                                                bgcolor: '#161b22',
                                                border: '1px solid #30363d',
                                                borderRadius: 1,
                                                p: 1.5,
                                                mb: 2,
                                            }}>
                                                <pre style={{
                                                    margin: 0,
                                                    color: '#e6edf3',
                                                    fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
                                                    fontSize: 11,
                                                    lineHeight: 1.6,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}>
                                                    {part.trim()}
                                                </pre>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        ) : (
                            /* Chat messages */
                            <Box sx={{
                                flex: 1,
                                overflowY: 'auto',
                                p: 2,
                                bgcolor: 'background.default',
                            }}>
                                <Stack spacing={2}>
                                    {messages.map((message, index) => (
                                        <Stack
                                            key={index}
                                            direction="row"
                                            spacing={1}
                                            justifyContent={message.role === 'user' ? 'flex-end' : 'flex-start'}
                                        >
                                            {message.role === 'assistant' && (
                                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                                    <SmartToyIcon fontSize="small" />
                                                </Avatar>
                                            )}
                                            <Paper sx={{
                                                p: 1.5,
                                                maxWidth: '75%',
                                                bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                                                color: message.role === 'user' ? 'white' : 'text.primary',
                                            }}>
                                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                                    {message.content}
                                                </Typography>
                                            </Paper>
                                            {message.role === 'user' && (
                                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                                                    <PersonIcon fontSize="small" />
                                                </Avatar>
                                            )}
                                        </Stack>
                                    ))}
                                    {loading && (
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                                <SmartToyIcon fontSize="small" />
                                            </Avatar>
                                            <CircularProgress size={20} />
                                        </Stack>
                                    )}
                                    <div ref={messagesEndRef} />
                                </Stack>
                            </Box>
                        )}

                        {/* Input bar — always visible */}
                        <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder={results?.length > 0 ? "Ask about these results..." : "Ask me anything..."}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={loading}
                                    multiline
                                    maxRows={3}
                                    autoFocus
                                />
                                <Tooltip title={refining ? "Refining..." : (!query ? "No active query" : "Refine search")} arrow>
                                    <span>
                                        <IconButton
                                            color="secondary"
                                            onClick={refineAndSearch}
                                            disabled={!canRefine}
                                            sx={{
                                                bgcolor: 'rgba(139, 92, 246, 0.1)',
                                                '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.2)' },
                                                '&:disabled': { opacity: 0.5 },
                                            }}
                                        >
                                            {refining ? <CircularProgress size={20} color="inherit" /> : <AutoFixHighIcon />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <IconButton
                                    color="primary"
                                    onClick={sendMessage}
                                    disabled={!input.trim() || loading}
                                >
                                    <SendIcon />
                                </IconButton>
                            </Stack>
                        </Box>
                    </>
                )}
            </Paper>
        </Fade>
    );
};

export default ChatWidget;
