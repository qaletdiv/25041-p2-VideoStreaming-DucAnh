import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { countViewers, getStreamState } from './streamState.service.js';

const SAMPLE_INTERVAL_MS = 10_000;

// Mỗi phòng chỉ ghi một mẫu trong mỗi khoảng 10 giây
export async function samplePlayingStreams(now = new Date()) {
    const streams = await prisma.stream.findMany({
        where: { status: 'PLAYING' },
        select: { id: true, video: { select: { duration: true } } },
    });
    const bucket = Math.floor(now.getTime() / SAMPLE_INTERVAL_MS);
    const ts = now;
    let saved = 0;

    for (const stream of streams) {
        const state = await getStreamState(stream.id);
        if (state?.status !== 'PLAYING' || !Number.isFinite(state.stateChangedAt)) continue;

        const sampleKey = `stream:${stream.id}:sample:${bucket}`;
        const claimed = await redis.set(sampleKey, '1', 'EX', 30, 'NX');
        if (claimed !== 'OK') continue;

        const { viewers } = await countViewers(stream.id);
        const durationMs = stream.video.duration * 1000;
        const positionMs = Math.min(
            durationMs,
            Math.max(0, state.positionMs + now.getTime() - state.stateChangedAt),
        );

        try {
            await prisma.streamSample.create({
                data: { streamId: stream.id, ts, viewers, positionMs },
            });
            saved += 1;
        } catch (error) {
            if (error.code !== 'P2002') throw error;
        }
    }

    return saved;
}
