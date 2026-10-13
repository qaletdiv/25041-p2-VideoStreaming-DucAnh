'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Slider, Stack, Typography } from '@mui/material';
import { apiFetch } from '@/lib/api';

export default function OverlaySettings({ streamId, value, onPreview, onSaved }) {
    const t = useTranslations('overlay');
    const [draft, setDraft] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);

    function change(field, value) {
        const next = { ...draft, [field]: value };
        next.x = Math.min(next.x, 100 - next.width);
        next.y = Math.min(next.y, 100 - next.height);
        setDraft(next);
        onPreview(next);
    }

    async function save() {
        setBusy(true);
        setError(false);
        const result = await apiFetch(`/streams/${streamId}/overlay`, { method: 'PUT', body: draft });
        setBusy(false);
        if (!result.ok) {
            setError(true);
            return;
        }
        onSaved(result.data.overlay);
        setDraft(null);
        onPreview(null);
    }

    if (!draft) return (
        <Button onClick={() => { setError(false); setDraft(value); onPreview(value); }}>
            {t('edit')}
        </Button>
    );

    return (
        <Stack spacing={1} sx={{ mt: 2 }}>
            <Typography variant="subtitle1">{t('edit')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('hint')}</Typography>
            {['x', 'y', 'width', 'height'].map((field) => (
                <Stack key={field}>
                    <Typography id={`overlay-${field}`}>{t(field)}: {draft[field]}%</Typography>
                    <Slider
                        value={draft[field]} onChange={(_, next) => change(field, next)}
                        min={field === 'width' ? 20 : field === 'height' ? 15 : 0}
                        max={field === 'x' ? Math.max(1, 100 - draft.width) : field === 'y' ? Math.max(1, 100 - draft.height) : 100}
                        step={1} disabled={busy || (field === 'x' && draft.width === 100) || (field === 'y' && draft.height === 100)} aria-labelledby={`overlay-${field}`} valueLabelDisplay="auto"
                    />
                </Stack>
            ))}
            {error && <Alert severity="error">{t('saveError')}</Alert>}
            <Stack direction="row" spacing={1}>
                <Button variant="contained" disabled={busy} onClick={save}>{t('save')}</Button>
                <Button disabled={busy} onClick={() => { setDraft(null); onPreview(null); }}>{t('cancel')}</Button>
            </Stack>
        </Stack>
    );
}
