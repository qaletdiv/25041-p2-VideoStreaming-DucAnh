'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { Link } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { donationSchema } from '@/lib/validations/donation';

export default function DonationPanel({ streamId, user }) {
    const t = useTranslations('donation');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [pending, startTransition] = useTransition();
    const requestRef = useRef(null);

    useEffect(() => {
        if (!success) return;
        const timer = setTimeout(() => setSuccess(false), 3000);
        return () => clearTimeout(timer);
    }, [success]);

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
                const codes = { UNAUTHENTICATED: 'loginRequired', FORBIDDEN: 'forbidden', STREAM_ENDED: 'ended', STREAM_BUSY: 'busy', DONATION_CONFLICT: 'conflict' };
                setError(codes[result.data?.error?.code] ?? 'failed');
                return;
            }
            requestRef.current = null;
            form.reset();
            setSuccess(true);
        });
    }

    return (
        <Card sx={{ mt: 3 }}>
            <CardContent>
                <Stack spacing={2}>
                    <Typography variant="h6">{t('title')}</Typography>
                    {user ? (
                        <Stack component="form" onSubmit={submit} spacing={2} noValidate>
                            <TextField name="amount" type="number" label={t('amount')} defaultValue="10000" required disabled={pending} slotProps={{ htmlInput: { min: 1000, max: 1000000, step: 1000 } }} helperText={t('amountHint')} />
                            <TextField name="message" label={t('message')} multiline maxRows={3} disabled={pending} slotProps={{ htmlInput: { maxLength: 300 } }} />
                            {error && <Alert severity="error">{t(`errors.${error}`)}</Alert>}
                            {success && <Alert severity="success">{t('success')}</Alert>}
                            <Button variant="contained" type="submit" disabled={pending}>{t(pending ? 'sending' : 'send')}</Button>
                        </Stack>
                    ) : <Typography><Link href="/login">{t('loginRequired')}</Link></Typography>}
                </Stack>
            </CardContent>
        </Card>
    );
}
