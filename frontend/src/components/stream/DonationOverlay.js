'use client';
import { useEffect, useRef } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Box, Typography } from '@mui/material';

export default function DonationOverlay({ donation, onComplete, geometry, preview = false, onGeometryChange, disabled = false }) {
    const t = useTranslations('donation');
    const controls = useTranslations('overlay');
    const format = useFormatter();
    const boxRef = useRef(null);
    const gestureRef = useRef(null);

    function update(original, dx, dy, resize) {
        const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));
        onGeometryChange(resize ? {
            ...original,
            width: clamp(original.width + dx, 20, 100 - original.x),
            height: clamp(original.height + dy, 15, 100 - original.y),
        } : {
            ...original,
            x: clamp(original.x + dx, 0, 100 - original.width),
            y: clamp(original.y + dy, 0, 100 - original.height),
        });
    }

    function begin(event, resize = false) {
        if (!preview || disabled || event.button !== 0 || gestureRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        const bounds = boxRef.current.parentElement.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        // Đổi quãng kéo từ pixel sang phần trăm của khung video.
        gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, geometry, bounds, resize };
        boxRef.current.setPointerCapture(event.pointerId);
    }

    function move(event) {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId || disabled) return;
        update(gesture.geometry, (event.clientX - gesture.x) / gesture.bounds.width * 100,
            (event.clientY - gesture.y) / gesture.bounds.height * 100, gesture.resize);
    }

    function end(event) {
        if (gestureRef.current?.pointerId !== event.pointerId) return;
        gestureRef.current = null;
        if (boxRef.current.hasPointerCapture(event.pointerId)) boxRef.current.releasePointerCapture(event.pointerId);
    }

    function keyboard(event, resize = false) {
        if (!preview || disabled) return;
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 5 : 1;
        update(geometry, direction[0] * step, direction[1] * step, resize);
    }

    useEffect(() => {
        if (!donation || preview) return;
        const timer = setTimeout(onComplete, 5000);
        return () => clearTimeout(timer);
    }, [donation?.id, onComplete, preview]);

    if (!donation) return null;

    return (
        <Box
            key={donation.id}
            ref={boxRef}
            role={preview ? 'group' : 'status'}
            tabIndex={preview ? 0 : undefined}
            aria-label={preview ? controls('move') : undefined}
            aria-live={preview ? 'off' : 'polite'}
            aria-atomic="true"
            onPointerDown={begin}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={() => { gestureRef.current = null; }}
            onKeyDown={keyboard}
            sx={{
                position: 'absolute', top: `${geometry.y}%`, left: `${geometry.x}%`, zIndex: 1,
                width: `${geometry.width}%`, height: `${geometry.height}%`, boxSizing: 'border-box', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 2 }, borderRadius: 2,
                bgcolor: 'rgba(35, 20, 75, 0.92)', color: 'white',
                border: '1px solid', borderColor: 'primary.light',
                boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                textAlign: 'center', overflowWrap: 'anywhere', pointerEvents: preview ? 'auto' : 'none',
                cursor: preview ? (disabled ? 'wait' : 'move') : 'default',
                touchAction: preview ? 'none' : 'auto', userSelect: preview ? 'none' : 'auto',
                outline: preview ? '2px dashed white' : 'none', outlineOffset: -3,
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
            {preview && (
                <Box component="button" type="button" aria-label={controls('resize')} disabled={disabled}
                    onPointerDown={(event) => begin(event, true)} onKeyDown={(event) => keyboard(event, true)}
                    sx={{ position: 'absolute', right: 0, bottom: 0, width: 28, height: 28,
                        border: 0, bgcolor: 'primary.main', cursor: 'nwse-resize', touchAction: 'none',
                        '&::after': { content: '""', position: 'absolute', right: 5, bottom: 5,
                            width: 10, height: 10, borderRight: '2px solid white', borderBottom: '2px solid white' } }}
                />
            )}
        </Box>
    );
}
