'use client';
import { useTranslations } from 'next-intl';
import { Box, Card, CardContent, CardMedia, Chip, Stack, Typography } from '@mui/material';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';

// Dưới 1 phút -> giây, còn lại -> phút
function formatDuration(t, seconds) {
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? t('durationMinutes', { count: minutes }) : t('durationSeconds', { count: seconds });
}

export default function VideoCard({ video }) {
    const t = useTranslations('home');

    return (
        <Card sx={{ height: '100%' }}>
            {/* Video mẫu để thumbnailUrl null -> dùng icon thay thế */}
            {video.thumbnailUrl ? (
                <CardMedia component="img" image={video.thumbnailUrl} alt={video.title} sx={{ height: 140, objectFit: 'cover' }} />
            ) : (
                <Box sx={{ height: 140, bgcolor: 'grey.900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PlayCircleOutlinedIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                </Box>
            )}
            <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>{video.title}</Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    <Chip size="small" label={t('vod')} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    <Typography variant="body2" color="text.secondary">{formatDuration(t, video.duration)}</Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('views', { count: video.viewCount })}
                </Typography>
                <Typography variant="body2" noWrap>
                    {video.uploader.name} · {video.category?.name ?? ''}
                </Typography>
            </CardContent>
        </Card>
    );
}
