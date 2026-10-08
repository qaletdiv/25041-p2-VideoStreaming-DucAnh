import { getTranslations } from 'next-intl/server';
import { Box, Button, Typography } from '@mui/material';
import { Link } from '@/i18n/navigation';

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
            <Button variant="contained" component={Link} href="/">
                {t('backHome')}
            </Button>
        </Box>
    );
}