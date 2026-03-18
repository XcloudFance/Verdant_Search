import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Chip, Dialog, DialogContent,
    IconButton, Stack, Skeleton, Pagination, Button, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported';

const API = 'http://localhost:8001';
const PAGE_SIZE = 40;

const imgSrc = (img) => {
    if (!img) return null;
    if (img.base64_data) return `data:image/jpeg;base64,${img.base64_data}`;
    return img.image_url || null;
};

// ── Single masonry card ───────────────────────────────────────────────────────
const ImageCard = ({ img, onClick }) => {
    const src = imgSrc(img);
    const [errored, setErrored] = useState(false);

    if (!src || errored) return null;

    return (
        <Box
            onClick={() => onClick(img)}
            sx={{
                breakInside: 'avoid',
                mb: '18px',
                borderRadius: 2,
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
                bgcolor: 'rgba(255,255,255,0.04)',
                '&:hover .hover-overlay': { opacity: 1 },
                '&:hover img': { filter: 'brightness(0.88)' },
            }}
        >
            {/* Image — natural aspect ratio */}
            <Box
                component="img"
                src={src}
                alt={img.alt_text || img.source_title}
                onError={() => setErrored(true)}
                sx={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    transition: 'filter 0.18s',
                }}
            />

            {/* Hover overlay — zoom icon */}
            <Box
                className="hover-overlay"
                sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.18s',
                    pointerEvents: 'none',
                }}
            >
                <Box sx={{
                    bgcolor: 'rgba(0,0,0,0.55)',
                    borderRadius: '50%',
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <ZoomInIcon sx={{ color: 'white', fontSize: 26 }} />
                </Box>
            </Box>

            {/* Caption bar at bottom */}
            <Box sx={{ p: '6px 8px 8px', bgcolor: 'background.paper' }}>
                {img.alt_text && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        noWrap
                        title={img.alt_text}
                        sx={{ fontSize: '0.65rem', lineHeight: 1.3 }}
                    >
                        {img.alt_text}
                    </Typography>
                )}
                <Typography
                    variant="caption"
                    fontWeight={600}
                    display="block"
                    noWrap
                    title={img.source_title}
                    sx={{ fontSize: '0.72rem', lineHeight: 1.4 }}
                >
                    {img.source_title}
                </Typography>
                {img.source_url && (
                    <Typography
                        variant="caption"
                        component="a"
                        href={img.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        display="block"
                        noWrap
                        title={img.source_url}
                        sx={{
                            fontSize: '0.62rem',
                            color: 'text.disabled',
                            textDecoration: 'none',
                            '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                        }}
                    >
                        {img.source_url.replace(/^https?:\/\//, '').slice(0, 48)}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

// ── Skeleton card — random heights simulate masonry ──────────────────────────
const SkeletonCard = ({ h }) => (
    <Box sx={{ breakInside: 'avoid', mb: '18px', borderRadius: 2, overflow: 'hidden' }}>
        <Skeleton variant="rectangular" height={h} sx={{ borderRadius: 0 }} />
        <Box sx={{ p: '6px 8px 8px', bgcolor: 'background.paper' }}>
            <Skeleton width="80%" height={12} />
            <Skeleton width="55%" height={10} sx={{ mt: 0.3 }} />
        </Box>
    </Box>
);

const SKELETON_HEIGHTS = [120, 180, 140, 200, 160, 110, 190, 150, 130, 170, 145, 195];

// ── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox = ({ img, onClose }) => (
    <Dialog
        open
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0d1117', borderRadius: 3, overflow: 'hidden' } }}
    >
        <IconButton
            onClick={onClose}
            size="small"
            sx={{
                position: 'absolute', top: 8, right: 8, zIndex: 10,
                color: 'white', bgcolor: 'rgba(0,0,0,0.55)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            }}
        >
            <CloseIcon fontSize="small" />
        </IconButton>

        {/* Full image */}
        <Box sx={{
            bgcolor: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            maxHeight: '68vh', overflow: 'hidden',
        }}>
            <Box
                component="img"
                src={imgSrc(img)}
                alt={img.alt_text || img.source_title}
                sx={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain' }}
            />
        </Box>

        {/* Metadata panel */}
        <DialogContent sx={{ bgcolor: '#0d1117', py: 2 }}>
            <Stack spacing={1}>
                {img.alt_text && (
                    <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        "{img.alt_text}"
                    </Typography>
                )}
                <Typography variant="h6" color="text.primary" sx={{ lineHeight: 1.3 }}>
                    {img.source_title}
                </Typography>
                {img.source_snippet && (
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                        {img.source_snippet}
                    </Typography>
                )}
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    {img.source_url && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<OpenInNewIcon />}
                            component="a"
                            href={img.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
                        >
                            Visit Source
                        </Button>
                    )}
                    <Chip
                        label={`RRF: ${img.score?.toFixed(4)}`}
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: 'text.secondary', fontSize: '0.65rem' }}
                    />
                    {img.width && img.height && (
                        <Chip
                            label={`${img.width}×${img.height}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(255,255,255,0.07)', color: 'text.secondary', fontSize: '0.65rem' }}
                        />
                    )}
                </Stack>
            </Stack>
        </DialogContent>
    </Dialog>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const ImageResults = ({ query, active }) => {
    const [images, setImages]         = useState([]);
    const [loading, setLoading]       = useState(false);
    const [total, setTotal]           = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage]             = useState(1);
    const [lightbox, setLightbox]     = useState(null);
    const [lastQuery, setLastQuery]   = useState('');

    const fetchImages = useCallback(async (q, pageNum) => {
        if (!q) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/search/images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q, page: pageNum, page_size: PAGE_SIZE }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setImages(data.images || []);
            setTotal(data.total || 0);
            setTotalPages(data.total_pages || 0);
            setLastQuery(q);
        } catch (e) {
            console.error('Image search error:', e);
            setImages([]);
            setTotal(0);
            setTotalPages(0);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!active || !query) return;
        if (query !== lastQuery) {
            setPage(1);
            fetchImages(query, 1);
        }
    }, [query, active]);

    const handlePageChange = (_, value) => {
        setPage(value);
        fetchImages(query, value);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!active) return null;

    // ── Masonry column count (CSS columns) ───────────────────────────────────
    // We use a single Box with CSS multicolumn — browsers handle the staggering
    const columnStyle = {
        columnCount: 'var(--img-cols)',
        columnGap: '18px',
        '--img-cols': 2,
        '@media (min-width: 600px)':  { '--img-cols': 3 },
        '@media (min-width: 900px)':  { '--img-cols': 4 },
        '@media (min-width: 1200px)': { '--img-cols': 5 },
        '@media (min-width: 1600px)': { '--img-cols': 6 },
    };

    return (
        <Box sx={{ mt: 1 }}>
            {/* Count line */}
            {!loading && total > 0 && (
                <Typography variant="body2" color="text.secondary" mb={2}>
                    About {total} image{total !== 1 ? 's' : ''} · CLIP vector + BM25 combined
                </Typography>
            )}

            {/* Masonry grid */}
            <Box sx={columnStyle}>
                {loading
                    ? SKELETON_HEIGHTS.map((h, i) => <SkeletonCard key={i} h={h} />)
                    : images.length > 0
                        ? images.map(img => (
                            <ImageCard key={img.image_key} img={img} onClick={setLightbox} />
                        ))
                        : null
                }
            </Box>

            {/* Empty state */}
            {!loading && images.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                    <ImageNotSupportedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1.5 }} />
                    <Typography variant="h6" color="text.secondary">No images found</Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                        Try different keywords, or index documents that contain images.
                    </Typography>
                </Box>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5, mb: 3 }}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={handlePageChange}
                        color="primary"
                        size="large"
                        showFirstButton
                        showLastButton
                        sx={{
                            '& .MuiPaginationItem-root': {
                                color: 'text.primary',
                                '&:hover': { bgcolor: 'rgba(16,185,129,0.1)' },
                            },
                            '& .Mui-selected': { bgcolor: 'primary.main', color: 'white' },
                        }}
                    />
                </Box>
            )}

            {/* Lightbox */}
            {lightbox && <Lightbox img={lightbox} onClose={() => setLightbox(null)} />}
        </Box>
    );
};

export default ImageResults;
