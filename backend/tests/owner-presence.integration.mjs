// Chạy: node --env-file=.env --test tests/owner-presence.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { Server } from 'socket.io';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { signToken } from '../src/lib/jwt.js';
import { initializeStreamState, getStreamState } from '../src/services/streamState.service.js';
import { registerStreamSockets } from '../src/socket/streams.js';
import { OWNER_RECONNECT_GRACE_MS } from '../src/socket/ownerPresence.js';

const { io: connect } = createRequire(new URL('../../frontend/package.json', import.meta.url))('socket.io-client');

test('Chủ phòng: nhiều tab, kết nối lại và tự kết thúc sau 15 giây mất kết nối', { timeout: 55000 }, async () => {
    const ownerId = randomUUID();
    const viewerId = randomUUID();
    const streamId = randomUUID();
    const server = createServer(app);
    const io = new Server(server);
    app.set('io', io);
    const stop = registerStreamSockets(io);
    const sockets = [];
    try {
        assert.equal(OWNER_RECONNECT_GRACE_MS, 15000);
        await prisma.user.createMany({ data: [ownerId, viewerId].map((id) => ({ id, email: `${id}@test.invalid`, name: 'Presence test', passwordHash: 'unused' })) });
        const video = await prisma.video.create({ data: { title: 'Presence test', videoUrl: 'https://example.invalid/video.mp4', uploaderId: ownerId, duration: 60 } });
        await prisma.stream.create({ data: { id: streamId, title: 'Presence test', ownerId, videoId: video.id } });
        await initializeStreamState(streamId);
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}`;
        async function join(id) {
            const cookie = `session=${await signToken({ userId: id, role: 'USER' })}`;
            const socket = connect(base, { transports: ['websocket'], extraHeaders: { cookie }, forceNew: true });
            sockets.push(socket);
            await once(socket, 'connect', { signal: AbortSignal.timeout(5000) });
            assert.equal((await socket.timeout(5000).emitWithAck('stream:join', { streamId })).ok, true);
            return socket;
        }
        const first = await join(ownerId);
        const second = await join(ownerId);
        const viewer = await join(viewerId);
        first.disconnect();
        await delay(16000);
        assert.equal((await getStreamState(streamId)).status, 'CREATED');
        second.disconnect();
        await delay(1000);
        const reconnected = await join(ownerId);
        await delay(15000);
        assert.equal((await getStreamState(streamId)).status, 'CREATED');
        const ended = once(viewer, 'stream:ended', { signal: AbortSignal.timeout(20000) });
        const start = Date.now();
        reconnected.disconnect();
        assert.equal((await ended)[0].streamId, streamId);
        assert.ok(Date.now() - start >= 14900);
        assert.equal((await getStreamState(streamId)).status, 'ENDED');
        assert.equal((await prisma.stream.findUnique({ where: { id: streamId } })).status, 'ENDED');
    } finally {
        stop();
        for (const socket of sockets) socket.disconnect();
        await new Promise((resolve) => io.close(resolve));
        await prisma.user.deleteMany({ where: { id: { in: [ownerId, viewerId] } } });
        await redis.del(...['state', 'viewers', 'chat', 'control-lock'].map((suffix) => `stream:${streamId}:${suffix}`));
        await prisma.$disconnect();
        redis.disconnect();
    }
});
