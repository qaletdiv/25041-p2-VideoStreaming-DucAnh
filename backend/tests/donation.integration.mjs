// Chạy: node --env-file=.env --test tests/donation.integration.mjs (cần PostgreSQL và Redis).
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

test('Donate: quyền truy cập, validation, realtime, gửi lại và phòng đã kết thúc', async () => {
    const ownerId = randomUUID();
    const viewerId = randomUUID();
    const streamId = randomUUID();
    const server = createServer(app);
    const io = new Server(server);
    app.set('io', io);
    registerStreamSockets(io);
    let socket;
    try {
        await prisma.user.createMany({ data: [ownerId, viewerId].map((id) => ({ id, name: 'Donate test', email: `${id}@test.invalid`, passwordHash: 'unused' })) });
        const video = await prisma.video.create({ data: { title: 'Donate test', videoUrl: 'https://example.invalid/test.mp4', uploaderId: ownerId, status: 'READY', duration: 60 } });
        await prisma.stream.create({ data: { id: streamId, title: 'Donate test', ownerId, videoId: video.id, requireAuth: true } });
        await initializeStreamState(streamId);
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}`;
        const ownerCookie = `session=${await signToken({ userId: ownerId, role: 'USER' })}`;
        const viewerCookie = `session=${await signToken({ userId: viewerId, role: 'USER' })}`;
        async function request(path, cookie, body) {
            const response = await fetch(`${base}/api/streams/${streamId}${path}`, {
                method: body ? 'POST' : 'GET',
                headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            return { status: response.status, data: await response.json() };
        }
        const payload = { amount: 10000, message: 'Xin chào', requestId: randomUUID(), userId: ownerId };
        assert.equal((await request('/donations', null, payload)).status, 401);
        assert.equal((await request('/donations', null)).status, 401);
        assert.equal((await request('/donations', viewerCookie)).status, 403);
        assert.equal((await request('/donations', ownerCookie, payload)).status, 403);
        for (const amount of [-1, 0, 999, 1000.5, 1000001, '10000']) {
            assert.equal((await request('/donations', viewerCookie, { ...payload, amount })).status, 400);
        }
        assert.equal((await request('/donations', viewerCookie, { ...payload, message: 'x'.repeat(301) })).status, 400);
        socket = connect(base, { transports: ['websocket'], extraHeaders: { cookie: viewerCookie } });
        await once(socket, 'connect', { signal: AbortSignal.timeout(5000) });
        const joined = await socket.timeout(5000).emitWithAck('stream:join', { streamId });
        assert.equal(joined.ok, true);
        const event = once(socket, 'stream:donation', { signal: AbortSignal.timeout(5000) });
        const created = await request('/donations', viewerCookie, payload);
        assert.equal(created.status, 201);
        assert.equal((await event)[0].id, created.data.donation.id);
        assert.equal((await prisma.donation.findUnique({ where: { id: created.data.donation.id } })).userId, viewerId);
        const retried = await request('/donations', viewerCookie, payload);
        assert.equal(retried.status, 200);
        assert.equal(retried.data.donation.id, created.data.donation.id);
        assert.equal((await request('/donations', viewerCookie, { ...payload, amount: 20000 })).status, 409);
        const history = await request('/donations?page=1&limit=1', ownerCookie);
        assert.equal(history.status, 200);
        assert.equal(history.data.total, 1);
        assert.equal(history.data.donations[0].message, 'Xin chào');
        assert.equal(history.data.donations[0].user.passwordHash, undefined);
        await prisma.stream.update({ where: { id: streamId }, data: { requireAuth: false } });
        assert.equal((await request('/donations', null)).status, 401);
        assert.equal((await request('/donations', viewerCookie)).status, 403);
        assert.equal((await request('/actions', ownerCookie, { action: 'END' })).status, 200);
        const ended = await request('/donations', viewerCookie, { ...payload, requestId: randomUUID() });
        assert.equal(ended.status, 409);
        assert.equal(ended.data.error.code, 'STREAM_ENDED');
        assert.equal(await prisma.donation.count({ where: { streamId } }), 1);
    } finally {
        socket?.disconnect();
        await new Promise((resolve) => io.close(resolve));
        await prisma.user.deleteMany({ where: { id: { in: [ownerId, viewerId] } } });
        await redis.del(...['state', 'viewers', 'chat', 'control-lock'].map((suffix) => `stream:${streamId}:${suffix}`));
        await prisma.$disconnect();
        redis.disconnect();
    }
});
