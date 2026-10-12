'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
    Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel,
    MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { createStreamSchema } from '@/lib/validations/stream';

export default function CreateStreamForm({ videos }) {
    const t = useTranslations('streamCreate');
    const [errors, setErrors] = useState({});
    const [generalError, setGeneralError] = useState(null);
    const [createdId, setCreatedId] = useState(null);
    const [isPending, startTransition] = useTransition();

    function handleSubmit(event) {
        event.preventDefault();
        setErrors({});
        setGeneralError(null);

        const form = new FormData(event.currentTarget);
        const parsed = createStreamSchema.safeParse({
            title: form.get('title'),
            videoId: form.get('videoId'),
            requireAuth: form.has('requireAuth'),
        });
        if (!parsed.success) {
            setErrors(z.flattenError(parsed.error).fieldErrors);
            return;
        }

        startTransition(async () => {
            const result = await apiFetch('/streams', { method: 'POST', body: parsed.data });
            if (result.ok) {
                setCreatedId(result.data.stream.id);
            } else {
                setGeneralError(result.data?.error?.code === 'VIDEO_NOT_FOUND'
                    ? 'videoUnavailable'
                    : 'serverError');
            }
        });
    }

    const fieldError = (name) => {
        const key = errors[name]?.[0];
        return key ? t(`errors.${key}`) : undefined;
    };

    return (
        <Box sx={{ maxWidth: 640, mx: 'auto' }}>
            <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 700 }}>
                {t('title')}
            </Typography>
            <Card>
                <CardContent>
                    <Stack component="form" onSubmit={handleSubmit} spacing={3} noValidate>
                        {videos.length === 0 && <Alert severity="info">{t('noReadyVideos')}</Alert>}
                        {generalError && <Alert severity="error">{t(`errors.${generalError}`)}</Alert>}
                        {createdId && (
                            <Alert severity="success">
                                {t('created', { id: createdId })}{' '}
                                <Link href={`/stream/${createdId}`}>{t('openRoom')}</Link>
                            </Alert>
                        )}
                        <TextField
                            name="title"
                            label={t('streamTitle')}
                            error={Boolean(errors.title)}
                            helperText={fieldError('title')}
                            slotProps={{ htmlInput: { maxLength: 200 } }}
                            required
                        />
                        <TextField
                            name="videoId"
                            select
                            label={t('video')}
                            defaultValue=""
                            error={Boolean(errors.videoId)}
                            helperText={fieldError('videoId')}
                            required
                        >
                            <MenuItem value="">{t('chooseVideo')}</MenuItem>
                            {videos.map((video) => (
                                <MenuItem key={video.id} value={video.id}>{video.title}</MenuItem>
                            ))}
                        </TextField>
                        <FormControlLabel
                            control={<Checkbox name="requireAuth" />}
                            label={t('requireAuth')}
                        />
                        <Button type="submit" variant="contained" disabled={isPending || videos.length === 0}>
                            {isPending ? t('creating') : t('submit')}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}
