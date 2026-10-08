import { getTranslations } from 'next-intl/server';
import { Typography } from '@mui/material';
import { requireRole } from '@/lib/guards';

export default async function AdminUsersPage() {
    await requireRole('ADMIN');
    const t = await getTranslations('nav');

    return (
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            {t('users')}
        </Typography>
    );
}