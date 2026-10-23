'use client';
import { useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { io } from 'socket.io-client';
import { Alert, Box, Button, Card, CardContent, Chip, LinearProgress, MenuItem, Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import VideoLibraryOutlinedIcon from '@mui/icons-material/VideoLibraryOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import VideoStatisticsCharts from './VideoStatisticsCharts';

const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

export default function VideoStatistics({ ownerId, isAdmin }) {
    const t = useTranslations('videoStatistics');
    const format = useFormatter();
    const router = useRouter();
    const [filters, setFilters] = useState({ range: '7d', groupBy: 'day', q: '', sort: 'views', order: 'desc', page: 1, limit: 10 });
    const [range, setRange] = useState('7d');
    const [dates, setDates] = useState({ from: '', to: '' });
    const [dateError, setDateError] = useState(false);
    const [search, setSearch] = useState('');
    const [reload, setReload] = useState(0);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [connected, setConnected] = useState(false);
    const refreshRef = useRef(null);
    const params = new URLSearchParams({ ...filters, ...(ownerId ? { ownerId } : {}) }).toString();

    function change(values) { setFilters((previous) => ({ ...previous, ...values, page: 1 })); }
    function changeRange(value) {
        setRange(value);
        setDateError(false);
        if (value === 'custom') {
            setDates((previous) => ({ from: previous.from || today(), to: previous.to || today() }));
        } else {
            setFilters(({ from, to, ...previous }) => ({ ...previous, range: value, page: 1 }));
        }
    }
    function applyDates() {
        const days = (Date.parse(dates.to) - Date.parse(dates.from)) / 86400000 + 1;
        const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000-')
            && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
        if (!valid(dates.from) || !valid(dates.to) || days < 1 || days > 366) { setDateError(true); return; }
        setDateError(false);
        change({ range: 'custom', ...dates });
    }

    useEffect(() => {
        const timer = setTimeout(() => setFilters((previous) => previous.q === search.trim() ? previous : { ...previous, q: search.trim(), page: 1 }), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let active = true;
        let running = false;
        let queued = false;
        async function load() {
            if (running) { queued = true; return; }
            running = true;
            setLoading(true);
            do {
                queued = false;
                const result = await apiFetch(`/statistics/videos?${params}`);
                if (!active) return;
                if (result.status === 401) { router.replace('/login'); router.refresh(); return; }
                setError(!result.ok);
                if (result.ok) {
                    if (result.data.totalPages > 0 && result.data.page > result.data.totalPages) {
                        setFilters((previous) => ({ ...previous, page: result.data.totalPages }));
                    }
                    setData({ key: params, value: result.data });
                }
            } while (queued && active);
            running = false;
            setLoading(false);
        }
        refreshRef.current = load;
        load();
        return () => { active = false; refreshRef.current = null; };
    }, [params, reload, router]);

    useEffect(() => {
        let timer;
        const socket = io(new URL(process.env.NEXT_PUBLIC_API_URL).origin, { withCredentials: true });
        function schedule() {
            if (timer) return;
            timer = setTimeout(() => { timer = null; refreshRef.current?.(); }, 350);
        }
        socket.on('connect', () => { setConnected(true); schedule(); });
        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', () => setConnected(false));
        socket.on('statistics:videos-changed', schedule);
        socket.on('account:locked', () => { router.replace('/login'); router.refresh(); });
        window.addEventListener('focus', schedule);
        // Đồng bộ lại khi bỏ lỡ sự kiện hoặc qua ngày thống kê mới.
        const fallback = setInterval(schedule, 60000);
        return () => {
            clearTimeout(timer); clearInterval(fallback);
            window.removeEventListener('focus', schedule);
            socket.disconnect();
        };
    }, [router]);

    const current = data?.key === params ? data.value : null;
    const controlStyle = { minWidth: { xs: '100%', sm: 155 } };
    const duration = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
            <Box><Typography variant="h4" component="h1" sx={{ fontWeight: 750 }}>{t('title')}</Typography>
                <Typography color="text.secondary">{t(isAdmin ? ownerId ? 'selectedOwner' : 'allVideos' : 'myVideos')}</Typography></Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip size="small" color={connected ? 'success' : 'default'} variant="outlined" label={t(connected ? 'live' : 'reconnecting')} />
                <Button startIcon={<RefreshIcon />} onClick={() => setReload((n) => n + 1)} disabled={loading}>{t('refresh')}</Button>
            </Stack>
        </Stack>
        {isAdmin && <Stack direction="row" spacing={1}>
            <Button component={Link} href="/admin/users">{t('chooseOwner')}</Button>
            {ownerId && <Button component={Link} href="/dashboard/statistics">{t('allVideos')}</Button>}
        </Stack>}
        <Card variant="outlined"><CardContent><Stack spacing={2}>
            <Stack direction="row" gap={2} sx={{ flexWrap: 'wrap' }}>
                <TextField select size="small" label={t('range')} value={range} onChange={(e) => changeRange(e.target.value)} sx={controlStyle}>
                    {['today', '7d', '30d', 'custom'].map((v) => <MenuItem key={v} value={v}>{t(`ranges.${v}`)}</MenuItem>)}
                </TextField>
                <TextField select size="small" label={t('group')} value={filters.groupBy} onChange={(e) => change({ groupBy: e.target.value })} sx={controlStyle}>
                    {['day', 'week', 'month'].map((v) => <MenuItem key={v} value={v}>{t(`groups.${v}`)}</MenuItem>)}
                </TextField>
                {range === 'custom' && <>
                    {['from', 'to'].map((key) => <TextField key={key} type="date" size="small" label={t(key)} value={dates[key]} onChange={(e) => setDates((previous) => ({ ...previous, [key]: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} error={dateError} sx={controlStyle} />)}
                    <Button variant="contained" onClick={applyDates}>{t('apply')}</Button>
                </>}
            </Stack>
            {dateError && <Alert severity="error">{t('invalidDates')}</Alert>}
            {current && <Typography variant="caption" color="text.secondary">{t('period', { from: current.period.from, to: current.period.to })}</Typography>}
        </Stack></CardContent></Card>
        {loading && <LinearProgress aria-label={t('loading')} />}
        {error && <Alert severity="error">{t('error')}</Alert>}
        {current && <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                {[[t('totalVideos'), current.kpis.totalVideos, VideoLibraryOutlinedIcon], [t('totalViews'), current.kpis.totalViews, VisibilityOutlinedIcon]].map(([label, value, Icon]) => <Card key={label} variant="outlined"><CardContent>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f1edff', color: 'primary.main', display: 'flex' }}><Icon /></Box>
                        <Box><Typography color="text.secondary">{label}</Typography><Typography variant="h3" sx={{ fontWeight: 700 }}>{format.number(value)}</Typography></Box>
                    </Stack>
                </CardContent></Card>)}
            </Box>
            <VideoStatisticsCharts timeline={current.timeline} topVideos={current.topVideos} />
        </>}
        <Card variant="outlined"><CardContent>
            <Typography variant="h6" component="h2" gutterBottom>{t('table')}</Typography>
            <Stack direction="row" gap={2} sx={{ flexWrap: 'wrap', my: 2 }}>
                <TextField size="small" label={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ flex: 1, minWidth: 200 }} />
                <TextField size="small" select label={t('sort')} value={filters.sort} onChange={(e) => change({ sort: e.target.value })} sx={controlStyle}>
                    {['views', 'createdAt', 'title'].map((v) => <MenuItem key={v} value={v}>{t(`columns.${v}`)}</MenuItem>)}
                </TextField>
                <TextField size="small" select label={t('order')} value={filters.order} onChange={(e) => change({ order: e.target.value })} sx={controlStyle}>
                    {['desc', 'asc'].map((v) => <MenuItem key={v} value={v}>{t(v)}</MenuItem>)}
                </TextField>
            </Stack>
            <TableContainer><Table aria-label={t('table')} sx={{ minWidth: 650 }}>
                <TableHead><TableRow>{['title', 'duration', 'views', 'createdAt'].map((key) => <TableCell key={key}>{t(`columns.${key}`)}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                    {current?.videos.map((video) => <TableRow key={video.id} hover>
                        <TableCell><Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                            {video.thumbnailUrl ? <Box component="img" src={video.thumbnailUrl} alt="" loading="lazy" sx={{ width: 90, height: 52, objectFit: 'cover', borderRadius: 1 }} /> : <Box sx={{ width: 90, height: 52, bgcolor: 'grey.100', borderRadius: 1, display: 'grid', placeItems: 'center', flexShrink: 0 }}><VideoLibraryOutlinedIcon color="disabled" /></Box>}
                            <Typography variant="body2" sx={{ maxWidth: 320, overflowWrap: 'anywhere', fontWeight: 600 }}>{video.title}</Typography>
                        </Stack></TableCell>
                        <TableCell>{duration(video.duration)}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{format.number(video.views)}</TableCell>
                        <TableCell>{format.dateTime(new Date(video.createdAt), { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })}</TableCell>
                    </TableRow>)}
                    {!current?.videos.length && <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 5 }}>{t(loading ? 'loading' : error ? 'error' : 'empty')}</TableCell></TableRow>}
                </TableBody>
            </Table></TableContainer>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} sx={{ mt: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                <TextField select size="small" label={t('pageSize')} value={filters.limit} onChange={(e) => change({ limit: Number(e.target.value) })} sx={{ minWidth: 130 }}>{[10, 20, 50].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}</TextField>
                {current && <Typography variant="body2" color="text.secondary">{t('results', { count: current.total })}</Typography>}
                {current?.totalPages > 1 && <Pagination page={filters.page} count={current.totalPages} onChange={(_, page) => setFilters((previous) => ({ ...previous, page }))} size="small" color="primary" />}
            </Stack>
        </CardContent></Card>
    </Stack>;
}
