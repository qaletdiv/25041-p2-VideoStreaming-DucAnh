'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { apiFetch } from '@/lib/api';

export default function OverlaySettings({ streamId, value, draft, onPreview, onSaved, onBusyChange }) {
    const t = useTranslations('overlay');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);

    async function save() {
        setBusy(true);
        onBusyChange(true);
        setError(false);
        const result = await apiFetch(`/streams/${streamId}/overlay`, { method: 'PUT', body: draft });
        setBusy(false);
        onBusyChange(false);
        if (!result.ok) {
            setError(true);
            return;
        }
        onSaved(result.data.overlay);
        onPreview(null);
    }

    if (!draft) return (
        <Button onClick={() => { setError(false); onPreview(value); }}>
            {t('edit')}
        </Button>
    );

    return (
        <Stack spacing={1} sx={{ mt: 2 }}>
            <Typography variant="subtitle1">{t('edit')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('hint')}</Typography>
            {error && <Alert severity="error">{t('saveError')}</Alert>}
            <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={busy} onClick={save}>{t('save')}</Button>
                <Button disabled={busy} onClick={() => onPreview(null)}>{t('cancel')}</Button>
            </Stack>
        </Stack>
    );
}
