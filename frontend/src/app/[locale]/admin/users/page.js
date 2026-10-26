import { getTranslations } from 'next-intl/server';
import { Typography } from '@mui/material';
import { requireRole } from '@/lib/guards';
import AdminUsers from '@/components/admin/AdminUsers';

export default async function AdminUsersPage() {
    const user = await requireRole('ADMIN');
    const t = await getTranslations('nav');

    return (
        <>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 3 }}>
                {t('users')}
            </Typography>
            <AdminUsers currentUserId={user.id} />
        </>
    );
}
