'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    Box, Button, Card, CardContent, CardMedia, Chip, CircularProgress,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Grid, IconButton, Stack, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

const PAGE_SIZE = 12;

// Màu và icon theo trạng thái video
const STATUS_CONFIG = {
    PROCESSING: { color: 'warning', icon: <HourglassBottomIcon sx={{ fontSize: 14 }} /> },
    READY:      { color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    FAILED:     { color: 'error',   icon: <ErrorIcon sx={{ fontSize: 14 }} /> },
};

export default function MyVideoList() {
    const t = useTranslations('dashboard');

    const [videos, setVideos] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(null);   // id đang xóa
    const [deleteTarget, setDeleteTarget] = useState(null); // id chờ xác nhận

    // ── Lấy danh sách video ────────────────────────────────────────────
    const fetchVideos = useCallback(async (targetPage) => {
        setLoading(true);
        const { ok, data } = await apiFetch(`/videos/mine?page=${targetPage}&limit=${PAGE_SIZE}`);
        if (ok) {
            setVideos(data.videos);
            setPage(data.page);
            setTotalPages(data.totalPages);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchVideos(1); }, [fetchVideos]);

    // ── Xóa video ─────────────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        const id = deleteTarget;
        setDeleteTarget(null);
        setDeleting(id);

        const { ok } = await apiFetch(`/videos/${id}`, { method: 'DELETE' });
        setDeleting(null);

        if (ok) {
            // Xóa khỏi danh sách local; nếu trang trống thì lùi trang
            setVideos((prev) => prev.filter((v) => v.id !== id));
            if (videos.length <= 1 && page > 1) {
                fetchVideos(page - 1);
            }
        }
    };

    // ── Format thời lượng ──────────────────────────────────────────────
    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    return (
        <Box>
            {/* Header: tiêu đề + nút upload */}
            <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                    {t('title')}
                </Typography>
                <Button
                    component={Link}
                    href="/dashboard/upload"
                    variant="contained"
                    startIcon={<AddIcon />}
                >
                    {t('uploadVideo')}
                </Button>
            </Stack>

            {/* Trạng thái loading */}
            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Danh sách rỗng */}
            {!loading && videos.length === 0 && (
                <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                    {t('noVideos')}
                </Typography>
            )}

            {/* Lưới video */}
            {!loading && videos.length > 0 && (
                <Grid container spacing={2}>
                    {videos.map((video) => {
                        const status = STATUS_CONFIG[video.status] || STATUS_CONFIG.READY;
                        return (
                            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={video.id}>
                                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    {/* Thumbnail hoặc placeholder */}
                                    {video.thumbnailUrl ? (
                                        <CardMedia
                                            component="img"
                                            image={video.thumbnailUrl}
                                            alt={video.title}
                                            sx={{ height: 140, objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <Box sx={{
                                            height: 140, bgcolor: 'grey.900',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <PlayCircleOutlinedIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                                        </Box>
                                    )}
                                    <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                                            {video.title}
                                        </Typography>
                                        <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center' }}>
                                            <Chip
                                                size="small"
                                                color={status.color}
                                                icon={status.icon}
                                                label={t(`status.${video.status}`)}
                                                sx={{ height: 22, fontSize: '0.7rem' }}
                                            />
                                            {video.status === 'READY' && (
                                                <Typography variant="body2" color="text.secondary">
                                                    {formatDuration(video.duration)}
                                                </Typography>
                                            )}
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {t('views', { count: video.viewCount })}
                                        </Typography>
                                    </CardContent>
                                    {/* Nút xóa */}
                                    <Box sx={{ px: 1, pb: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => setDeleteTarget(video.id)}
                                            disabled={deleting === video.id}
                                            aria-label={t('delete')}
                                        >
                                            {deleting === video.id
                                                ? <CircularProgress size={18} />
                                                : <DeleteIcon fontSize="small" />}
                                        </IconButton>
                                    </Box>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Phân trang */}
            {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3 }}>
                    <IconButton
                        onClick={() => fetchVideos(page - 1)}
                        disabled={page <= 1 || loading}
                        aria-label={t('previous')}
                    >
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography>{t('pageInfo', { current: page, total: totalPages })}</Typography>
                    <IconButton
                        onClick={() => fetchVideos(page + 1)}
                        disabled={page >= totalPages || loading}
                        aria-label={t('next')}
                    >
                        <ChevronRightIcon />
                    </IconButton>
                </Box>
            )}

            {/* Dialog xác nhận xóa */}
            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{t('deleteDialog.message')}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>{t('deleteDialog.cancel')}</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained">
                        {t('deleteDialog.confirm')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
