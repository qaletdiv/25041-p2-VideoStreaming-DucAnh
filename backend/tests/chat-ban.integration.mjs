// Chạy: node --env-file=.env --test tests/chat-ban.integration.mjs
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

test('Ban chat: phân quyền, thời hạn, nhiều tab, kết nối lại, khác phòng và gỡ cấm', async () => {
    const ownerId = randomUUID();
    const viewerId = randomUUID();
    const adminId = randomUUID();
    const streamIds = [randomUUID(), randomUUID()];
    const server = createServer(app);
    const io = new Server(server);
    app.set('io', io);
    registerStreamSockets(io);
    const sockets = [];
    try {
        await prisma.user.createMany({ data: [ownerId, viewerId, adminId].map((id) => ({ id, email: `${id}@test.invalid`, name: 'Chat ban test', passwordHash: 'unused', role: id === adminId ? 'ADMIN' : 'USER' })) });
        const video = await prisma.video.create({ data: { title: 'Chat ban test', videoUrl: 'https://example.invalid/test.mp4', uploaderId: ownerId, duration: 60, status: 'READY' } });
        for (const id of streamIds) {
            await prisma.stream.create({ data: { id, title: 'Chat ban test', ownerId, videoId: video.id } });
            await initializeStreamState(id);
        }
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}`;
        const cookie = {};
        for (const id of [ownerId, viewerId, adminId]) cookie[id] = `session=${await signToken({ userId: id, role: id === adminId ? 'ADMIN' : 'USER' })}`;
        async function request(actorId, method = 'GET', body, suffix = '') {
            const response = await fetch(`${base}/api/streams/${streamIds[0]}/bans${suffix}`, {
                method, headers: { 'Content-Type': 'application/json', ...(actorId ? { cookie: cookie[actorId] } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            return { status: response.status, data: response.status === 204 ? null : await response.json() };
        }
        async function join(streamId) {
            const socket = connect(base, { transports: ['websocket'], extraHeaders: { cookie: cookie[viewerId] }, forceNew: true });
            sockets.push(socket);
            await once(socket, 'connect', { signal: AbortSignal.timeout(5000) });
            const reply = await socket.timeout(5000).emitWithAck('stream:join', { streamId });
            assert.equal(reply.ok, true);
            return { socket, reply };
        }
        const { socket } = await join(streamIds[0]);
        const { socket: secondTab } = await join(streamIds[0]);
        const { socket: otherRoom } = await join(streamIds[1]);
        const payload = { userId: viewerId, durationMinutes: 5, reason: 'Test moderation' };
        assert.equal((await request(null, 'POST', payload)).status, 401);
        assert.equal((await request(viewerId, 'POST', payload)).status, 403);
        assert.equal((await request(viewerId)).status, 403);
        assert.equal((await request(ownerId, 'POST', { ...payload, durationMinutes: 1 })).status, 400);
        for (const userId of [ownerId, adminId]) {
            assert.equal((await request(ownerId, 'POST', { ...payload, userId })).data.error.code, 'BAN_TARGET_PROTECTED');
        }
        const notifications = [socket, secondTab].map((client) => once(client, 'stream:chat-ban', { signal: AbortSignal.timeout(5000) }));
        const created = await request(ownerId, 'POST', payload);
        assert.equal(created.status, 201);
        assert.ok(Date.parse(created.data.ban.expiresAt) > Date.now() + 290000);
        for (const notification of notifications) assert.equal((await notification)[0].ban.userId, viewerId);
        assert.equal((await socket.timeout(5000).emitWithAck('stream:chat:send', { text: 'blocked' })).code, 'CHAT_BANNED');
        assert.equal((await otherRoom.timeout(5000).emitWithAck('stream:chat:send', { text: 'allowed in other room' })).ok, true);
        assert.equal((await request(ownerId)).data.bans.length, 1);
        assert.equal((await request(viewerId, 'DELETE', undefined, `/${viewerId}`)).status, 403);
        for (const durationMinutes of [15, 30, null]) {
            const result = await request(adminId, 'POST', { ...payload, durationMinutes });
            assert.equal(result.status, 201);
            if (durationMinutes === null) assert.equal(result.data.ban.expiresAt, null);
            else assert.ok(Date.parse(result.data.ban.expiresAt) > Date.now() + (durationMinutes * 60 - 10) * 1000);
        }
        const reconnect = await join(streamIds[0]);
        assert.equal(reconnect.reply.ban.userId, viewerId);
        assert.equal(reconnect.reply.ban.expiresAt, null);
        const unbanEvent = once(socket, 'stream:chat-ban', { signal: AbortSignal.timeout(5000) });
        assert.equal((await request(adminId, 'DELETE', undefined, `/${viewerId}`)).status, 204);
        assert.equal((await unbanEvent)[0].ban, null);
        assert.equal((await socket.timeout(5000).emitWithAck('stream:chat:send', { text: 'allowed after unban' })).ok, true);
        await request(ownerId, 'POST', payload);
        await prisma.streamChatBan.update({ where: { streamId_userId: { streamId: streamIds[0], userId: viewerId } }, data: { expiresAt: new Date(Date.now() - 1000) } });
        assert.equal((await request(ownerId)).data.bans.length, 0);
        const heartbeat = await socket.timeout(5000).emitWithAck('stream:heartbeat');
        assert.equal(heartbeat.ban, null);
        await redis.del(`stream:${streamIds[0]}:chat-rate:${viewerId}`);
        assert.equal((await socket.timeout(5000).emitWithAck('stream:chat:send', { text: 'allowed after expiry' })).ok, true);
    } finally {
        for (const socket of sockets) socket.disconnect();
        await new Promise((resolve) => io.close(resolve));
        await prisma.user.deleteMany({ where: { id: { in: [ownerId, viewerId, adminId] } } });
        for (const id of streamIds) await redis.del(...['state', 'viewers', 'chat', 'control-lock', `chat-rate:${viewerId}`].map((suffix) => `stream:${id}:${suffix}`));
        await prisma.$disconnect();
        redis.disconnect();
    }
});
