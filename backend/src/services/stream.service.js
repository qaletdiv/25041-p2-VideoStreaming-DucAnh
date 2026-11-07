import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { getImageResource } from '../lib/cloudinaryAdmin.js';
import {
    getStreamState,
    initializeStreamState,
    restoreStreamState,
    transitionStreamState,
    withStreamControlLock,
} from './streamState.service.js';

export async function createStream(user, { title, videoId, requireAuth, coverPublicId }) {
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

    let coverImageUrl;
    if (coverPublicId) {
        if (!coverPublicId.startsWith(`user_${user.id}/`)) throw new HttpError(403, 'COVER_FOLDER_MISMATCH', 'Cover folder does not match account');
        const image = await getImageResource(coverPublicId);
        if (!image?.secure_url || image.resource_type !== 'image' || image.bytes > 5 * 1024 * 1024
            || image.format && !['jpg', 'jpeg', 'png', 'webp'].includes(image.format)) {
            throw new HttpError(400, 'INVALID_COVER_IMAGE', 'Cover image is invalid');
        }
        coverImageUrl = image.secure_url;
    }
    const stream = await prisma.stream.create({
        data: { title, videoId, requireAuth, ownerId: user.id, coverImageUrl },
    });

    try {
        await initializeStreamState(stream.id);
    } catch (error) {
        await prisma.stream.delete({ where: { id: stream.id } });
        throw error;
    }

    return stream;
}

export async function listUnfinishedStreams(ownerId) {
    return prisma.stream.findMany({ where: { ownerId, status: { not: 'ENDED' } }, select: { id: true } });
}

export async function listStreams({ page = 1, limit = 24 } = {}) {
    const where = { status: { not: 'ENDED' }, video: { status: 'READY' } };
    const [streams, total] = await prisma.$transaction([
        prisma.stream.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                title: true,
                status: true,
                requireAuth: true,
                coverImageUrl: true,
                owner: { select: { name: true } },
                video: { select: { thumbnailUrl: true } },
            },
        }),
        prisma.stream.count({ where }),
    ]);
    return { streams, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getStream(id, user) {
    const stream = await prisma.stream.findUnique({
        where: { id },
        select: {
            id: true,
            title: true,
            status: true,
            requireAuth: true,
            coverImageUrl: true,
            positionMs: true,
            donationOverlay: true,
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
    if (user && await isPermanentlyBanned(stream.owner.id, user.id)) {
        throw new HttpError(403, 'STREAM_ACCESS_BANNED', 'Access to this streamer is blocked');
    }
    if (stream.requireAuth && !user) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    const state = await getStreamState(id);
    const likes = await getStreamLikes(id, user?.id);
    return { stream, state, likes };
}

export async function isPermanentlyBanned(ownerId, userId) {
    if (!userId) return false;
    const ban = await prisma.streamChatBan.findFirst({
        where: { userId, expiresAt: null, stream: { ownerId } }, select: { id: true },
    });
    return Boolean(ban);
}

export async function getStreamLikes(id, userId) {
    const stream = await prisma.stream.findUnique({ where: { id }, select: { ownerId: true, status: true } });
    if (!stream) throw new HttpError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    const [count, liked] = await Promise.all([
        prisma.streamLike.count({ where: { streamId: id } }),
        userId ? prisma.streamLike.findUnique({ where: { streamId_userId: { streamId: id, userId } }, select: { id: true } }) : Promise.resolve(null),
    ]);
    return { count, liked: Boolean(liked) };
}

export async function setStreamLike(id, user, liked) {
    const stream = await prisma.stream.findUnique({ where: { id }, select: { status: true, ownerId: true } });
    if (!stream) throw new HttpError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    if (stream.status === 'ENDED') throw new HttpError(409, 'STREAM_ENDED', 'Stream has ended');
    if (await isPermanentlyBanned(stream.ownerId, user.id)) {
        throw new HttpError(403, 'STREAM_ACCESS_BANNED', 'Access to this streamer is blocked');
    }
    if (liked) {
        await prisma.streamLike.upsert({
            where: { streamId_userId: { streamId: id, userId: user.id } },
            create: { streamId: id, userId: user.id }, update: {},
        });
    } else {
        await prisma.streamLike.deleteMany({ where: { streamId: id, userId: user.id } });
    }
    return getStreamLikes(id, user.id);
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

export async function updateStreamOverlay(id, user, donationOverlay) {
    const stream = await prisma.stream.findUnique({ where: { id }, select: { ownerId: true } });
    if (!stream) throw new HttpError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    if (stream.ownerId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can change the overlay');
    const updated = await prisma.stream.update({ where: { id }, data: { donationOverlay }, select: { donationOverlay: true } });
    return updated.donationOverlay;
}
