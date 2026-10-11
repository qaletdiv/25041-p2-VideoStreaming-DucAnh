'use client';
import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
    Alert, Box, Button, Card, CardContent, FormControl, InputLabel,
    LinearProgress, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import { videoMetaSchema, MAX_FILE_SIZE, ACCEPTED_VIDEO_TYPES } from '@/lib/validations/video';
import { z } from 'zod';

// ── Hàm upload XHR lên Cloudinary ──────────────────────────────────────
// Dùng XHR vì fetch không hỗ trợ upload progress.
// URL: /v1_1/{cloud}/video/upload — resource_type nằm trong path, không ký.
function uploadToCloudinary({ file, cloudName, apiKey, folder, timestamp, signature, onProgress }) {
    return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('api_key', apiKey);
        fd.append('timestamp', String(timestamp));
        fd.append('signature', signature);
        fd.append('folder', folder);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                let msg = `Cloudinary HTTP ${xhr.status}`;
                try { msg = JSON.parse(xhr.responseText).error?.message || msg; } catch {}
                reject(new Error(msg));
            }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        xhr.send(fd);
    });
}

// ── Format dung lượng file ─────────────────────────────────────────────
function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ──────────────────────────────────────────────────────────
export default function VideoUploadForm({ categories = [] }) {
    const t = useTranslations('upload');
    const router = useRouter();

    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [phase, setPhase] = useState('idle'); // idle | uploading | registering | success | error
    const [progress, setProgress] = useState(0);
    const [generalError, setGeneralError] = useState(null);
    const fileInputRef = useRef(null);

    // ── Chọn / validate file ───────────────────────────────────────────
    const handleFileChange = useCallback((selectedFile) => {
        if (!selectedFile) return;

        if (!ACCEPTED_VIDEO_TYPES.includes(selectedFile.type) && !selectedFile.type.startsWith('video/')) {
            setErrors((prev) => ({ ...prev, file: ['fileInvalidType'] }));
            return;
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            setErrors((prev) => ({ ...prev, file: ['fileTooLarge'] }));
            return;
        }

        setFile(selectedFile);
        setErrors((prev) => {
            const { file: _, ...rest } = prev;
            return rest;
        });
    }, []);

    const handleInputChange = (e) => handleFileChange(e.target.files?.[0]);

    // Drag & drop
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleFileChange(e.dataTransfer.files?.[0]);
    };

    // Lấy bản dịch lỗi theo key
    const errorOf = (field) => {
        const key = errors[field]?.[0];
        return key ? t(`errors.${key}`) : undefined;
    };

    // ── Submit: 3 giai đoạn ────────────────────────────────────────────
    const handleSubmit = async (event) => {
        event.preventDefault();
        setGeneralError(null);

        // Phải chọn file
        if (!file) {
            setErrors((prev) => ({ ...prev, file: ['fileRequired'] }));
            return;
        }

        // Validate metadata
        const formData = Object.fromEntries(new FormData(event.currentTarget));
        const result = videoMetaSchema.safeParse(formData);
        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors);
            return;
        }
        setErrors({});

        try {
            // Giai đoạn 1: xin chữ ký
            setPhase('uploading');
            setProgress(0);

            const sigRes = await apiFetch('/uploads/signature', { method: 'POST' });
            if (!sigRes.ok) {
                throw new Error(t('errors.signatureFailed'));
            }
            const sig = sigRes.data.data;

            // Giai đoạn 2: upload lên Cloudinary
            const cloudResult = await uploadToCloudinary({
                file,
                cloudName: sig.cloudName,
                apiKey: sig.apiKey,
                folder: sig.folder,
                timestamp: sig.timestamp,
                signature: sig.signature,
                onProgress: setProgress,
            });

            // Giai đoạn 3: đăng ký video với backend
            setPhase('registering');

            const body = { publicId: cloudResult.public_id, title: result.data.title };
            if (result.data.description) body.description = result.data.description;
            if (result.data.categoryId) body.categoryId = result.data.categoryId;

            const videoRes = await apiFetch('/videos', { method: 'POST', body });
            if (!videoRes.ok) {
                throw new Error(videoRes.data?.error?.message || t('errors.serverError'));
            }

            // Thành công
            setPhase('success');
            setTimeout(() => {
                router.replace('/dashboard');
                router.refresh();
            }, 1500);
        } catch (err) {
            setPhase('error');
            setGeneralError(err.message || t('errors.serverError'));
        }
    };

    const isSubmitting = phase === 'uploading' || phase === 'registering';

    return (
        <Card sx={{ maxWidth: 600, mx: 'auto', mt: 2 }}>
            <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
                    {t('title')}
                </Typography>

                <Box component="form" onSubmit={handleSubmit} noValidate>
                    <Stack spacing={3}>
                        {/* Thông báo lỗi / thành công */}
                        {generalError && <Alert severity="error">{generalError}</Alert>}
                        {phase === 'success' && <Alert severity="success">{t('success')}</Alert>}

                        {/* ── Khu vực kéo thả chọn file ────────────────────── */}
                        <Box
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => !isSubmitting && fileInputRef.current?.click()}
                            sx={{
                                border: '2px dashed',
                                borderColor: errors.file ? 'error.main' : 'divider',
                                borderRadius: 2,
                                p: 4,
                                textAlign: 'center',
                                cursor: isSubmitting ? 'default' : 'pointer',
                                transition: 'border-color 0.2s, background 0.2s',
                                '&:hover': !isSubmitting ? {
                                    borderColor: 'primary.main',
                                    bgcolor: 'action.selected',
                                } : {},
                                bgcolor: 'action.hover',
                            }}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleInputChange}
                                hidden
                                disabled={isSubmitting}
                            />
                            {file ? (
                                <Box>
                                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                        {file.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {formatSize(file.size)}
                                    </Typography>
                                </Box>
                            ) : (
                                <Box>
                                    <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                                    <Typography variant="body1">{t('dragDrop')}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('maxSize', { size: '100 MB' })}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                        {errors.file && (
                            <Typography variant="caption" color="error" sx={{ mt: -2 }}>
                                {errorOf('file')}
                            </Typography>
                        )}

                        {/* ── Thanh tiến trình ──────────────────────────────── */}
                        {isSubmitting && (
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {phase === 'uploading' ? t('uploading') : t('registering')}
                                    </Typography>
                                    {phase === 'uploading' && (
                                        <Typography variant="body2" color="text.secondary">
                                            {progress}%
                                        </Typography>
                                    )}
                                </Box>
                                <LinearProgress
                                    variant={phase === 'uploading' ? 'determinate' : 'indeterminate'}
                                    value={progress}
                                />
                            </Box>
                        )}

                        {/* ── Metadata ──────────────────────────────────────── */}
                        <TextField
                            name="title"
                            label={t('videoTitle')}
                            error={Boolean(errors.title)}
                            helperText={errorOf('title')}
                            required
                            fullWidth
                            disabled={isSubmitting}
                            slotProps={{ htmlInput: { maxLength: 200 } }}
                        />

                        <TextField
                            name="description"
                            label={t('description')}
                            error={Boolean(errors.description)}
                            helperText={errorOf('description')}
                            fullWidth
                            multiline
                            rows={3}
                            disabled={isSubmitting}
                            slotProps={{ htmlInput: { maxLength: 2000 } }}
                        />

                        <FormControl fullWidth disabled={isSubmitting}>
                            <InputLabel id="upload-category-label">{t('category')}</InputLabel>
                            <Select
                                name="categoryId"
                                labelId="upload-category-label"
                                label={t('category')}
                                defaultValue=""
                            >
                                <MenuItem value="">
                                    <em>{t('categoryNone')}</em>
                                </MenuItem>
                                {categories.map((cat) => (
                                    <MenuItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* ── Nút submit ────────────────────────────────────── */}
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={isSubmitting || phase === 'success'}
                            startIcon={<CloudUploadIcon />}
                        >
                            {isSubmitting ? t('uploading') : t('submit')}
                        </Button>
                    </Stack>
                </Box>
            </CardContent>
        </Card>
    );
}
