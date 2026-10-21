import { getLocale, getTranslations } from 'next-intl/server';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { serverApiGet } from '@/lib/api.server';
import VideoPlayer from '@/components/VideoPlayer';
import LinkButton from '@/components/LinkButton';

// Dưới 1 phút -> giây, còn lại -> phút
function formatDuration(t, seconds) {
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? t('durationMinutes', { count: minutes }) : t('durationSeconds', { count: seconds });
}

export default async function WatchPage({ params }) {
    const t = await getTranslations('watch');
    const locale = await getLocale();
    const { id } = await params;
    const { ok, data } = await serverApiGet(`/videos/${encodeURIComponent(id)}`);

    // Video không tồn tại hoặc chưa sẵn sàng đều coi như không tìm thấy
    if (!ok || !data?.video) {
        return (
            <Box sx={{ py: 10, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>{t('notFound')}</Typography>
                <LinkButton variant="contained" href="/">{t('backHome')}</LinkButton>
            </Box>
        );
    }

    const video = data.video;
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(video.createdAt));

    return (
        <Box sx={{ maxWidth: 960, mx: 'auto' }}>
            <VideoPlayer video={video} />
            <Card sx={{ mt: 2 }}>
                <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{video.title}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center' }}>
                        <Chip size="small" label={t('views', { count: video.viewCount })} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                        <Typography variant="body2" color="text.secondary">
                            {formatDuration(t, video.duration)} · {date}
                        </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        {t('uploadedBy')} {video.uploader.name} · {video.category?.name ?? ''}
                    </Typography>
                    {video.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {t('description')}: {video.description}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
