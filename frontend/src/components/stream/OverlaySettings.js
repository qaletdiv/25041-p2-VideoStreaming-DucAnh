'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
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
            <TextField select size="small" label={t('duration')} value={draft.durationSeconds ?? 5}
                onChange={(event) => onPreview({ ...draft, durationSeconds: Number(event.target.value) })} disabled={busy} sx={{ maxWidth: 240 }}>
                {[3, 5, 8, 10, 15, 30, 60].map((seconds) => <MenuItem key={seconds} value={seconds}>{t('seconds', { count: seconds })}</MenuItem>)}
            </TextField>
            {error && <Alert severity="error">{t('saveError')}</Alert>}
            <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={busy} onClick={save}>{t('save')}</Button>
                <Button disabled={busy} onClick={() => onPreview(null)}>{t('cancel')}</Button>
            </Stack>
        </Stack>
    );
}
