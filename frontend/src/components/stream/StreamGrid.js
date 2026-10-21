'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { io } from 'socket.io-client';
import { Box, Card, CardActionArea, CardContent, CardMedia, Chip, Grid, Typography } from '@mui/material';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

export default function StreamGrid({ initialStreams }) {
    const t = useTranslations('home');
    const [streams, setStreams] = useState(initialStreams);

    useEffect(() => {
        let active = true;
        const socket = io(new URL(process.env.NEXT_PUBLIC_API_URL).origin, { withCredentials: true });

        async function refresh() {
            const result = await apiFetch('/streams');
            if (active && result.ok) setStreams(result.data.streams);
        }

        // Kết nối lại cũng lấy danh sách mới, tránh bỏ lỡ sự kiện khi mất mạng.
        socket.on('connect', refresh);
        socket.on('stream:list-changed', refresh);

        return () => {
            active = false;
            socket.disconnect();
        };
    }, []);

    return (
        <Box sx={{ mb: 4 }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
                {t('streams')}
            </Typography>
            {streams.length === 0 ? (
                <Typography color="text.secondary">{t('noStreams')}</Typography>
            ) : (
                <Grid container spacing={2}>
                    {streams.map((stream) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={stream.id}>
                            <Card sx={{ height: '100%' }}>
                                <CardActionArea component={Link} href={`/stream/${stream.id}`} sx={{ height: '100%' }}>
                                    {stream.video.thumbnailUrl ? (
                                        <CardMedia component="img" image={stream.video.thumbnailUrl} alt={stream.title} sx={{ height: 140, objectFit: 'cover' }} />
                                    ) : (
                                        <Box sx={{ height: 140, bgcolor: 'grey.900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <LiveTvIcon sx={{ fontSize: 48, color: 'grey.500' }} />
                                        </Box>
                                    )}
                                    <CardContent>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>{stream.title}</Typography>
                                        <Typography variant="body2" color="text.secondary" noWrap>{stream.owner.name}</Typography>
                                        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                                            <Chip size="small" color="error" label={t(`streamStatus.${stream.status}`)} />
                                            {stream.requireAuth && <Chip size="small" label={t('loginRequired')} />}
                                        </Box>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
}
