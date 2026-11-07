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

function uploadCover({ file, credentials, onProgress }) {
    return new Promise((resolve, reject) => {
        const body = new FormData();
        body.append('file', file); body.append('api_key', credentials.apiKey);
        body.append('timestamp', String(credentials.timestamp)); body.append('signature', credentials.signature);
        body.append('folder', credentials.folder);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${credentials.cloudName}/image/upload`);
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded * 100 / event.total)); };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else reject(new Error('coverUploadFailed'));
        };
        xhr.onerror = () => reject(new Error('coverUploadFailed'));
        xhr.send(body);
    });
}

export default function CreateStreamForm({ videos }) {
    const t = useTranslations('streamCreate');
    const [errors, setErrors] = useState({});
    const [generalError, setGeneralError] = useState(null);
    const [createdId, setCreatedId] = useState(null);
    const [isPending, startTransition] = useTransition();
    const [cover, setCover] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);

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
            let coverPublicId;
            if (cover) {
                const signature = await apiFetch('/uploads/signature', { method: 'POST' });
                if (!signature.ok) { setGeneralError('coverUploadFailed'); return; }
                try {
                    const asset = await uploadCover({ file: cover, credentials: signature.data.data, onProgress: setUploadProgress });
                    coverPublicId = asset.public_id;
                } catch { setGeneralError('coverUploadFailed'); return; }
            }
            const result = await apiFetch('/streams', { method: 'POST', body: { ...parsed.data, ...(coverPublicId ? { coverPublicId } : {}) } });
            if (result.ok) {
                setCreatedId(result.data.stream.id);
            } else {
                const codes = { VIDEO_NOT_FOUND: 'videoUnavailable', INVALID_COVER_IMAGE: 'coverUploadFailed', COVER_FOLDER_MISMATCH: 'coverUploadFailed' };
                setGeneralError(codes[result.data?.error?.code] ?? 'serverError');
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
                        <Button component="label" variant="outlined" disabled={isPending}>
                            {cover?.name ?? t('coverImage')}
                            <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                const validType = file && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
                                setCover(validType && file.size <= 5 * 1024 * 1024 ? file : null);
                                setGeneralError(file && (!validType || file.size > 5 * 1024 * 1024) ? 'coverTooLarge' : null);
                            }} />
                        </Button>
                        {isPending && cover && <Typography variant="caption">{t('coverUploading', { progress: uploadProgress })}</Typography>}
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
