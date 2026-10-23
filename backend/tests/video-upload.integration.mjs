// Chạy với --env-file=.env; dùng PostgreSQL thật và giả lập phản hồi Cloudinary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { signToken } from '../src/lib/jwt.js';
import { finalizeProcessingVideos } from '../src/services/video.service.js';

test('Upload chỉ READY sau kiểm tra HLS, thử lại không trùng, status chỉ dành cho chủ video', async () => {
    const ownerId = randomUUID();
    const otherId = randomUUID();
    const server = createServer(app);
    const originalFetch = globalThis.fetch;
    let playable = false;
    const notifications = [];
    app.set('io', {
        to(room) {
            const rooms = [room];
            return { to(next) { rooms.push(next); return this; }, emit(event) { notifications.push({ rooms, event }); } };
        },
    });
    globalThis.fetch = async (url, options) => {
        const parsed = new URL(url);
        if (parsed.hostname === 'api.cloudinary.com') return Response.json({ resource_type: 'video', duration: 6 });
        if (parsed.hostname === 'res.cloudinary.com') {
            if (!playable) return new Response('', { status: 423 });
            return parsed.pathname.endsWith('.m3u8') ? new Response('#EXTM3U\n#EXTINF:6,\npart.ts') : new Response('a', { status: 206 });
        }
        return originalFetch(url, options);
    };
    try {
        await prisma.user.createMany({ data: [ownerId, otherId].map((id) => ({ id, email: `${id}@test.invalid`, name: 'Upload test', passwordHash: 'unused' })) });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const base = `http://127.0.0.1:${server.address().port}/api/videos`;
        const ownerCookie = `session=${await signToken({ userId: ownerId, role: 'USER' })}`;
        const otherCookie = `session=${await signToken({ userId: otherId, role: 'USER' })}`;
        const payload = { title: 'Upload test', publicId: `user_${ownerId}/test` };
        const create = async (body) => {
            const response = await originalFetch(base, { method: 'POST', headers: { cookie: ownerCookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            assert.equal(response.status, 201);
            return (await response.json()).video;
        };
        const waiting = await create(payload);
        assert.equal(waiting.status, 'PROCESSING');
        assert.deepEqual(notifications[0], { rooms: [`user:${ownerId}`, 'statistics:admins'], event: 'statistics:videos-changed' });
        assert.equal((await create(payload)).id, waiting.id);
        const statusUrl = `${base}/${waiting.id}/status`;
        assert.equal((await originalFetch(statusUrl)).status, 401);
        assert.equal((await originalFetch(statusUrl, { headers: { cookie: otherCookie } })).status, 403);
        assert.equal((await (await originalFetch(statusUrl, { headers: { cookie: ownerCookie } })).json()).video.status, 'PROCESSING');
        playable = true;
        await prisma.video.update({ where: { id: waiting.id }, data: { createdAt: new Date(Date.now() - 60000) } });
        // Chỉ chọn fixture của test, không chạy sweeper trên video thật của người dùng.
        const originalFindMany = prisma.video.findMany;
        const readyOwners = [];
        prisma.video.findMany = (args) => originalFindMany.call(prisma.video, { ...args, where: { ...args.where, id: waiting.id } });
        try {
            await finalizeProcessingVideos((id) => readyOwners.push(id));
            await finalizeProcessingVideos((id) => readyOwners.push(id));
        } finally {
            prisma.video.findMany = originalFindMany;
        }
        assert.deepEqual(readyOwners, [ownerId]);
        assert.equal((await prisma.video.findUnique({ where: { id: waiting.id } })).status, 'READY');
        const ready = await create({ ...payload, publicId: `user_${ownerId}/ready` });
        assert.equal(ready.status, 'READY');
        assert.equal(notifications.at(-1).event, 'statistics:videos-changed');
        assert.equal((await (await originalFetch(`${base}/${ready.id}/status`, { headers: { cookie: ownerCookie } })).json()).video.status, 'READY');
        const localVideo = await prisma.video.create({ data: { title: 'Delete test', uploaderId: ownerId, videoUrl: 'https://example.invalid/test.mp4' } });
        const beforeDelete = notifications.length;
        assert.equal((await originalFetch(`${base}/${localVideo.id}`, { method: 'DELETE', headers: { cookie: ownerCookie } })).status, 204);
        assert.equal(notifications.length, beforeDelete + 1);
        assert.deepEqual(notifications.at(-1).rooms, [`user:${ownerId}`, 'statistics:admins']);
    } finally {
        globalThis.fetch = originalFetch;
        await new Promise((resolve) => server.close(resolve));
        await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
        await prisma.$disconnect();
        redis.disconnect();
    }
});
