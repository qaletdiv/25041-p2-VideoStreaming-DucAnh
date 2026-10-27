'use client';
import { useFormatter, useTranslations } from 'next-intl';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';

export default function VideoStatisticsCharts({ timeline, topVideos }) {
    const t = useTranslations('videoStatistics');
    const format = useFormatter();
    const number = (n) => format.number(n);
    const date = (value) => format.dateTime(new Date(`${value}T00:00:00+07:00`), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
    const max = Math.max(1, ...timeline.map((p) => p.views));
    const x = (i) => timeline.length <= 1 ? 350 : 65 + i / (timeline.length - 1) * 595;
    const y = (v) => 230 - v / max * 190;
    const points = timeline.map((p, i) => `${x(i)},${y(p.views)}`).join(' ');
    const topMax = Math.max(1, ...topVideos.map((v) => v.views));
    return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' }, gap: 3 }}>
        <Card variant="outlined"><CardContent>
            <Typography variant="h6" component="h2" gutterBottom>{t('trend')}</Typography>
            <Box component="svg" viewBox="0 0 700 280" role="img" aria-label={t('trend')} sx={{ width: '100%', color: 'primary.main' }}>
                <title>{t('trend')}</title>
                {[0, 0.5, 1].map((ratio) => <g key={ratio}>
                    <line x1="65" x2="660" y1={y(max * ratio)} y2={y(max * ratio)} stroke="#e5e7eb" />
                    <text x="57" y={y(max * ratio) + 4} textAnchor="end" fontSize="12" fill="#475569">{number(max * ratio)}</text>
                </g>)}
                <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
                {timeline.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.views)} r="4" fill="currentColor" tabIndex={0} aria-label={`${date(p.date)}: ${number(p.views)}`}>
                    <title>{date(p.date)}: {number(p.views)}</title>
                </circle>)}
                {timeline.length > 0 && <>
                    <text x="65" y="260" fontSize="12" fill="#475569">{date(timeline[0].date)}</text>
                    {timeline.length > 1 && <text x="660" y="260" textAnchor="end" fontSize="12" fill="#475569">{date(timeline.at(-1).date)}</text>}
                </>}
            </Box>
        </CardContent></Card>
        <Card variant="outlined"><CardContent>
            <Typography variant="h6" component="h2" gutterBottom>{t('top')}</Typography>
            {!topVideos.length ? <Typography color="text.secondary" sx={{ py: 6 }}>{t('noViews')}</Typography> : <Stack spacing={1.5}>
                {topVideos.map((video, index) => <Box key={video.id}>
                    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                        <Typography variant="body2" noWrap title={video.title}>{index + 1}. {video.title}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{number(video.views)}</Typography>
                    </Stack>
                    <Box component="svg" viewBox="0 0 400 12" role="img" aria-label={`${video.title}: ${number(video.views)}`} sx={{ width: '100%', display: 'block', height: 12, mt: 0.5 }} preserveAspectRatio="none">
                        <title>{video.title}: {number(video.views)}</title>
                        <rect width="400" height="12" rx="6" fill="#f1edff" />
                        <rect width={video.views / topMax * 400} height="12" rx="6" fill="#6c4cf1" />
                    </Box>
                </Box>)}
            </Stack>}
        </CardContent></Card>
    </Box>;
}
