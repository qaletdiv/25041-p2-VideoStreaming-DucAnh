'use client';
import { useState, useTransition } from 'react';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import {
    Alert, Box, Button, Card, CardContent, Link as MuiLink, Stack, TextField, Typography,
} from '@mui/material';
import { Link } from '@/i18n/navigation';
import { registerSchema } from '@/lib/validations/auth';
import { apiFetch } from '@/lib/api';
import { toFormErrors } from '@/lib/apiErrors';

export default function RegisterForm() {
    const t = useTranslations('auth');
    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Lấy lỗi đầu tiên của một ô và dịch key sang ngôn ngữ hiện tại
    const errorOf = (field) => {
        const key = errors[field]?.[0];
        return key ? t(`errors.${key}`) : undefined;
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));

        // Kiểm tra phía client: phản hồi tức thì, không tốn lượt gọi server
        const result = registerSchema.safeParse(values);
        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors);
            return;
        }
        setErrors({});

        startTransition(async () => {
            const { ok, data } = await apiFetch('/auth/register', {
                method: 'POST',
                body: values,
            });

            if (ok) setSuccess(true);
            else setErrors(toFormErrors(data));
        });
    };

    return (
        <Card sx={{ maxWidth: 440, mx: 'auto', mt: 4 }}>
            <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
                    {t('register.title')}
                </Typography>

                {success ? (
                    <Alert severity="success">
                        {t('register.success')}{' '}
                        <MuiLink component={Link} href="/login">
                            {t('register.goToLogin')}
                        </MuiLink>
                    </Alert>
                ) : (
                    <Box component="form" onSubmit={handleSubmit} noValidate>
                        <Stack spacing={2}>
                            {errors.form && <Alert severity="error">{errorOf('form')}</Alert>}

                            <TextField
                                name="name"
                                label={t('register.name')}
                                autoComplete="name"
                                error={Boolean(errors.name)}
                                helperText={errorOf('name')}
                                required
                                fullWidth
                            />
                            <TextField
                                name="email"
                                type="email"
                                label={t('register.email')}
                                autoComplete="email"
                                error={Boolean(errors.email)}
                                helperText={errorOf('email')}
                                required
                                fullWidth
                            />
                            <TextField
                                name="password"
                                type="password"
                                label={t('register.password')}
                                autoComplete="new-password"
                                error={Boolean(errors.password)}
                                helperText={errorOf('password')}
                                required
                                fullWidth
                            />
                            <TextField
                                name="confirmPassword"
                                type="password"
                                label={t('register.confirmPassword')}
                                autoComplete="new-password"
                                error={Boolean(errors.confirmPassword)}
                                helperText={errorOf('confirmPassword')}
                                required
                                fullWidth
                            />

                            <Button type="submit" variant="contained" size="large" disabled={isPending}>
                                {t('register.submit')}
                            </Button>

                            <Typography variant="body2" align="center">
                                {t('register.hasAccount')}{' '}
                                <MuiLink component={Link} href="/login">
                                    {t('register.goToLogin')}
                                </MuiLink>
                            </Typography>
                        </Stack>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}