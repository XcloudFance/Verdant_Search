import React, { useState, useRef, useEffect } from 'react';
import {
    Box, Paper, IconButton, TextField, Typography, Stack, Fade, CircularProgress,
    Avatar, Chip, Tooltip, Collapse
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
import { useNavigate } from 'react-router-dom';

const ChatWidget = ({ query, results, externalQuestion, onQuestionSent }) => {
    // DEBUG: Check props
    useEffect(() => {
        console.log('ChatWidget mounted/updated with:', { query, resultsCount: results?.length });
    }, [query, results]);

    const resultsRef = useRef(results);

    useEffect(() => {
        resultsRef.current = results;
        console.log('ChatWidget results updated:', results?.length);
    }, [results]);

    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [refining, setRefining] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // ... existing logs ...


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        // Reset chat when query changes
        if (query) {
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
    }, [query]);  // ✅ 移除 results 依赖

    useEffect(() => {
        // Handle external question from People Also Ask
        if (externalQuestion) {
            setOpen(true);
            setMinimized(false);
            setInput(externalQuestion);

            // Wait a bit for the chat to open, then send
            setTimeout(() => {
                sendMessageWithText(externalQuestion);
                if (onQuestionSent) {
                    onQuestionSent();
                }
            }, 300);
        }
    }, [externalQuestion]);

    const sendMessageWithText = async (messageText) => {
        if (!messageText || !messageText.trim() || loading) return;

        const userMessage = messageText.trim();
        setInput('');

        setMessages(prev => [...prev, {
            role: 'user',
            content: userMessage
        }]);

        setLoading(true);

        try {
            const history = messages
                .filter(msg => (msg.role === 'user') || (msg.role === 'assistant' && !msg.content.includes('Hi!')))
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

            // Use ref to guarantee freshness
            const currentResults = resultsRef.current;

            console.log('Sending chat request:', {
                message: userMessage,
                query: query || 'general',
                resultsCount: currentResults ? currentResults.length : 0,
                historyLength: history.length
            });

            // DEBUG: Check what we are actually sending
            if (currentResults && currentResults.length > 0) {
                console.log('Sample result item:', currentResults[0]);
                const titleKey = currentResults[0].title ? 'title' : (currentResults[0].Title ? 'Title' : 'unknown');
                console.log(`Detected title key: ${titleKey}`);
            }

            const mappedResults = (currentResults && currentResults.length > 0) ? currentResults.map(r => ({
                title: r.title || r.Title || '',
                url: r.url || r.URL || '',
                snippet: r.snippet || r.Snippet || ''
            })) : [];

            // Extract document IDs for backend to fetch full context (including images)
            const documentIds = (currentResults && currentResults.length > 0)
                ? currentResults.map(r => r.id || r.Id).filter(id => id != null)
                : [];

            console.log('Sending chat request with doc IDs:', documentIds);

            const response = await fetch('http://localhost:8001/api/llm/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    query: query || 'general',
                    document_ids: documentIds, // Pass IDs for multimodal support
                    results: mappedResults, // Keep as fallback
                    history: history
                })
            });

            if (!response.ok) {
                throw new Error('Chat request failed');
            }

            const data = await response.json();

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.response
            }]);

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
            // 准备对话历史（排除系统欢迎消息）
            const history = messages
                .filter(msg => (msg.role === 'user') || (msg.role === 'assistant' && !msg.content.includes('Hi!')))
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

            console.log('Refining query based on conversation...', { original: query, historyLength: history.length });

            // 调用API获取优化的查询
            const response = await fetch('http://localhost:8001/api/llm/refine-query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    original_query: query,
                    chat_history: history
                })
            });

            if (!response.ok) {
                throw new Error('Query refinement failed');
            }

            const data = await response.json();
            console.log('Refined query:', data.refined_query);

            // 使用新查询重新搜索
            navigate(`/results?q=${encodeURIComponent(data.refined_query)}&page=1&page_size=10`);

        } catch (error) {
            console.error('Query refinement error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error refining search: ${error.message}. Please try again.`
            }]);
        } finally {
            setRefining(false);
        }
    };

    // ✅ 只要有 Query 就可以 Refine（不再强制要求先对话）
    // 如果有对话历史，会基于历史；如果没有，就基于当前 Query 进行优化
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
                    '&:hover': {
                        bgcolor: 'primary.dark',
                    },
                    boxShadow: 4,
                    zIndex: 1000,
                }}
            >
                <ChatIcon />
            </IconButton>
        );
    }

    // ✨ 动态计算尺寸
    const widgetWidth = expanded ? 800 : (minimized ? 320 : 400);
    const widgetHeight = expanded ? '90vh' : (minimized ? 60 : 600);
    const hasHistory = messages.filter(msg => msg.role === 'user').length > 0;

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
                }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <SmartToyIcon />
                        <Typography variant="h6" fontWeight="bold">AI Assistant</Typography>
                        <Chip
                            label={`${resultsRef.current?.length || 0} res`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', ml: 1 }}
                        />
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                        {/* ✨ 放大/缩小按钮 */}
                        <Tooltip title={expanded ? "缩小" : "放大"} arrow>
                            <IconButton
                                size="small"
                                onClick={() => setExpanded(!expanded)}
                                sx={{ color: 'white' }}
                            >
                                {expanded ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
                            </IconButton>
                        </Tooltip>
                        <IconButton
                            size="small"
                            onClick={() => setMinimized(!minimized)}
                            sx={{ color: 'white' }}
                        >
                            <MinimizeIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => setOpen(false)}
                            sx={{ color: 'white' }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Stack>
                </Box>

                {!minimized && (
                    <>
                        {/* Messages */}
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

                        {/* Input */}
                        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder={(results && results.length > 0) ? "Ask about these results..." : "Ask me anything..."}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={loading}
                                    multiline
                                    maxRows={3}
                                    autoFocus
                                />
                                <Tooltip
                                    title={
                                        refining ? "Refining search..." :
                                            (!query ? "No active search query" :
                                                (hasHistory ? "Refine search based on conversation" : "Refine current search query"))
                                    }
                                    arrow
                                >
                                    <span>
                                        <IconButton
                                            color="secondary"
                                            onClick={() => {
                                                console.log("Magic wand clicked!");
                                                console.log("State:", { refining, query, hasHistory });
                                                if (!query) {
                                                    alert("No search query found to refine!");
                                                    return;
                                                }
                                                refineAndSearch();
                                            }}
                                            disabled={refining}
                                            sx={{
                                                bgcolor: 'rgba(139, 92, 246, 0.1)',
                                                '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.2)' },
                                                '&:disabled': { opacity: 0.5 }
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
