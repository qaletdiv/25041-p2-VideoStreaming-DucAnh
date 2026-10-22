'use client';
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Box } from '@mui/material';
import { useVideoView } from '@/lib/useVideoView';

export default function VideoPlayer({ video }) {
    const videoRef = useRef(null);
    useVideoView(videoRef, video.id);

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

        return () => {
            if (hls) hls.destroy();
        };
    }, [video.id, video.videoUrl]);

    return (
        <Box sx={{ bgcolor: 'black', aspectRatio: '16 / 9' }}>
            <Box component="video" ref={videoRef} controls sx={{ width: '100%', height: '100%' }} />
        </Box>
    );
}
