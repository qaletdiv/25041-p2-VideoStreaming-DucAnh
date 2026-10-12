import { Box, Typography } from '@mui/material';
import { getTranslations } from 'next-intl/server';
import { serverApiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/session';
import { requireUser } from '@/lib/guards';
import LinkButton from '@/components/LinkButton';
import StreamRoom from '@/components/stream/StreamRoom';

export default async function StreamPage({ params }) {
    const { id } = await params;
    const result = await serverApiGet(`/streams/${encodeURIComponent(id)}`);

    if (result.status === 401) await requireUser();

    if (!result.ok || !result.data?.stream) {
        const t = await getTranslations('streamRoom');
        return (
            <Box sx={{ py: 10, textAlign: 'center' }}>
                <Typography variant="h5" gutterBottom>{t('notFound')}</Typography>
                <LinkButton variant="contained" href="/">{t('backHome')}</LinkButton>
            </Box>
        );
    }

    const user = await getCurrentUser();
    return <StreamRoom stream={result.data.stream} initialState={result.data.state} user={user} />;
}
