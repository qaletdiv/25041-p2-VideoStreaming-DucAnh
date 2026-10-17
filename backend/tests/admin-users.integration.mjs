// Chạy: node --env-file=.env --test tests/admin-users.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import bcrypt from 'bcryptjs';
import { Server } from 'socket.io';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { signToken } from '../src/lib/jwt.js';
import { initializeStreamState, getStreamState } from '../src/services/streamState.service.js';
import { controlStream } from '../src/services/stream.service.js';
import { registerStreamSockets } from '../src/socket/streams.js';

const { io: connect } = createRequire(new URL('../../frontend/package.json', import.meta.url))('socket.io-client');

test('Admin users: permissions, search, lock/unlock, sockets and ending all rooms', { timeout: 30000 }, async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const [adminId, ownerId, viewerId] = ids;
    const streamIds = [randomUUID(), randomUUID()];
    const prefix = randomUUID();
    const server = createServer(app);
    const io = new Server(server);
    app.set('io', io);
    registerStreamSockets(io);
    const sockets = [];
    try {
        const passwordHash = await bcrypt.hash('test-password', 4);
        await prisma.user.createMany({ data: ids.map((id) => ({ id, name: `${prefix} ${id}`, email: `${id}@test.invalid`, passwordHash, role: id === adminId ? 'ADMIN' : 'USER' })) });
        const video = await prisma.video.create({ data: { title: 'Admin test', videoUrl: 'https://example.invalid/test.mp4', uploaderId: ownerId, duration: 60 } });
        for (const id of streamIds) {
            await prisma.stream.create({ data: { id, title: 'Admin test', ownerId, videoId: video.id, requireAuth: true } });
            await initializeStreamState(id);
        }
        await controlStream(streamIds[0], { id: ownerId, role: 'USER' }, { action: 'PLAY' });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}`;
        const cookies = {};
        for (const id of ids) cookies[id] = `session=${await signToken({ userId: id, role: id === adminId ? 'ADMIN' : 'USER' })}`;
        async function request(path, actor = adminId, method = 'GET', body) {
            const response = await fetch(`${base}/api${path}`, {
                method, headers: { 'Content-Type': 'application/json', ...(actor ? { cookie: cookies[actor] } : {}) },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            return { status: response.status, data: await response.json() };
        }
        const statusPath = `/admin/users/${ownerId}/status`;
        const change = (isActive) => request(statusPath, adminId, 'PATCH', { isActive });
        assert.equal((await request('/admin/users', null)).status, 401);
        assert.equal((await request('/admin/users', ownerId)).status, 403);
        assert.equal((await request(statusPath, ownerId, 'PATCH', { isActive: false })).status, 403);
        assert.equal((await request(statusPath, adminId, 'PATCH', { isActive: 'false' })).status, 400);
        assert.equal((await request(statusPath, adminId, 'PATCH', { isActive: false, role: 'ADMIN' })).status, 400);
        assert.equal((await request(`/admin/users/${adminId}/status`, adminId, 'PATCH', { isActive: false })).status, 403);
        assert.equal((await request(`/admin/users/${randomUUID()}/status`, adminId, 'PATCH', { isActive: false })).status, 404);
        const list = await request(`/admin/users?search=${prefix}&limit=2`);
        assert.equal(list.data.total, 3);
        assert.equal(list.data.users.length, 2);
        assert.equal(list.data.totalPages, 2);
        assert.ok(list.data.users.every((user) => !('passwordHash' in user)));
        assert.equal((await request(`/admin/users?search=${ownerId}@test.invalid`)).data.total, 1);

        async function openSocket(id) {
            const socket = connect(base, { transports: ['websocket'], extraHeaders: { cookie: cookies[id] }, forceNew: true, reconnection: false });
            sockets.push(socket);
            await once(socket, 'connect', { signal: AbortSignal.timeout(5000) });
            return socket;
        }
        const ownerSocket = await openSocket(ownerId);
        const ownerTab = await openSocket(ownerId);
        const viewerSocket = await openSocket(viewerId);
        for (const socket of [ownerSocket, ownerTab, viewerSocket]) {
            assert.equal((await socket.timeout(5000).emitWithAck('stream:join', { streamId: streamIds[0] })).ok, true);
        }
        const lockedEvents = [ownerSocket, ownerTab].map((socket) => once(socket, 'account:locked', { signal: AbortSignal.timeout(5000) }));
        const disconnected = [ownerSocket, ownerTab].map((socket) => once(socket, 'disconnect', { signal: AbortSignal.timeout(5000) }));
        const ended = [];
        viewerSocket.on('stream:ended', ({ streamId }) => ended.push(streamId));
        assert.equal((await change(false)).status, 200);
        await Promise.all([...lockedEvents, ...disconnected]);
        assert.deepEqual(new Set(ended), new Set(streamIds));
        for (const id of streamIds) {
            assert.equal((await prisma.stream.findUnique({ where: { id } })).status, 'ENDED');
            assert.equal((await getStreamState(id)).status, 'ENDED');
        }
        assert.equal((await request(`/admin/users?search=${prefix}&status=locked`)).data.total, 1);
        assert.equal((await request('/auth/me', ownerId)).status, 401);
        assert.equal((await request('/auth/login', null, 'POST', { email: `${ownerId}@test.invalid`, password: 'test-password' })).data.error.code, 'ACCOUNT_LOCKED');
        const rejected = connect(base, { transports: ['websocket'], extraHeaders: { cookie: cookies[ownerId] }, forceNew: true, reconnection: false });
        sockets.push(rejected);
        assert.equal((await once(rejected, 'connect_error', { signal: AbortSignal.timeout(5000) }))[0].message, 'UNAUTHENTICATED');
        assert.equal((await change(false)).status, 200);
        assert.equal((await change(true)).status, 200);
        assert.equal((await request('/auth/login', null, 'POST', { email: `${ownerId}@test.invalid`, password: 'test-password' })).status, 200);
        assert.equal((await prisma.stream.findUnique({ where: { id: streamIds[0] } })).status, 'ENDED');

        // Khóa phòng đang bận: tài khoản vẫn bị khóa, yêu cầu lặp lại kết thúc nốt phòng.
        await prisma.stream.update({ where: { id: streamIds[1] }, data: { status: 'CREATED', endedAt: null } });
        await redis.del(`stream:${streamIds[1]}:state`);
        await initializeStreamState(streamIds[1]);
        await redis.set(`stream:${streamIds[1]}:control-lock`, 'test', 'PX', 5000);
        const pending = await change(false);
        assert.equal(pending.status, 503);
        assert.equal(pending.data.error.code, 'LOCK_STREAMS_PENDING');
        assert.equal((await prisma.user.findUnique({ where: { id: ownerId } })).isActive, false);
        await redis.del(`stream:${streamIds[1]}:control-lock`);
        assert.equal((await change(false)).status, 200);
        assert.equal((await getStreamState(streamIds[1])).status, 'ENDED');
    } finally {
        for (const socket of sockets) socket.disconnect();
        await new Promise((resolve) => io.close(resolve));
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        for (const id of streamIds) await redis.del(...['state', 'viewers', 'chat', 'control-lock'].map((suffix) => `stream:${id}:${suffix}`));
        await prisma.$disconnect();
        redis.disconnect();
    }
});
