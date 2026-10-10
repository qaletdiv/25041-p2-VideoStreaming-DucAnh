'use client';
import { useState, useTransition } from 'react';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import {
    Alert, Box, Button, Card, CardContent, Link as MuiLink, Stack, TextField, Typography,
} from '@mui/material';
import { Link, useRouter } from '@/i18n/navigation';
import { loginSchema } from '@/lib/validations/auth';
import { apiFetch } from '@/lib/api';
import { toFormErrors } from '@/lib/apiErrors';

export default function LoginForm() {
    const t = useTranslations('auth');
    const router = useRouter();
    const [errors, setErrors] = useState({});
    const [isPending, startTransition] = useTransition();

    const errorOf = (field) => {
        const key = errors[field]?.[0];
        return key ? t(`errors.${key}`) : undefined;
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget));

        const result = loginSchema.safeParse(values);
        if (!result.success) {
            setErrors(z.flattenError(result.error).fieldErrors);
            return;
        }
        setErrors({});

        startTransition(async () => {
            const { ok, data } = await apiFetch('/auth/login', {
                method: 'POST',
                body: values,
            });

            if (!ok) {
                setErrors(toFormErrors(data));
                return;
            }

            router.replace('/');
            router.refresh(); // buộc layout render lại để header thấy user mới
        });
    };

    return (
        <Card sx={{ maxWidth: 440, mx: 'auto', mt: 4 }}>
            <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
                    {t('login.title')}
                </Typography>

                <Box component="form" onSubmit={handleSubmit} noValidate>
                    <Stack spacing={2}>
                        {errors.form && <Alert severity="error">{errorOf('form')}</Alert>}

                        <TextField
                            name="email"
                            type="email"
                            label={t('login.email')}
                            autoComplete="email"
                            error={Boolean(errors.email)}
                            helperText={errorOf('email')}
                            required
                            fullWidth
                        />
                        <TextField
                            name="password"
                            type="password"
                            label={t('login.password')}
                            autoComplete="current-password"
                            error={Boolean(errors.password)}
                            helperText={errorOf('password')}
                            required
                            fullWidth
                        />

                        <Button type="submit" variant="contained" size="large" disabled={isPending}>
                            {t('login.submit')}
                        </Button>

                        <Typography variant="body2" align="center">
                            {t('login.noAccount')}{' '}
                            <MuiLink component={Link} href="/register">
                                {t('login.goToRegister')}
                            </MuiLink>
                        </Typography>
                    </Stack>
                </Box>
            </CardContent>
        </Card>
    );
}