// Chạy: node --env-file=.env --test tests/admin-rbac.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { signToken } from '../src/lib/jwt.js';
import { registerStreamSockets } from '../src/socket/streams.js';

const { io: connect } = createRequire(new URL('../../frontend/package.json', import.meta.url))('socket.io-client');

test('Admin RBAC: CRUD, role changes, session revocation and concurrent admins', { timeout: 60000 }, async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const [admin, user, firstAdmin, secondAdmin] = ids;
    const suffix = randomUUID();
    const server = createServer(app);
    const io = new Server(server);
    app.set('io', io);
    const stop = registerStreamSockets(io);
    const sockets = [];
    try {
        const passwordHash = await bcrypt.hash('original-password', 4);
        await prisma.user.createMany({ data: ids.map((id) => ({ id, name: 'RBAC test', email: `${id}@test.invalid`, passwordHash, role: id === user ? 'USER' : 'ADMIN' })) });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}`;
        const cookies = {};
        for (const id of ids) cookies[id] = `session=${await signToken({ userId: id, role: id === user ? 'USER' : 'ADMIN' })}`;
        async function request(path, method = 'GET', body, actor = admin) {
            const response = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(actor ? { cookie: cookies[actor] ?? actor } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
            return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
        }
        const payload = { name: 'New User', email: `new-${suffix}@test.invalid`, password: 'new-password', role: 'USER' };
        assert.equal((await request('/admin/users', 'POST', payload, null)).status, 401);
        assert.equal((await request('/admin/users', 'POST', payload, user)).status, 403);
        for (const invalid of [{ ...payload, role: 'STREAMER' }, { ...payload, password: 'short' }, { ...payload, password: 'ệ'.repeat(25) }, { ...payload, isActive: true }]) {
            assert.equal((await request('/admin/users', 'POST', invalid)).status, 400);
        }
        const created = await request('/admin/users', 'POST', { ...payload, email: `  ${payload.email.toUpperCase()}  ` });
        assert.equal(created.status, 201, JSON.stringify(created.body));
        const newId = created.body.user.id;
        ids.push(newId);
        assert.equal(created.body.user.email, payload.email);
        assert.equal(created.body.user.role, 'USER');
        assert.ok(!('passwordHash' in created.body.user));
        assert.ok(await bcrypt.compare(payload.password, (await prisma.user.findUnique({ where: { id: newId } })).passwordHash));
        assert.equal((await request('/admin/users', 'POST', payload)).status, 409);
        const createdAdmin = await request('/admin/users', 'POST', { ...payload, email: `admin-${suffix}@test.invalid`, role: 'ADMIN' });
        assert.equal(createdAdmin.status, 201);
        ids.push(createdAdmin.body.user.id);
        const profile = { name: 'Updated User', email: `${user}@test.invalid` };
        assert.equal((await request(`/admin/users/${user}`, 'PATCH', profile, user)).status, 403);
        assert.equal((await request(`/admin/users/${user}`, 'PATCH', { ...profile, role: 'ADMIN' })).status, 400);
        assert.equal((await request(`/admin/users/${user}`, 'PATCH', { ...profile, email: payload.email })).status, 409);
        assert.equal((await request(`/admin/users/${user}`, 'PATCH', profile)).status, 200);
        assert.equal((await prisma.user.findUnique({ where: { id: user } })).sessionVersion, 0);
        assert.equal((await request(`/admin/users/${randomUUID()}`, 'PATCH', profile)).status, 404);
        assert.equal((await request(`/admin/users/${admin}/role`, 'PATCH', { role: 'USER' })).status, 403);
        assert.equal((await request(`/admin/users/${admin}/status`, 'PATCH', { isActive: false })).status, 403);
        const socket = connect(base, { transports: ['websocket'], extraHeaders: { cookie: cookies[user] }, reconnection: false });
        sockets.push(socket);
        await once(socket, 'connect', { signal: AbortSignal.timeout(5000) });
        const socketId = socket.id;
        assert.equal((await request(`/admin/users/${user}/role`, 'PATCH', { role: 'ADMIN' })).status, 200);
        assert.equal((await request('/admin/users', 'GET', null, user)).status, 200);
        assert.ok(io.sockets.sockets.get(socketId).rooms.has('statistics:admins'));
        assert.equal(io.sockets.sockets.get(socketId).data.user.role, 'ADMIN');
        assert.equal((await request(`/admin/users/${user}/role`, 'PATCH', { role: 'USER' })).status, 200);
        assert.equal((await request('/admin/users', 'GET', null, user)).status, 403);
        assert.ok(!io.sockets.sockets.get(socketId).rooms.has('statistics:admins'));
        assert.equal(socket.connected, true);

        const expired = once(socket, 'account:session-expired', { signal: AbortSignal.timeout(5000) });
        const disconnected = once(socket, 'disconnect', { signal: AbortSignal.timeout(5000) });
        assert.equal((await request(`/admin/users/${user}`, 'PATCH', { ...profile, password: 'replacement-password' })).status, 200);
        await Promise.all([expired, disconnected]);
        assert.equal((await request('/auth/me', 'GET', null, user)).status, 401);
        const loginBody = { email: profile.email, password: 'original-password' };
        assert.equal((await request('/auth/login', 'POST', loginBody, null)).status, 401);
        const login = await request('/auth/login', 'POST', { ...loginBody, password: 'replacement-password' }, null);
        assert.equal(login.status, 200);
        assert.ok(!('sessionVersion' in login.body.user));
        assert.equal((await request('/auth/me', 'GET', null, login.cookie)).status, 200);
        const rejected = connect(base, { transports: ['websocket'], extraHeaders: { cookie: cookies[user] }, reconnection: false });
        sockets.push(rejected);
        assert.equal((await once(rejected, 'connect_error', { signal: AbortSignal.timeout(5000) }))[0].message, 'UNAUTHENTICATED');
        assert.equal((await request(`/admin/users/${firstAdmin}/status`, 'PATCH', { isActive: false })).status, 200);
        assert.equal((await request('/admin/users', 'GET', null, firstAdmin)).status, 401);
        assert.equal((await request(`/admin/users/${firstAdmin}/status`, 'PATCH', { isActive: true })).status, 200);

        // Hai Admin cùng hạ quyền nhau: actor phải được kiểm tra lại sau khóa.
        const race = await Promise.all([
            request(`/admin/users/${secondAdmin}/role`, 'PATCH', { role: 'USER' }, firstAdmin),
            request(`/admin/users/${firstAdmin}/role`, 'PATCH', { role: 'USER' }, secondAdmin),
        ]);
        assert.deepEqual(race.map((r) => r.status).sort(), [200, 403]);
        assert.equal(await prisma.user.count({ where: { id: { in: [firstAdmin, secondAdmin] }, role: 'ADMIN', isActive: true } }), 1);
    } finally {
        for (const socket of sockets) socket.disconnect();
        await new Promise((resolve) => io.close(resolve));
        stop();
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        await prisma.$disconnect();
        redis.disconnect();
    }
});
