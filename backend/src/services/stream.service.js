import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { getStreamState, initializeStreamState } from './streamState.service.js';

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
