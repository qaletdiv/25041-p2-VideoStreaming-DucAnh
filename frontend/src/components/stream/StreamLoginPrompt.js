'use client';
import { useTranslations } from 'next-intl';
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, Stack, Typography } from '@mui/material';
import { Link } from '@/i18n/navigation';

export default function StreamLoginPrompt() {
    const t = useTranslations('streamRoom');

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', position: 'relative' }}>
            {/* Chỉ vẽ khung phòng, không tải nội dung stream khi khách chưa đăng nhập. */}
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ bgcolor: 'grey.900', aspectRatio: '16 / 9' }} />
                    <Card sx={{ mt: 2 }}>
                        <CardContent>
                            <Box sx={{ bgcolor: 'action.hover', width: '60%', height: 28, mb: 2 }} />
                            <Box sx={{ bgcolor: 'action.hover', width: '35%', height: 18 }} />
                        </CardContent>
                    </Card>
                </Box>
                <Card sx={{ width: { xs: '100%', lg: 340 }, minHeight: 320 }}>
                    <CardContent>
                        <Typography variant="h6">{t('chat')}</Typography>
                    </CardContent>
                </Card>
            </Stack>
            <Dialog open disableEscapeKeyDown aria-labelledby="stream-login-title" maxWidth="xs" fullWidth>
                <DialogContent>
                    <Typography id="stream-login-title" variant="h6" align="center">
                        {t('loginRequired')}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                    <Button component={Link} href="/login" variant="contained">{t('login')}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
