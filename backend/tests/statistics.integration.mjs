// Chạy: node --env-file=.env --test tests/statistics.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { signToken } from '../src/lib/jwt.js';

test('Statistics: private scope, admin filters, aggregates, pagination and sample cap', async () => {
    const [ownerId, otherId, adminId] = [randomUUID(), randomUUID(), randomUUID()];
    const ids = [ownerId, otherId, adminId];
    const [first, second, foreign] = [randomUUID(), randomUUID(), randomUUID()];
    const server = createServer(app);
    try {
        await prisma.user.createMany({ data: ids.map((id) => ({ id, email: `${id}@test.invalid`, name: 'Stats test', passwordHash: 'unused', role: id === adminId ? 'ADMIN' : 'USER' })) });
        const video = await prisma.video.create({ data: { title: 'Stats test', videoUrl: 'https://example.invalid/video.mp4', uploaderId: ownerId } });
        await prisma.stream.createMany({ data: [first, second, foreign].map((id) => ({ id, title: 'Stats test', videoId: video.id, ownerId: id === foreign ? otherId : ownerId, status: id === first ? 'ENDED' : 'CREATED' })) });
        await prisma.streamSample.createMany({ data: Array.from({ length: 125 }, (_, i) => ({ streamId: first, ts: new Date(1700000000000 + i * 10000), viewers: i, positionMs: i * 10000 })) });
        await prisma.streamSample.create({ data: { streamId: foreign, viewers: 9999, positionMs: 0 } });
        await prisma.donation.createMany({ data: [{ streamId: first, amount: 10000 }, { streamId: second, amount: 20000 }, { streamId: foreign, amount: 90000 }].map((item) => ({ ...item, userId: otherId, requestId: randomUUID() })) });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const cookies = {};
        for (const id of ids) cookies[id] = `session=${await signToken({ userId: id, role: id === adminId ? 'ADMIN' : 'USER' })}`;
        async function get(path, actor = ownerId) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/statistics${path}`, { headers: actor ? { cookie: cookies[actor] } : {} });
            return { status: response.status, data: await response.json() };
        }
        assert.equal((await get('', null)).status, 401);
        assert.equal((await get(`?ownerId=${otherId}`)).status, 403);
        assert.equal((await get(`/streams/${foreign}`)).status, 403);
        assert.equal((await get('?page=0')).status, 400);
        const overview = (await get('?limit=1')).data;
        assert.equal(overview.total, 2);
        assert.equal(overview.active, 1);
        assert.equal(overview.totalPages, 2);
        assert.equal(overview.streams.length, 1);
        assert.equal(overview.donationAmount, 30000);
        assert.equal(overview.donationCount, 2);
        assert.equal(overview.peakViewers, 124);
        assert.equal(overview.averageViewers, 62);
        assert.equal(overview.sampleCount, 125);
        const next = (await get('?limit=1&page=2')).data;
        assert.notEqual(next.streams[0].id, overview.streams[0].id);
        const detail = (await get(`/streams/${first}`)).data;
        assert.equal(detail.samples.length, 120);
        assert.equal(detail.samples[0].viewers, 5);
        assert.equal(detail.samples.at(-1).viewers, 124);
        assert.equal(detail.donationAmount, 10000);
        assert.equal(detail.averageViewers, 62);
        const empty = (await get(`/streams/${second}`)).data;
        assert.equal(empty.peakViewers, null);
        assert.deepEqual(empty.samples, []);
        assert.equal((await get(`?ownerId=${ownerId}`, adminId)).data.donationAmount, 30000);
        assert.equal((await get(`/streams/${foreign}`, adminId)).data.peakViewers, 9999);
        assert.ok((await get('', adminId)).data.total >= 3);
        assert.equal((await get(`?ownerId=${randomUUID()}`, adminId)).status, 404);
        assert.equal((await get(`/streams/${randomUUID()}`)).status, 404);
    } finally {
        await new Promise((resolve) => server.close(resolve));
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        await prisma.$disconnect();
        redis.disconnect();
    }
});
