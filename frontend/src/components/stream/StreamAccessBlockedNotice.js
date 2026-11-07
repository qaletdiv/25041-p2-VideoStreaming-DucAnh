'use client';
import { useTranslations } from 'next-intl';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useRouter } from '@/i18n/navigation';

export default function StreamAccessBlockedNotice({ open }) {
    const t = useTranslations('streamRoom');
    const router = useRouter();

    function close() {
        router.replace('/');
    }

    return (
        <Dialog open={open} onClose={close} aria-labelledby="stream-access-blocked-title" maxWidth="xs" fullWidth>
            <DialogTitle id="stream-access-blocked-title">{t('accessDeniedTitle')}</DialogTitle>
            <DialogContent>{t('accessDeniedMessage')}</DialogContent>
            <DialogActions>
                <Button onClick={close} autoFocus>{t('closeNotice')}</Button>
            </DialogActions>
        </Dialog>
    );
}
