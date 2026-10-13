'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Hls from 'hls.js';
import { io } from 'socket.io-client';
import {
    Alert, Box, Button, Card, CardContent, Chip, Divider, Slider,
    Stack, TextField, Typography,
} from '@mui/material';
import { Link, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import DonationPanel from '@/components/stream/DonationPanel';
import DonationOverlay from '@/components/stream/DonationOverlay';
import OverlaySettings from '@/components/stream/OverlaySettings';

const socketUrl = new URL(process.env.NEXT_PUBLIC_API_URL).origin;
const receivedState = (value) => value ? { ...value, receivedAt: Date.now() } : null;

export default function StreamRoom({ stream, initialState, user }) {
    const t = useTranslations('streamRoom');
    const overlayText = useTranslations('overlay');
    const router = useRouter();
    const videoRef = useRef(null);
    const socketRef = useRef(null);
    const [state, setState] = useState(() => receivedState(initialState));
    const [viewers, setViewers] = useState(0);
    const [messages, setMessages] = useState([]);
    const [chatText, setChatText] = useState('');
    const [currentTime, setCurrentTime] = useState(0);
    const [muted, setMuted] = useState(true);
    const [needsPlay, setNeedsPlay] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [donationQueue, setDonationQueue] = useState([]);
    const [overlay, setOverlay] = useState(stream.donationOverlay);
    const [overlayDraft, setOverlayDraft] = useState(null);
    const [overlayBusy, setOverlayBusy] = useState(false);
    const seenDonations = useRef(new Set());
    const finishDonation = useCallback(() => {
        setDonationQueue((previous) => previous.slice(1));
    }, []);
    const isOwner = user?.id === stream.owner.id || user?.role === 'ADMIN';
    const isCreator = user?.id === stream.owner.id;
    const leaveEndedStream = useCallback(() => {
        router.replace(isCreator ? '/dashboard' : '/');
    }, [isCreator, router]);

    useEffect(() => {
        if (state?.status === 'ENDED') leaveEndedStream();
    }, [state?.status, leaveEndedStream]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let hls;
        if (stream.video.videoUrl.endsWith('.m3u8') && Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(stream.video.videoUrl);
            hls.attachMedia(video);
        } else {
            video.src = stream.video.videoUrl;
        }
        return () => {
            if (hls) hls.destroy();
        };
    }, [stream.video.videoUrl]);

    useEffect(() => {
        const socket = io(socketUrl, { withCredentials: true });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('stream:join', { streamId: stream.id }, (reply) => {
                if (reply?.code === 'STREAM_ENDED') {
                    leaveEndedStream();
                    return;
                }
                if (!reply?.ok) {
                    setError(reply?.code ?? 'CONNECTION_ERROR');
                    return;
                }
                setError(null);
                setState(receivedState(reply.state));
                setViewers(reply.viewers);
                setMessages(reply.messages);
                if (reply.overlay) setOverlay(reply.overlay);
            });
        });
        socket.on('connect_error', () => setError('CONNECTION_ERROR'));
        socket.on('stream:state', (next) => setState(receivedState(next)));
        socket.on('stream:overlay', setOverlay);
        socket.on('stream:ended', ({ streamId }) => {
            if (streamId === stream.id) leaveEndedStream();
        });
        socket.on('stream:chat', (message) => {
            setMessages((previous) => [...previous, message].slice(-100));
        });
        socket.on('stream:donation', (donation) => {
            if (donation.streamId !== stream.id || seenDonations.current.has(donation.id)) return;
            seenDonations.current.add(donation.id);
            // Chỉ giữ các mã gần đây để tránh bộ nhớ tăng theo thời gian xem.
            if (seenDonations.current.size > 200) {
                seenDonations.current.delete(seenDonations.current.values().next().value);
            }
            setDonationQueue((previous) => [...previous, donation]);
        });

        const heartbeat = setInterval(() => {
            if (!socket.connected) return;
            socket.emit('stream:heartbeat', (reply) => {
                if (reply?.ok) setViewers(reply.viewers);
            });
        }, 10_000);

        return () => {
            clearInterval(heartbeat);
            socket.disconnect();
            socketRef.current = null;
        };
    }, [stream.id, leaveEndedStream]);

    useEffect(() => {
        // Khi Socket.io gián đoạn, vẫn phát hiện phòng đã kết thúc.
        const timer = setInterval(async () => {
            const result = await apiFetch(`/streams/${stream.id}`);
            if (result.ok && (result.data.state?.status === 'ENDED' || result.data.stream?.status === 'ENDED')) {
                leaveEndedStream();
            }
        }, 10_000);
        return () => clearInterval(timer);
    }, [stream.id, leaveEndedStream]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !state) return;

        const sync = () => {
            if (video.readyState < 1) return;
            const elapsed = state.status === 'PLAYING' && state.stateChangedAt
                ? Math.max(0, state.serverNow + Date.now() - state.receivedAt - state.stateChangedAt)
                : 0;
            const target = Math.min(
                stream.video.duration,
                (state.positionMs + elapsed) / 1000,
            );
            if (Math.abs(video.currentTime - target) > 1.5) video.currentTime = target;
            if (state.status === 'PLAYING') {
                video.play().then(() => setNeedsPlay(false)).catch(() => setNeedsPlay(true));
            } else {
                video.pause();
                setNeedsPlay(false);
            }
        };

        video.addEventListener('loadedmetadata', sync);
        sync();
        const timer = setInterval(sync, 2_000);
        return () => {
            video.removeEventListener('loadedmetadata', sync);
            clearInterval(timer);
        };
    }, [state, stream.video.duration]);

    async function control(action, positionMs) {
        setBusy(true);
        const body = action === 'SEEK' ? { action, positionMs } : { action };
        const result = await apiFetch(`/streams/${stream.id}/actions`, { method: 'POST', body });
        setBusy(false);
        if (result.ok) {
            if (action === 'END' && result.data.state?.status === 'ENDED') {
                leaveEndedStream();
                return;
            }
            setState(receivedState(result.data.state));
            setError(null);
        } else {
            setError(result.data?.error?.code ?? 'CONNECTION_ERROR');
        }
    }

    function sendChat(event) {
        event.preventDefault();
        const text = chatText.trim();
        if (!text || !socketRef.current?.connected) return;
        socketRef.current.emit('stream:chat:send', { text }, (reply) => {
            if (reply?.ok) {
                setChatText('');
                setError(null);
            } else {
                setError(reply?.code ?? 'CONNECTION_ERROR');
            }
        });
    }

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ position: 'relative', bgcolor: 'black', aspectRatio: '16 / 9' }}>
                        <Box
                            component="video"
                            ref={videoRef}
                            muted={muted}
                            playsInline
                            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                            sx={{ width: '100%', height: '100%' }}
                        />
                        <DonationOverlay
                            donation={overlayDraft ? { id: 'preview', amount: 10000, user: { name: overlayText('previewName') }, message: overlayText('previewMessage') } : donationQueue[0]}
                            geometry={overlayDraft ?? overlay}
                            preview={Boolean(overlayDraft)} onComplete={finishDonation}
                            onGeometryChange={setOverlayDraft} disabled={overlayBusy}
                        />
                        {needsPlay && (
                            <Button
                                variant="contained"
                                onClick={() => videoRef.current?.play()}
                                sx={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                            >
                                {t('tapToPlay')}
                            </Button>
                        )}
                    </Box>
                    <Card sx={{ mt: 2 }}>
                        <CardContent>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>{stream.title}</Typography>
                                <Chip size="small" label={t(`status.${state?.status ?? 'CREATED'}`)} />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                                {t('owner', { name: stream.owner.name })} · {t('viewers', { count: viewers })}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>{stream.video.title}</Typography>
                            <Button onClick={() => setMuted((value) => !value)} sx={{ mt: 1 }}>
                                {muted ? t('unmute') : t('mute')}
                            </Button>
                            {isOwner && (
                                <Stack spacing={1} sx={{ mt: 2 }}>
                                    <Slider
                                        value={Math.min(currentTime, stream.video.duration)}
                                        min={0}
                                        max={Math.max(1, stream.video.duration)}
                                        onChangeCommitted={(_, value) => control('SEEK', Math.round(value * 1000))}
                                        disabled={busy || state?.status === 'CREATED' || state?.status === 'ENDED'}
                                        aria-label={t('seek')}
                                    />
                                    <Stack direction="row" spacing={1}>
                                        <Button onClick={() => control('PLAY')} disabled={busy || state?.status === 'PLAYING' || state?.status === 'ENDED'}>{t('play')}</Button>
                                        <Button onClick={() => control('PAUSE')} disabled={busy || state?.status !== 'PLAYING'}>{t('pause')}</Button>
                                        <Button color="error" onClick={() => control('END')} disabled={busy || state?.status === 'ENDED'}>{t('end')}</Button>
                                    </Stack>
                                </Stack>
                            )}
                            {isCreator && <OverlaySettings streamId={stream.id} value={overlay} draft={overlayDraft} onPreview={setOverlayDraft} onSaved={setOverlay} onBusyChange={setOverlayBusy} />}
                        </CardContent>
                    </Card>
                </Box>
                <Card sx={{ width: { xs: '100%', lg: 340 }, display: 'flex', flexDirection: 'column', maxHeight: 650 }}>
                    <CardContent sx={{ flexGrow: 1, overflowY: 'auto' }}>
                        <Typography variant="h6" gutterBottom>{t('chat')}</Typography>
                        <Stack spacing={1}>
                            {messages.map((message) => (
                                <Typography key={message.id} variant="body2">
                                    <Box component="strong">{message.user.name}: </Box>{message.text}
                                </Typography>
                            ))}
                        </Stack>
                    </CardContent>
                    <Divider />
                    <Box component="form" onSubmit={sendChat} sx={{ p: 2 }}>
                        {user ? (
                            <Stack spacing={1}>
                                <TextField
                                    value={chatText}
                                    onChange={(event) => setChatText(event.target.value)}
                                    label={t('message')}
                                    slotProps={{ htmlInput: { maxLength: 500 } }}
                                    size="small"
                                    fullWidth
                                />
                                <Button type="submit" variant="contained" disabled={!chatText.trim()}>{t('send')}</Button>
                            </Stack>
                        ) : (
                            <Typography variant="body2">
                                <Link href="/login">{t('signInToChat')}</Link>
                            </Typography>
                        )}
                    </Box>
                </Card>
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{t(`errors.${error}`)}</Alert>}
            {!isCreator && <DonationPanel streamId={stream.id} user={user} />}
        </Box>
    );
}
