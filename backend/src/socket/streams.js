import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { verifyToken } from '../lib/jwt.js';
import { SESSION_COOKIE } from '../lib/sessionCookie.js';
import { findActiveUserById } from '../services/auth.service.js';
import { getStreamState, heartbeatViewer } from '../services/streamState.service.js';

const joinSchema = z.object({
    streamId: z.string().min(1).max(100),
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
        socket.on('stream:join', async (input, ack) => {
            if (typeof ack !== 'function') return;

            try {
                const parsed = joinSchema.safeParse(input);
                if (!parsed.success) return ack({ ok: false, code: 'VALIDATION_ERROR' });

                const { streamId } = parsed.data;
                const stream = await prisma.stream.findUnique({
                    where: { id: streamId },
                    select: { status: true, requireAuth: true, video: { select: { status: true } } },
                });
                if (!stream || stream.status === 'ENDED' || stream.video.status !== 'READY') {
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
                ack({ ok: true, state, ...audience });
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
                ack({ ok: true, ...await heartbeatViewer(streamId, socket.id) });
            } catch (error) {
                console.error('[socket] stream:heartbeat:', error);
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
