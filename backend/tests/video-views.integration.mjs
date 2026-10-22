// Chạy trong backend: node --env-file=.env --test tests/video-views.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { Server } from 'socket.io';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { signToken } from '../src/lib/jwt.js';
import { initializeStreamState } from '../src/services/streamState.service.js';
import { registerStreamSockets } from '../src/socket/streams.js';

const { io: connect } = createRequire(new URL('../../frontend/package.json', import.meta.url))('socket.io-client');

test('Video views: sessions, concurrent retries, permissions and scoped realtime', { timeout: 60000 }, async () => {
    const ids = Array.from({ length: 3 }, () => randomUUID());
    const [owner, viewer, admin] = ids;
    const streamIds = [randomUUID(), randomUUID()];
    const server = createServer(app);
    const io = new Server(server);
    app.set('io', io);
    const stop = registerStreamSockets(io);
    const sockets = [];
    try {
        await prisma.user.createMany({ data: ids.map((id) => ({ id, name: 'Views test', email: `${id}@test.invalid`, passwordHash: 'unused', role: id === admin ? 'ADMIN' : 'USER' })) });
        const video = await prisma.video.create({ data: { title: 'Views test', videoUrl: 'https://example.invalid/video.mp4', uploaderId: owner, viewCount: 50 } });
        const other = await prisma.video.create({ data: { title: 'Other video', videoUrl: 'https://example.invalid/other.mp4', uploaderId: owner } });
        const pending = await prisma.video.create({ data: { title: 'Pending video', videoUrl: 'https://example.invalid/pending.mp4', uploaderId: owner, status: 'PROCESSING' } });
        await prisma.stream.createMany({ data: streamIds.map((id, index) => ({ id, ownerId: owner, videoId: video.id, title: 'Views room', requireAuth: index === 0, status: 'PLAYING' })) });
        for (const id of streamIds) await initializeStreamState(id);
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}`;
        const cookies = {};
        for (const id of ids) cookies[id] = `session=${await signToken({ userId: id, role: id === admin ? 'ADMIN' : 'USER' })}`;
        const events = new Map();
        for (const id of [...ids, 'guest']) {
            const socket = connect(base, { transports: ['websocket'], reconnection: false, ...(cookies[id] ? { extraHeaders: { cookie: cookies[id] } } : {}) });
            sockets.push(socket);
            events.set(id, []);
            socket.on('statistics:videos-changed', (...args) => events.get(id).push(args));
            await once(socket, 'connect', { signal: AbortSignal.timeout(5000) });
        }
        async function request(body, actor = null, videoId = video.id) {
            const response = await fetch(`${base}/api/videos/${videoId}/views`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...(actor ? { cookie: cookies[actor] } : {}) },
                body: JSON.stringify(body),
            });
            return { status: response.status, data: await response.json() };
        }
        assert.equal((await request({})).status, 400);
        assert.equal((await request({ sessionId: 'bad' })).status, 400);
        assert.equal((await request({ sessionId: randomUUID(), ownerId: owner })).status, 400);
        assert.equal((await request({ sessionId: randomUUID() }, null, pending.id)).status, 404);
        const sessionId = randomUUID();
        const first = await request({ sessionId });
        assert.deepEqual(first.data, { counted: true, viewCount: 51 });
        assert.deepEqual((await request({ sessionId })).data, { counted: false, viewCount: 51 });
        assert.equal((await request({ sessionId }, null, other.id)).status, 409);
        assert.equal((await request({ sessionId, streamId: streamIds[1] })).status, 409);
        const concurrent = { sessionId: randomUUID() };
        const responses = await Promise.all(Array.from({ length: 6 }, () => request(concurrent)));
        assert.ok(responses.every((r) => r.status === 200));
        assert.equal(responses.filter((r) => r.data.counted).length, 1);
        assert.equal(await prisma.videoView.count({ where: { videoId: video.id } }), 2);
        assert.equal((await request({ sessionId: randomUUID(), streamId: streamIds[0] })).status, 401);
        const ownerView = await request({ sessionId: randomUUID(), streamId: streamIds[0] }, owner);
        assert.equal(ownerView.data.counted, false);
        assert.equal((await request({ sessionId: randomUUID(), streamId: streamIds[0] }, viewer, other.id)).status, 404);
        const roomSession = { sessionId: randomUUID(), streamId: streamIds[0] };
        assert.equal((await request(roomSession, viewer)).data.counted, true);
        assert.equal((await request(roomSession, viewer)).data.counted, false);

        // Socket đổi ID sau reconnect nhưng mã phiên xem vẫn giữ nguyên.
        const viewerSocket = sockets[1];
        viewerSocket.disconnect();
        viewerSocket.connect();
        await once(viewerSocket, 'connect', { signal: AbortSignal.timeout(5000) });
        const joined = await viewerSocket.timeout(5000).emitWithAck('stream:join', { streamId: streamIds[0] });
        assert.equal(joined.ok, true);
        assert.equal((await request(roomSession, viewer)).data.counted, false);
        assert.equal((await request({ sessionId: randomUUID(), streamId: streamIds[1] })).data.counted, true);
        assert.equal((await request({ sessionId: randomUUID(), streamId: streamIds[0] }, admin)).data.counted, true);
        await prisma.stream.update({ where: { id: streamIds[0] }, data: { status: 'ENDED' } });
        assert.equal((await request({ sessionId: randomUUID(), streamId: streamIds[0] }, viewer)).status, 409);
        assert.equal(await prisma.videoView.count({ where: { videoId: video.id } }), 5);
        assert.equal((await prisma.video.findUnique({ where: { id: video.id } })).viewCount, 55);
        // ACK đi sau các thông báo đã xếp hàng để kiểm tra không phát trùng/rò sang khách.
        for (const socket of sockets) await socket.timeout(5000).emitWithAck('stream:heartbeat');
        assert.equal(events.get(owner).length, 5);
        assert.equal(events.get(admin).length, 5);
        assert.equal(events.get(viewer).length, 0);
        assert.equal(events.get('guest').length, 0);
    } finally {
        for (const socket of sockets) socket.disconnect();
        await new Promise((resolve) => io.close(resolve));
        stop();
        for (const id of streamIds) await redis.del(`stream:${id}:state`, `stream:${id}:viewers`, `stream:${id}:control-lock`);
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        await prisma.$disconnect();
        redis.disconnect();
    }
});
