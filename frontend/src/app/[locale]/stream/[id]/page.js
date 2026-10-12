import { Box, Typography } from '@mui/material';
import { getLocale, getTranslations } from 'next-intl/server';
import { serverApiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/session';
import { redirect } from '@/i18n/navigation';
import LinkButton from '@/components/LinkButton';
import StreamLoginPrompt from '@/components/stream/StreamLoginPrompt';
import StreamRoom from '@/components/stream/StreamRoom';

export default async function StreamPage({ params }) {
    const { id } = await params;
    const result = await serverApiGet(`/streams/${encodeURIComponent(id)}`);

    if (result.status === 401) return <StreamLoginPrompt />;

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
    if (result.data.state?.status === 'ENDED' || result.data.stream.status === 'ENDED') {
        redirect({ href: user?.id === result.data.stream.owner.id ? '/dashboard' : '/', locale: await getLocale() });
    }
    return <StreamRoom stream={result.data.stream} initialState={result.data.state} user={user} />;
}
