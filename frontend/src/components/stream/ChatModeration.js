'use client';
import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, Stack, TextField, Typography } from '@mui/material';
import { apiFetch } from '@/lib/api';
import { chatBanSchema } from '@/lib/validations/chatBan';

export default function ChatModeration({ streamId, target, onClose, refreshKey }) {
    const t = useTranslations('moderation');
    const format = useFormatter();
    const [showList, setShowList] = useState(false);
    const [duration, setDuration] = useState('5');
    const [reason, setReason] = useState('');
    const [result, setResult] = useState({ bans: [], totalPages: 0 });
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const open = Boolean(target) || showList;

    useEffect(() => {
        if (!open) return;
        let active = true;
        async function load() {
            setLoading(true);
            const response = await apiFetch(`/streams/${streamId}/bans?page=${page}&limit=10`);
            if (!active) return;
            setLoading(false);
            if (response.ok) {
                setResult(response.data);
                if (!response.data.bans.length && page > 1) setPage(page - 1);
            } else setError('failed');
        }
        load();
        const timer = setInterval(load, 30_000);
        return () => { active = false; clearInterval(timer); };
    }, [open, streamId, page, refreshKey, reload]);

    function close() {
        if (busy) return;
        setShowList(false);
        onClose();
    }

    async function ban(event) {
        event.preventDefault();
        const parsed = chatBanSchema.safeParse({ userId: target.id, durationMinutes: duration === 'permanent' ? null : Number(duration), reason });
        if (!parsed.success) { setError('invalid'); return; }
        setBusy(true);
        setError(null);
        const response = await apiFetch(`/streams/${streamId}/bans`, { method: 'POST', body: parsed.data });
        setBusy(false);
        if (!response.ok) {
            setError(response.data?.error?.code === 'BAN_TARGET_PROTECTED' ? 'protected' : 'failed');
            return;
        }
        setShowList(false);
        onClose();
    }

    async function unban(userId) {
        setBusy(true);
        setError(null);
        const response = await apiFetch(`/streams/${streamId}/bans/${encodeURIComponent(userId)}`, { method: 'DELETE' });
        setBusy(false);
        if (response.ok) setReload((value) => value + 1);
        else setError('failed');
    }

    return (
        <>
            <Button size="small" onClick={() => { setError(null); setShowList(true); }}>{t('manage')}</Button>
            <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
                <DialogTitle>{target ? t('banUser', { name: target.name }) : t('manage')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ pt: 1 }}>
                        {error && <Alert severity="error">{t(`errors.${error}`)}</Alert>}
                        {target && (
                            <Stack component="form" onSubmit={ban} spacing={2} noValidate>
                                <TextField select label={t('duration')} value={duration} onChange={(event) => setDuration(event.target.value)} disabled={busy}>
                                    {[5, 15, 30].map((minutes) => <MenuItem key={minutes} value={String(minutes)}>{t('minutes', { count: minutes })}</MenuItem>)}
                                    <MenuItem value="permanent">{t('permanent')}</MenuItem>
                                </TextField>
                                <TextField label={t('reason')} value={reason} onChange={(event) => setReason(event.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} disabled={busy} />
                                <Button type="submit" variant="contained" color="error" disabled={busy}>{t('ban')}</Button>
                            </Stack>
                        )}
                        <Typography variant="subtitle1">{t('activeBans')}</Typography>
                        {loading && <CircularProgress size={24} />}
                        {!loading && !result.bans.length && <Typography>{t('empty')}</Typography>}
                        {result.bans.map((item) => (
                            <Box key={item.userId} sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, overflowWrap: 'anywhere' }}>
                                <Typography sx={{ fontWeight: 700 }}>{item.user.name}</Typography>
                                <Typography variant="body2">{item.expiresAt ? t('until', { time: format.dateTime(new Date(item.expiresAt), { dateStyle: 'short', timeStyle: 'short' }) }) : t('permanent')}</Typography>
                                {item.reason && <Typography variant="body2">{item.reason}</Typography>}
                                <Button size="small" onClick={() => unban(item.userId)} disabled={busy}>{t('unban')}</Button>
                            </Box>
                        ))}
                        {result.totalPages > 1 && <Pagination page={page} count={result.totalPages} onChange={(_, value) => setPage(value)} />}
                    </Stack>
                </DialogContent>
                <DialogActions><Button onClick={close} disabled={busy}>{t('close')}</Button></DialogActions>
            </Dialog>
        </>
    );
}
