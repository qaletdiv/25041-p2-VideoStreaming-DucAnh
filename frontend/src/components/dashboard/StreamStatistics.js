'use client';
import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

function Metrics({ data }) {
    const t = useTranslations('statistics');
    const format = useFormatter();
    const values = [
        ...(data.total !== undefined ? [['total', data.total], ['active', data.active]] : []),
        ['donationCount', data.donationCount], ['donationAmount', format.number(data.donationAmount, { style: 'currency', currency: 'VND' })],
        ['peak', data.peakViewers ?? t('noData')],
        ['average', data.averageViewers === null ? t('noData') : format.number(data.averageViewers, { maximumFractionDigits: 1 })],
    ];
    return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
        {values.map(([key, value]) => <Card key={key} variant="outlined"><CardContent>
            <Typography color="text.secondary">{t(key)}</Typography>
            <Typography variant="h5">{typeof value === 'number' ? format.number(value) : value}</Typography>
        </CardContent></Card>)}
    </Box>;
}

function RoomDetail({ id, onClose }) {
    const t = useTranslations('statistics');
    const format = useFormatter();
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        async function load() {
            const response = await apiFetch(`/statistics/streams/${encodeURIComponent(id)}`);
            if (!active) return;
            setError(!response.ok);
            if (response.ok) setData(response.data);
        }
        load();
        const timer = setInterval(load, 10000);
        return () => { active = false; clearInterval(timer); };
    }, [id]);
    const samples = data?.samples ?? [];
    const max = Math.max(1, ...samples.map((sample) => sample.viewers));
    const start = samples.length ? Date.parse(samples[0].ts) : 0;
    const span = samples.length ? Math.max(1, Date.parse(samples.at(-1).ts) - start) : 1;
    const points = samples.map((sample) => `${40 + (Date.parse(sample.ts) - start) / span * 620},${200 - sample.viewers / max * 170}`).join(' ');
    const time = (ts) => format.dateTime(new Date(ts), { dateStyle: 'short', timeStyle: 'medium' });
    return <Dialog open onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>{data?.stream.title ?? t('detail')}</DialogTitle>
        <DialogContent>
            {error && <Alert severity="error">{t('error')}</Alert>}
            {!data && !error && <CircularProgress />}
            {data && <Stack spacing={2}>
                <Metrics data={data} />
                <Typography>{t('chartNote')}</Typography>
                {!samples.length ? <Alert severity="info">{t('emptySamples')}</Alert> : <>
                    <Box component="svg" viewBox="0 0 700 230" role="img" aria-label={t('chart')} sx={{ width: '100%', color: 'primary.main' }}>
                        <title>{t('chart')}</title>
                        <path d="M40 20 V200 H660" fill="none" stroke="currentColor" />
                        <text x="5" y="35" fill="currentColor">{max}</text>
                        <text x="15" y="205" fill="currentColor">0</text>
                        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
                        {samples.map((sample) => <circle key={sample.ts} cx={40 + (Date.parse(sample.ts) - start) / span * 620} cy={200 - sample.viewers / max * 170} r="3" fill="currentColor"><title>{time(sample.ts)}: {sample.viewers}</title></circle>)}
                    </Box>
                    <Typography variant="caption">{time(samples[0].ts)} — {time(samples.at(-1).ts)}</Typography>
                </>}
            </Stack>}
        </DialogContent>
        <DialogActions><Button onClick={onClose}>{t('close')}</Button></DialogActions>
    </Dialog>;
}

export default function StreamStatistics({ ownerId, isAdmin }) {
    const t = useTranslations('statistics');
    const statusText = useTranslations('streamRoom.status');
    const format = useFormatter();
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [reload, setReload] = useState(0);
    const [selected, setSelected] = useState(null);
    useEffect(() => {
        let active = true;
        setData(null);
        async function load() {
            const params = new URLSearchParams({ page, limit: 10, ...(ownerId ? { ownerId } : {}) });
            const response = await apiFetch(`/statistics?${params}`);
            if (!active) return;
            setError(!response.ok);
            if (response.ok) setData(response.data);
        }
        load();
        const timer = setInterval(load, 10000);
        return () => { active = false; clearInterval(timer); };
    }, [ownerId, page, reload]);

    return <Stack spacing={2}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>{t('title')}</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button onClick={() => setReload((value) => value + 1)}>{t('refresh')}</Button>
            {isAdmin && <Button component={Link} href="/admin/users">{t('chooseOwner')}</Button>}
            {isAdmin && ownerId && <Button component={Link} href="/dashboard/statistics">{t('all')}</Button>}
        </Stack>
        {error && <Alert severity="error">{t('error')}</Alert>}
        {!data && !error && <Box><CircularProgress /></Box>}
        {data && <>
            <Typography variant="h6">{data.owner ? t('owner', { name: data.owner.name }) : t('all')}</Typography>
            <Metrics data={data} />
            <TableContainer><Table aria-label={t('rooms')}>
                <TableHead><TableRow>{['room', 'streamer', 'status', 'created', 'detail'].map((key) => <TableCell key={key}>{t(key)}</TableCell>)}</TableRow></TableHead>
                <TableBody>
                    {data.streams.map((stream) => <TableRow key={stream.id}>
                        <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 300 }}>{stream.title}</TableCell>
                        <TableCell>{stream.owner.name}</TableCell>
                        <TableCell>{statusText(stream.status)}</TableCell>
                        <TableCell>{format.dateTime(new Date(stream.createdAt), { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                        <TableCell><Button onClick={() => setSelected(stream.id)}>{t('detail')}</Button></TableCell>
                    </TableRow>)}
                    {!data.streams.length && <TableRow><TableCell colSpan={5}>{t('empty')}</TableCell></TableRow>}
                </TableBody>
            </Table></TableContainer>
            {data.totalPages > 1 && <Pagination page={page} count={data.totalPages} onChange={(_, value) => setPage(value)} />}
        </>}
        {selected && <RoomDetail key={selected} id={selected} onClose={() => setSelected(null)} />}
    </Stack>;
}
