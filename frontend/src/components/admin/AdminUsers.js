'use client';
import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { apiFetch } from '@/lib/api';

export default function AdminUsers() {
    const t = useTranslations('adminUsers');
    const format = useFormatter();
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState({ search: '', status: 'all', page: 1 });
    const [result, setResult] = useState({ users: [], total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [target, setTarget] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true);
            setError(null);
            const response = await apiFetch(`/admin/users?${new URLSearchParams({ ...query, limit: 10 })}`);
            if (!active) return;
            setLoading(false);
            if (response.ok) {
                setResult(response.data);
                if (!response.data.users.length && query.page > 1) setQuery((previous) => ({ ...previous, page: previous.page - 1 }));
            } else setError(response.status === 401 || response.status === 403 ? 'forbidden' : 'failed');
        }
        load();
        return () => { active = false; };
    }, [query, reload]);

    async function confirm() {
        setBusy(true);
        setError(null);
        setSuccess(null);
        const response = await apiFetch(`/admin/users/${encodeURIComponent(target.id)}/status`, {
            method: 'PATCH', body: { isActive: !target.isActive },
        });
        setBusy(false);
        if (!response.ok) {
            const code = response.data?.error?.code;
            setError(code === 'USER_PROTECTED' ? 'protected' : code === 'LOCK_STREAMS_PENDING' ? 'streamsPending' : 'failed');
            return;
        }
        setSuccess(response.data.user.isActive ? 'unlocked' : 'locked');
        setTarget(null);
        setReload((value) => value + 1);
    }

    return (
        <Stack spacing={2}>
            <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={2} onSubmit={(event) => {
                event.preventDefault();
                setQuery((previous) => ({ ...previous, search: search.trim(), page: 1 }));
            }}>
                <TextField label={t('search')} value={search} onChange={(event) => setSearch(event.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} size="small" sx={{ flex: 1 }} />
                <TextField select label={t('status')} value={query.status} onChange={(event) => setQuery((previous) => ({ ...previous, status: event.target.value, page: 1 }))} size="small" sx={{ minWidth: 160 }}>
                    {['all', 'active', 'locked'].map((status) => <MenuItem key={status} value={status}>{t(`statuses.${status}`)}</MenuItem>)}
                </TextField>
                <Button type="submit" variant="contained">{t('searchButton')}</Button>
                <Button onClick={() => setReload((value) => value + 1)}>{t('refresh')}</Button>
            </Stack>
            {error && <Alert severity="error">{t(`errors.${error}`)}</Alert>}
            {success && <Alert severity="success" onClose={() => setSuccess(null)}>{t(`success.${success}`)}</Alert>}
            {loading ? <Box><CircularProgress size={28} /></Box> : !error && <>
                <Typography>{t('total', { count: result.total })}</Typography>
                <TableContainer component={Paper}>
                    <Table size="small" aria-label={t('tableLabel')}>
                        <TableHead><TableRow>{['name', 'email', 'role', 'status', 'createdAt', 'actions'].map((key) => <TableCell key={key}>{t(key)}</TableCell>)}</TableRow></TableHead>
                        <TableBody>
                            {result.users.map((user) => <TableRow key={user.id}>
                                <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 220 }}>{user.name}</TableCell>
                                <TableCell sx={{ overflowWrap: 'anywhere', maxWidth: 260 }}>{user.email}</TableCell>
                                <TableCell>{t(`roles.${user.role}`)}</TableCell>
                                <TableCell><Chip size="small" color={user.isActive ? 'success' : 'error'} label={t(`statuses.${user.isActive ? 'active' : 'locked'}`)} /></TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{format.dateTime(new Date(user.createdAt), { dateStyle: 'short' })}</TableCell>
                                <TableCell>{user.role === 'ADMIN' ? t('protected') : <Button color={user.isActive ? 'error' : 'primary'} onClick={() => { setError(null); setTarget(user); }}>{t(user.isActive ? 'lock' : 'unlock')}</Button>}</TableCell>
                            </TableRow>)}
                            {!result.users.length && <TableRow><TableCell colSpan={6}>{t('empty')}</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </TableContainer>
                {result.totalPages > 1 && <Pagination page={query.page} count={result.totalPages} onChange={(_, page) => setQuery((previous) => ({ ...previous, page }))} />}
            </>}
            <Dialog open={Boolean(target)} onClose={() => { if (!busy) setTarget(null); }} maxWidth="sm" fullWidth>
                <DialogTitle>{t(target?.isActive ? 'lock' : 'unlock')}</DialogTitle>
                <DialogContent>
                    <Typography>{t(target?.isActive ? 'confirmLock' : 'confirmUnlock', { name: target?.name ?? '' })}</Typography>
                    {error && <Alert severity="error" sx={{ mt: 2 }}>{t(`errors.${error}`)}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button disabled={busy} onClick={() => setTarget(null)}>{t('cancel')}</Button>
                    <Button disabled={busy} color={target?.isActive ? 'error' : 'primary'} onClick={confirm}>{t('confirm')}</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
