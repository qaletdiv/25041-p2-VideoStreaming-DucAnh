'use client';
import { useEffect } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Box, Typography } from '@mui/material';

export default function DonationOverlay({ donation, onComplete, geometry, preview = false }) {
    const t = useTranslations('donation');
    const format = useFormatter();

    useEffect(() => {
        if (!donation || preview) return;
        const timer = setTimeout(onComplete, 5000);
        return () => clearTimeout(timer);
    }, [donation?.id, onComplete, preview]);

    if (!donation) return null;

    return (
        <Box
            key={donation.id}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            sx={{
                position: 'absolute', top: `${geometry.y}%`, left: `${geometry.x}%`, zIndex: 1,
                width: `${geometry.width}%`, height: `${geometry.height}%`, boxSizing: 'border-box', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 2 }, borderRadius: 2,
                bgcolor: 'rgba(35, 20, 75, 0.92)', color: 'white',
                border: '1px solid', borderColor: 'primary.light',
                boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                textAlign: 'center', overflowWrap: 'anywhere', pointerEvents: 'none',
                animation: 'donationAppear 250ms ease-out',
                '@keyframes donationAppear': { from: { opacity: 0 }, to: { opacity: 1 } },
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
        >
            <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', sm: '1.1rem' } }}>
                {t('received', {
                    name: donation.user.name,
                    amount: format.number(donation.amount, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }),
                })}
            </Typography>
            {donation.message && (
                <Typography sx={{ mt: 0.5, fontSize: { xs: '0.75rem', sm: '0.95rem' }, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {donation.message}
                </Typography>
            )}
        </Box>
    );
}
