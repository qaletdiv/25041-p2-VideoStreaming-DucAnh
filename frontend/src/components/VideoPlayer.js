'use client';
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Box } from '@mui/material';
import { apiFetch } from '@/lib/api';

export default function VideoPlayer({ video }) {
    const videoRef = useRef(null);
    // Chặn gọi trùng khi StrictMode mount lại effect trong dev
    const countedRef = useRef(false);

    useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        let hls = null;
        const isHls = video.videoUrl.endsWith('.m3u8');

        if (isHls && Hls.isSupported()) {
            // Chrome/Firefox: hls.js giải mã HLS
            hls = new Hls();
            hls.loadSource(video.videoUrl);
            hls.attachMedia(videoEl);
        } else {
            // Safari phát HLS sẵn; MP4 gắn trực tiếp
            videoEl.src = video.videoUrl;
        }

        // Đếm 1 lượt xem khi metadata đã tải (video phát được)
        const markViewed = () => {
            if (countedRef.current) return;
            countedRef.current = true;
            apiFetch(`/videos/${video.id}/views`, { method: 'POST' });
        };
        videoEl.addEventListener('loadeddata', markViewed);

        return () => {
            videoEl.removeEventListener('loadeddata', markViewed);
            if (hls) hls.destroy();
        };
    }, [video.id, video.videoUrl]);

    return (
        <Box sx={{ bgcolor: 'black', aspectRatio: '16 / 9' }}>
            <Box component="video" ref={videoRef} controls sx={{ width: '100%', height: '100%' }} />
        </Box>
    );
}
