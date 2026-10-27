'use client';
import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';

export function useVideoView(videoRef, videoId, streamId, enabled = true) {
    const sessionRef = useRef(null);

    useEffect(() => {
        const element = videoRef.current;
        if (!element) return;
        const key = `${videoId}:${streamId ?? 'vod'}`;
        if (sessionRef.current?.key !== key) {
            sessionRef.current = { key, id: crypto.randomUUID(), played: false, done: false };
        }
        const session = sessionRef.current;
        let active = true;
        let pending = false;
        let retry;
        async function record() {
            if (!active || !enabled || !session.played || session.done || pending) return;
            clearTimeout(retry);
            pending = true;
            const result = await apiFetch(`/videos/${encodeURIComponent(videoId)}/views`, {
                method: 'POST',
                body: { sessionId: session.id, ...(streamId ? { streamId } : {}) },
            });
            pending = false;
            if (result.ok) session.done = true;
            if (!active || result.ok) return;
            const canRetry = result.status === 0 || result.status >= 500
                || result.data?.error?.code === 'STREAM_BUSY';
            if (canRetry) retry = setTimeout(record, 5000);
            else session.done = true;
        }
        function playing() {
            session.played = true;
            record();
        }
        element.addEventListener('playing', playing);
        // Khi join/reconnect xong, video có thể đã phát trước đó.
        if (!element.paused && element.readyState >= 3) session.played = true;
        record();
        return () => {
            active = false;
            clearTimeout(retry);
            element.removeEventListener('playing', playing);
        };
    }, [videoRef, videoId, streamId, enabled]);
}
