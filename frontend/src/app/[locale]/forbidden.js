import { getTranslations } from 'next-intl/server';
import { Box, Typography } from '@mui/material';
import LinkButton from '@/components/LinkButton';

export default async function Forbidden() {
    const t = await getTranslations('forbidden');

    return (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
                {t('title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                {t('description')}
            </Typography>
            <LinkButton variant="contained" href="/">
                {t('backHome')}
            </LinkButton>
        </Box>
    );
}