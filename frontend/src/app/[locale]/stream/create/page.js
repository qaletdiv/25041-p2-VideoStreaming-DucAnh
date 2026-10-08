import { getTranslations } from 'next-intl/server';
import { Typography } from '@mui/material';
import { requireUser } from '@/lib/guards';

export default async function CreateStreamPage() {
    await requireUser();
    const t = await getTranslations('nav');

    return (
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            {t('createStream')}
        </Typography>
    );
}