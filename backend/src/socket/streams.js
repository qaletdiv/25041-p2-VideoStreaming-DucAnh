import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { verifyToken } from '../lib/jwt.js';
import { SESSION_COOKIE } from '../lib/sessionCookie.js';
import { findActiveUserById } from '../services/auth.service.js';
import { getStreamState, heartbeatViewer } from '../services/streamState.service.js';
import { listRecentMessages, publishMessage } from '../services/chat.service.js';
import { getActiveChatBan } from '../services/chatBan.service.js';

const joinSchema = z.object({
    streamId: z.string().min(1).max(100),
});
const chatSchema = z.object({
    text: z.string().trim().min(1).max(500),
});

const roomName = (streamId) => `stream:${streamId}`;
const viewersKey = (streamId) => `stream:${streamId}:viewers`;

function readSessionCookie(header) {
    const pair = header?.split(';').map((part) => part.trim())
        .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
    if (!pair) return null;

    try {
        return decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1));
    } catch {
        return null;
    }
}

export function registerStreamSockets(io) {
    io.use(async (socket, next) => {
        try {
            const token = readSessionCookie(socket.handshake.headers.cookie);
            const payload = token ? await verifyToken(token) : null;
            socket.data.user = payload?.sub ? await findActiveUserById(payload.sub) : null;
            next();
        } catch (error) {
            next(error);
        }
    });

    io.on('connection', (socket) => {
        if (socket.data.user) socket.join(`user:${socket.data.user.id}`);
        socket.on('stream:join', async (input, ack) => {
            if (typeof ack !== 'function') return;

            try {
                const parsed = joinSchema.safeParse(input);
                if (!parsed.success) return ack({ ok: false, code: 'VALIDATION_ERROR' });

                const { streamId } = parsed.data;
                const stream = await prisma.stream.findUnique({
                    where: { id: streamId },
                    select: { status: true, requireAuth: true, donationOverlay: true, video: { select: { status: true } } },
                });
                if (stream?.status === 'ENDED') {
                    return ack({ ok: false, code: 'STREAM_ENDED' });
                }
                if (!stream || stream.video.status !== 'READY') {
                    return ack({ ok: false, code: 'STREAM_NOT_FOUND' });
                }
                if (stream.requireAuth && !socket.data.user) {
                    return ack({ ok: false, code: 'UNAUTHENTICATED' });
                }

                const state = await getStreamState(streamId);
                if (!state) return ack({ ok: false, code: 'STATE_UNAVAILABLE' });

                const previousId = socket.data.streamId;
                if (previousId && previousId !== streamId) {
                    socket.leave(roomName(previousId));
                    await redis.zrem(viewersKey(previousId), socket.id);
                }

                socket.join(roomName(streamId));
                socket.data.streamId = streamId;
                const audience = await heartbeatViewer(streamId, socket.id);
                const messages = await listRecentMessages(streamId);
                const ban = await getActiveChatBan(streamId, socket.data.user?.id);
                ack({ ok: true, state, messages, ban, serverNow: Date.now(), overlay: stream.donationOverlay, ...audience });
            } catch (error) {
                console.error('[socket] stream:join:', error);
                ack({ ok: false, code: 'INTERNAL_ERROR' });
            }
        });

        socket.on('stream:heartbeat', async (ack) => {
            if (typeof ack !== 'function') return;
            const streamId = socket.data.streamId;
            if (!streamId) return ack({ ok: false, code: 'NOT_IN_STREAM' });

            try {
                const ban = await getActiveChatBan(streamId, socket.data.user?.id);
                ack({ ok: true, ...await heartbeatViewer(streamId, socket.id), ban, serverNow: Date.now() });
            } catch (error) {
                console.error('[socket] stream:heartbeat:', error);
                ack({ ok: false, code: 'INTERNAL_ERROR' });
            }
        });

        socket.on('stream:chat:send', async (input, ack) => {
            if (typeof ack !== 'function') return;
            const streamId = socket.data.streamId;
            if (!streamId) return ack({ ok: false, code: 'NOT_IN_STREAM' });

            try {
                const parsed = chatSchema.safeParse(input);
                if (!parsed.success) return ack({ ok: false, code: 'VALIDATION_ERROR' });

                const user = socket.data.user
                    ? await findActiveUserById(socket.data.user.id)
                    : null;
                if (!user) return ack({ ok: false, code: 'UNAUTHENTICATED' });

                const stream = await prisma.stream.findUnique({
                    where: { id: streamId },
                    select: { status: true },
                });
                if (!stream || stream.status === 'ENDED') {
                    return ack({ ok: false, code: 'STREAM_NOT_FOUND' });
                }

                const ban = await getActiveChatBan(streamId, user.id);
                if (ban) return ack({ ok: false, code: 'CHAT_BANNED', ban, serverNow: Date.now() });
                const message = await publishMessage(streamId, user, parsed.data.text);
                io.to(roomName(streamId)).emit('stream:chat', message);
                ack({ ok: true, message });
            } catch (error) {
                if (error.code === 'CHAT_RATE_LIMIT') {
                    return ack({ ok: false, code: error.code });
                }
                console.error('[socket] stream:chat:send:', error);
                ack({ ok: false, code: 'INTERNAL_ERROR' });
            }
        });

        socket.on('disconnect', () => {
            const streamId = socket.data.streamId;
            if (streamId) {
                redis.zrem(viewersKey(streamId), socket.id)
                    .catch((error) => console.error('[socket] disconnect:', error));
            }
        });
    });
}
