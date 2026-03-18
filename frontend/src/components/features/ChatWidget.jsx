import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import AddCommentIcon from '@mui/icons-material/AddComment';
import { useNavigate } from 'react-router-dom';

// ── helpers ─────────────────────────────────────────────────────────────────
const API = 'http://localhost:8001';

function formatRelativeTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 2)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

// ── component ────────────────────────────────────────────────────────────────
const ChatWidget = ({ query, results, externalQuestion, onQuestionSent }) => {
    const resultsRef = useRef(results);
    useEffect(() => { resultsRef.current = results; }, [results]);

    // ── state ────────────────────────────────────────────────────────────────
    const [open, setOpen]               = useState(false);
    const [minimized, setMinimized]     = useState(false);
    const [expanded, setExpanded]       = useState(false);
    const [messages, setMessages]       = useState([]);
    const [chatHistory, setChatHistory] = useState([]); // only user/assistant turns sent to AI
    const [input, setInput]             = useState('');
    const [loading, setLoading]         = useState(false);
    const [refining, setRefining]       = useState(false);
    const [showPromptView, setShowPromptView] = useState(false);
    const [capturedPrompt, setCapturedPrompt] = useState(null);
    const [sessionInfo, setSessionInfo] = useState(null);   // { session_key, created_at, last_updated, message_count, ttl_seconds }
    const [sessionLoaded, setSessionLoaded] = useState(false);

    const scrollContainerRef = useRef(null);
    const navigate = useNavigate();

    // ── scroll ───────────────────────────────────────────────────────────────
    const scrollToBottom = useCallback(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages]);

    // ── session helpers ───────────────────────────────────────────────────────
    const saveSession = useCallback(async (q, history) => {
        if (!q || history.length === 0) return;
        try {
            await fetch(`${API}/api/chat/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q, history }),
            });
        } catch (_) {}
    }, []);

    const loadSession = useCallback(async (q) => {
        if (!q) return null;
        try {
            const res = await fetch(`${API}/api/chat/session?query=${encodeURIComponent(q)}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (_) { return null; }
    }, []);

    // ── reset + session load on query change ─────────────────────────────────
    useEffect(() => {
        if (!query) return;

        setCapturedPrompt(null);
        setShowPromptView(false);
        setSessionInfo(null);
        setSessionLoaded(false);

        loadSession(query).then(session => {
            if (session?.found && session.history?.length > 0) {
                // Restore previous session
                setSessionInfo(session);
                setChatHistory(session.history);

                const restored = session.history.map(m => ({
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content
                        : m.content?.find?.(c => c.type === 'text')?.text || '',
                }));

                const welcomeBack = {
                    role: 'system',
                    content: `👋 **Welcome back!**  Session \`${session.session_key}\` resumed.\n\n` +
                        `_${session.message_count} previous exchange${session.message_count !== 1 ? 's' : ''} · ` +
                        `last active ${formatRelativeTime(session.last_updated)}_`,
                };

                setMessages([welcomeBack, ...restored]);
                setSessionLoaded(true);
            } else {
                // Fresh session
                setChatHistory([]);
                setMessages([{
                    role: 'assistant',
                    content: results?.length > 0
                        ? `Hi! I can help you understand the search results for "${query}". What would you like to know?`
                        : `Hi! I'm here to help. You can ask me anything!`,
                }]);
                setSessionInfo(session?.session_key ? { session_key: session.session_key } : null);
            }
        });
    }, [query]);

    // ── external question (People Also Ask) ──────────────────────────────────
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

    // ── send ─────────────────────────────────────────────────────────────────
    const sendMessageWithText = async (messageText) => {
        if (!messageText?.trim() || loading) return;

        const userMessage = messageText.trim();
        setInput('');

        const newUserMsg = { role: 'user', content: userMessage };
        setMessages(prev => [...prev, newUserMsg]);
        setLoading(true);

        try {
            // isFirst: no previous actual user/assistant exchanges
            const isFirst = chatHistory.length === 0;
            const currentResults = resultsRef.current;

            const documentIds = isFirst && currentResults?.length > 0
                ? currentResults.map(r => r.id || r.Id).filter(id => id != null)
                : [];

            const mappedResults = isFirst && currentResults?.length > 0
                ? currentResults.map(r => ({
                    title: r.title || '',
                    url: r.url || '',
                    snippet: r.snippet || '',
                }))
                : [];

            const payload = {
                message: userMessage,
                query: query || 'general',
                history: chatHistory,
                ...(isFirst && {
                    document_ids: documentIds,
                    results: mappedResults,
                }),
            };

            const response = await fetch(`${API}/api/llm/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error('Chat request failed');

            const data = await response.json();

            const assistantMsg = { role: 'assistant', content: data.response };
            setMessages(prev => [...prev, assistantMsg]);

            if (data.debug_prompt && !capturedPrompt) {
                setCapturedPrompt(data.debug_prompt);
            }

            // Update chat history (only real user/assistant turns for AI context)
            const updatedHistory = [
                ...chatHistory,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: data.response },
            ];
            setChatHistory(updatedHistory);

            // Persist session to Redis
            saveSession(query, updatedHistory);

            // Update local session info badge
            setSessionInfo(prev => ({
                ...prev,
                last_updated: new Date().toISOString(),
                message_count: updatedHistory.filter(m => m.role === 'user').length,
            }));

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = () => { if (input.trim() && !loading) sendMessageWithText(input); };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    // ── new session (clear history) ───────────────────────────────────────────
    const startNewSession = () => {
        setChatHistory([]);
        setCapturedPrompt(null);
        setShowPromptView(false);
        setMessages([{
            role: 'assistant',
            content: `Started a new session for "${query}". What would you like to know?`,
        }]);
        setSessionInfo(prev => prev ? { ...prev, message_count: 0, last_updated: new Date().toISOString() } : null);
    };

    // ── refine search ─────────────────────────────────────────────────────────
    const refineAndSearch = async () => {
        if (refining || !query) return;
        setRefining(true);
        try {
            const response = await fetch(`${API}/api/llm/refine-query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ original_query: query, chat_history: chatHistory }),
            });
            if (!response.ok) throw new Error('Query refinement failed');
            const data = await response.json();
            navigate(`/results?q=${encodeURIComponent(data.refined_query)}&page=1&page_size=10`);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error refining search: ${error.message}. Please try again.`,
            }]);
        } finally {
            setRefining(false);
        }
    };

    // ── closed state ─────────────────────────────────────────────────────────
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
                {sessionLoaded && (
                    <Box sx={{
                        position: 'absolute', top: 4, right: 4,
                        width: 10, height: 10, borderRadius: '50%',
                        bgcolor: '#f59e0b', border: '2px solid #10b981',
                    }} />
                )}
            </IconButton>
        );
    }

    const widgetWidth  = expanded ? 800 : (minimized ? 320 : 400);
    const widgetHeight = expanded ? '90vh' : (minimized ? 60 : 600);

    return (
        <Fade in={open}>
            <Paper sx={{
                position: 'fixed',
                bottom: expanded ? '5vh' : 24,
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
                {/* ── Header ── */}
                <Box sx={{
                    p: 2,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                        <SmartToyIcon />
                        <Typography variant="h6" fontWeight="bold" noWrap>AI Assistant</Typography>

                        {/* Session key badge */}
                        {sessionInfo?.session_key && (
                            <Tooltip
                                title={
                                    <Box>
                                        <Typography variant="caption" display="block">
                                            Redis key: <code>{sessionInfo.session_key}</code>
                                        </Typography>
                                        {sessionInfo.message_count > 0 && (
                                            <Typography variant="caption" display="block">
                                                {sessionInfo.message_count} exchange{sessionInfo.message_count !== 1 ? 's' : ''}
                                                {sessionInfo.last_updated && ` · ${formatRelativeTime(sessionInfo.last_updated)}`}
                                            </Typography>
                                        )}
                                        {sessionInfo.ttl_seconds > 0 && (
                                            <Typography variant="caption" display="block">
                                                Expires in {Math.ceil(sessionInfo.ttl_seconds / 86400)}d
                                            </Typography>
                                        )}
                                    </Box>
                                }
                                arrow
                            >
                                <Chip
                                    label={sessionLoaded ? `↩ ${sessionInfo.session_key.replace('chat:session:', '')}` : sessionInfo.session_key.replace('chat:session:', '')}
                                    size="small"
                                    sx={{
                                        bgcolor: sessionLoaded ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.15)',
                                        color: sessionLoaded ? '#fbbf24' : 'white',
                                        fontSize: '0.6rem',
                                        height: 18,
                                        maxWidth: 120,
                                        '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                                    }}
                                />
                            </Tooltip>
                        )}

                        {capturedPrompt && (
                            <Chip
                                label="prompt"
                                size="small"
                                onClick={() => setShowPromptView(v => !v)}
                                sx={{
                                    bgcolor: showPromptView ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)',
                                    color: showPromptView ? '#059669' : 'white',
                                    fontSize: '0.6rem',
                                    height: 18,
                                    cursor: 'pointer',
                                }}
                            />
                        )}
                    </Stack>

                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                        {/* Prompt viewer */}
                        <Tooltip title={capturedPrompt ? (showPromptView ? 'Back to chat' : 'View prompt') : 'Send first message to capture prompt'} arrow>
                            <span>
                                <IconButton
                                    size="small"
                                    onClick={() => setShowPromptView(v => !v)}
                                    disabled={!capturedPrompt}
                                    sx={{ color: showPromptView ? '#fbbf24' : 'white', opacity: capturedPrompt ? 1 : 0.35 }}
                                >
                                    {showPromptView ? <ChatBubbleOutlineIcon fontSize="small" /> : <DataObjectIcon fontSize="small" />}
                                </IconButton>
                            </span>
                        </Tooltip>

                        {/* New session */}
                        <Tooltip title="Start new session (clears history)" arrow>
                            <IconButton
                                size="small"
                                onClick={startNewSession}
                                sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1 } }}
                            >
                                <AddCommentIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={expanded ? 'Shrink' : 'Expand'} arrow>
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
                        {/* ── Prompt View ── */}
                        {showPromptView && capturedPrompt ? (
                            <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: '#0d1117', display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{
                                    px: 2, py: 1, bgcolor: '#161b22',
                                    borderBottom: '1px solid #30363d',
                                    display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
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
                                <Box sx={{ p: 2, flex: 1 }}>
                                    {capturedPrompt.split(/(\[SYSTEM\]|\[USER — Turn 1\][^\n]*)/).filter(Boolean).map((part, i) => {
                                        if (part.startsWith('[SYSTEM]')) {
                                            return (
                                                <Typography key={i} variant="caption" sx={{ color: '#f0883e', fontFamily: 'monospace', fontWeight: 700, display: 'block', mb: 1 }}>
                                                    ● SYSTEM
                                                </Typography>
                                            );
                                        }
                                        if (part.match(/^\[USER — Turn 1\]/)) {
                                            return (
                                                <Box key={i} sx={{ mb: 1 }}>
                                                    <Typography variant="caption" sx={{ color: '#3fb950', fontFamily: 'monospace', fontWeight: 700, display: 'block', mb: 0.5 }}>
                                                        ● USER — TURN 1
                                                    </Typography>
                                                    {part.includes('image') && (
                                                        <Chip
                                                            label={part.match(/\[([^\]]+image[^\]]*)\]/i)?.[0] || 'images attached'}
                                                            size="small"
                                                            sx={{ bgcolor: '#1f2937', color: '#a78bfa', fontSize: '0.62rem', height: 18, mb: 1 }}
                                                        />
                                                    )}
                                                </Box>
                                            );
                                        }
                                        return (
                                            <Box key={i} sx={{ bgcolor: '#161b22', border: '1px solid #30363d', borderRadius: 1, p: 1.5, mb: 2 }}>
                                                <pre style={{ margin: 0, color: '#e6edf3', fontFamily: '"Fira Code","Consolas",monospace', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {part.trim()}
                                                </pre>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        ) : (
                            /* ── Chat Messages ── */
                            <Box
                                ref={scrollContainerRef}
                                sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'background.default' }}
                            >
                                <Stack spacing={2}>
                                    {messages.map((message, index) => {
                                        // System / session-info messages
                                        if (message.role === 'system') {
                                            return (
                                                <Box key={index} sx={{
                                                    p: 1.5, borderRadius: 2,
                                                    bgcolor: 'rgba(251,191,36,0.08)',
                                                    border: '1px solid rgba(251,191,36,0.2)',
                                                }}>
                                                    <Typography variant="caption" sx={{ whiteSpace: 'pre-wrap', color: '#d97706' }}>
                                                        {message.content.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1')}
                                                    </Typography>
                                                </Box>
                                            );
                                        }

                                        return (
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
                                        );
                                    })}
                                    {loading && (
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                                <SmartToyIcon fontSize="small" />
                                            </Avatar>
                                            <CircularProgress size={20} />
                                        </Stack>
                                    )}
                                </Stack>
                            </Box>
                        )}

                        {/* ── Input Bar ── */}
                        <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder={results?.length > 0 ? 'Ask about these results...' : 'Ask me anything...'}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={loading}
                                    multiline
                                    maxRows={3}
                                    autoFocus
                                />
                                <Tooltip title={refining ? 'Refining...' : (!query ? 'No active query' : 'Refine search')} arrow>
                                    <span>
                                        <IconButton
                                            color="secondary"
                                            onClick={refineAndSearch}
                                            disabled={refining || !query}
                                            sx={{
                                                bgcolor: 'rgba(139,92,246,0.1)',
                                                '&:hover': { bgcolor: 'rgba(139,92,246,0.2)' },
                                                '&:disabled': { opacity: 0.5 },
                                            }}
                                        >
                                            {refining ? <CircularProgress size={20} color="inherit" /> : <AutoFixHighIcon />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <IconButton color="primary" onClick={sendMessage} disabled={!input.trim() || loading}>
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
