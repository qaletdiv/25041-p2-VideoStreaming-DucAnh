import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import {
    getStreamState,
    initializeStreamState,
    restoreStreamState,
    transitionStreamState,
    withStreamControlLock,
} from './streamState.service.js';

export async function createStream(user, { title, videoId, requireAuth }) {
    const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { id: true, uploaderId: true, status: true },
    });
    if (!video || video.status !== 'READY') {
        throw new HttpError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    }
    if (video.uploaderId !== user.id && user.role !== 'ADMIN') {
        throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to stream this video');
    }

    const stream = await prisma.stream.create({
        data: { title, videoId, requireAuth, ownerId: user.id },
    });

    try {
        await initializeStreamState(stream.id);
    } catch (error) {
        await prisma.stream.delete({ where: { id: stream.id } });
        throw error;
    }

    return stream;
}

export async function listStreams() {
    return prisma.stream.findMany({
        where: { status: { not: 'ENDED' }, video: { status: 'READY' } },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: {
            id: true,
            title: true,
            status: true,
            requireAuth: true,
            owner: { select: { name: true } },
            video: { select: { thumbnailUrl: true } },
        },
    });
}

export async function getStream(id, user) {
    const stream = await prisma.stream.findUnique({
        where: { id },
        select: {
            id: true,
            title: true,
            status: true,
            requireAuth: true,
            positionMs: true,
            stateChangedAt: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
            owner: { select: { id: true, name: true } },
            video: {
                select: {
                    id: true,
                    title: true,
                    videoUrl: true,
                    thumbnailUrl: true,
                    duration: true,
                    status: true,
                },
            },
        },
    });
    if (!stream || stream.video.status !== 'READY') {
        throw new HttpError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    }
    if (stream.requireAuth && !user) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const state = await getStreamState(id);
    return { stream, state };
}

export async function controlStream(id, user, { action, positionMs = 0 }) {
    const result = await withStreamControlLock(id, async () => {
        const stream = await prisma.stream.findUnique({
            where: { id },
            select: {
                ownerId: true,
                startedAt: true,
                video: { select: { duration: true, status: true } },
            },
        });
        if (!stream || stream.video.status !== 'READY') {
            throw new HttpError(404, 'STREAM_NOT_FOUND', 'Stream not found');
        }
        if (stream.ownerId !== user.id && user.role !== 'ADMIN') {
            throw new HttpError(403, 'FORBIDDEN', 'You do not control this stream');
        }

        const previous = await getStreamState(id);
        if (!previous) {
            throw new HttpError(503, 'STATE_UNAVAILABLE', 'Stream state is unavailable');
        }

        let state;
        try {
            state = await transitionStreamState(
                id, action, stream.video.duration * 1000, positionMs,
            );
        } catch (error) {
            if (error instanceof RangeError) {
                throw new HttpError(409, 'INVALID_STREAM_ACTION', 'Invalid stream action');
            }
            throw error;
        }

        const changedAt = new Date(state.serverNow);
        try {
            await prisma.stream.update({
                where: { id },
                data: {
                    status: state.status,
                    positionMs: state.positionMs,
                    stateChangedAt: changedAt,
                    ...(action === 'PLAY' && !stream.startedAt ? { startedAt: changedAt } : {}),
                    ...(action === 'END' ? { endedAt: changedAt } : {}),
                },
            });
        } catch (error) {
            const { serverNow, ...snapshot } = previous;
            await restoreStreamState(id, snapshot);
            throw error;
        }

        return state;
    });

    if (!result) throw new HttpError(409, 'STREAM_BUSY', 'Stream control is busy');
    return result;
}
