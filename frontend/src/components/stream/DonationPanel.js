'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Alert, Box, Button, Card, CardContent, Pagination, Stack, TextField, Typography } from '@mui/material';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { donationSchema } from '@/lib/validations/donation';

export default function DonationPanel({ streamId, user, refreshKey, latestDonation }) {
    const t = useTranslations('donation');
    const format = useFormatter();
    const [history, setHistory] = useState({ donations: [], totalPages: 0 });
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [error, setError] = useState(null);
    const [historyError, setHistoryError] = useState(false);
    const [success, setSuccess] = useState(false);
    const [pending, startTransition] = useTransition();
    const requestRef = useRef(null);

    useEffect(() => {
        let active = true;
        apiFetch(`/streams/${streamId}/donations?page=${page}&limit=10`).then((result) => {
            if (!active) return;
            setHistoryError(!result.ok);
            if (result.ok) setHistory(result.data);
        });
        return () => { active = false; };
    }, [streamId, page, refreshKey, reload]);

    const amountText = (amount) => format.number(amount, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

    function submit(event) {
        event.preventDefault();
        if (pending) return;
        setError(null);
        setSuccess(false);
        const form = event.currentTarget;
        const parsed = donationSchema.safeParse(Object.fromEntries(new FormData(form)));
        if (!parsed.success) {
            const field = parsed.error.issues[0].path[0];
            setError(field === 'amount' ? 'amountInvalid' : 'messageTooLong');
            return;
        }
        // Giữ mã khi thử lại cùng nội dung sau lỗi mạng.
        const signature = JSON.stringify(parsed.data);
        if (requestRef.current?.signature !== signature) {
            requestRef.current = { signature, requestId: crypto.randomUUID() };
        }
        const body = { ...parsed.data, requestId: requestRef.current.requestId };
        startTransition(async () => {
            const result = await apiFetch(`/streams/${streamId}/donations`, { method: 'POST', body });
            if (!result.ok) {
                const codes = { UNAUTHENTICATED: 'loginRequired', STREAM_ENDED: 'ended', STREAM_BUSY: 'busy', DONATION_CONFLICT: 'conflict' };
                setError(codes[result.data?.error?.code] ?? 'failed');
                return;
            }
            requestRef.current = null;
            form.reset();
            setSuccess(true);
            setPage(1);
            setReload((value) => value + 1);
        });
    }

    return (
        <Card sx={{ mt: 3 }}>
            <CardContent>
                <Stack spacing={2}>
                    <Typography variant="h6">{t('title')}</Typography>
                    <Typography variant="body2" color="text.secondary">{t('description')}</Typography>
                    {latestDonation && <Alert severity="info">{t('received', { name: latestDonation.user.name, amount: amountText(latestDonation.amount) })}</Alert>}
                    {user ? (
                        <Stack component="form" onSubmit={submit} spacing={2} noValidate>
                            <TextField name="amount" type="number" label={t('amount')} defaultValue="10000" required disabled={pending} slotProps={{ htmlInput: { min: 1000, max: 1000000, step: 1000 } }} helperText={t('amountHint')} />
                            <TextField name="message" label={t('message')} multiline maxRows={3} disabled={pending} slotProps={{ htmlInput: { maxLength: 300 } }} />
                            {error && <Alert severity="error">{t(`errors.${error}`)}</Alert>}
                            {success && <Alert severity="success">{t('success')}</Alert>}
                            <Button variant="contained" type="submit" disabled={pending}>{t(pending ? 'sending' : 'send')}</Button>
                        </Stack>
                    ) : <Typography><Link href="/login">{t('loginRequired')}</Link></Typography>}
                    <Typography variant="subtitle1">{t('history')}</Typography>
                    {historyError ? <Alert severity="error">{t('historyError')}</Alert> : (
                        <Stack spacing={1}>
                            {history.donations.length === 0 && <Typography color="text.secondary">{t('empty')}</Typography>}
                            {history.donations.map((item) => (
                                <Box key={item.id} sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, overflowWrap: 'anywhere' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{t('received', { name: item.user.name, amount: amountText(item.amount) })}</Typography>
                                    {item.message && <Typography variant="body2">{item.message}</Typography>}
                                    <Typography variant="caption" color="text.secondary">{format.dateTime(new Date(item.createdAt), { dateStyle: 'short', timeStyle: 'short' })}</Typography>
                                </Box>
                            ))}
                            {history.totalPages > 1 && <Pagination count={history.totalPages} page={page} onChange={(_, value) => setPage(value)} />}
                        </Stack>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
