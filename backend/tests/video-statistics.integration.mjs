// Chạy: node --env-file=.env --test tests/video-statistics.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import app from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { redis } from '../src/lib/redis.js';
import { signToken } from '../src/lib/jwt.js';
import { resolveVideoStatisticsPeriod } from '../src/services/videoStatistics.service.js';

test('Video period: Vietnamese midnight and presets', () => {
    const now = new Date('2040-01-01T17:00:00Z');
    const today = resolveVideoStatisticsPeriod({ range: 'today', groupBy: 'day' }, now);
    assert.equal(today.from, '2040-01-02');
    assert.equal(today.start.toISOString(), '2040-01-01T17:00:00.000Z');
    assert.equal(today.endExclusive.toISOString(), '2040-01-02T17:00:00.000Z');
    assert.equal(resolveVideoStatisticsPeriod({ range: '7d' }, now).from, '2039-12-27');
    assert.equal(resolveVideoStatisticsPeriod({ range: '30d' }, now).from, '2039-12-04');
});

test('Video analytics: permissions, period boundaries, charts, search and pagination', { timeout: 60000 }, async () => {
    const [owner, other, admin] = [randomUUID(), randomUUID(), randomUUID()];
    const userIds = [owner, other, admin];
    const server = createServer(app);
    try {
        await prisma.user.createMany({ data: userIds.map((id) => ({ id, email: `${id}@test.invalid`, name: 'Video stats test', passwordHash: 'unused', role: id === admin ? 'ADMIN' : 'USER' })) });
        const start = new Date('2039-12-31T17:00:00Z');
        const end = new Date('2040-01-03T17:00:00Z');
        async function video(title, createdAt, uploaderId = owner) {
            return prisma.video.create({ data: { title, createdAt, uploaderId, duration: 60, videoUrl: 'https://example.invalid/test.mp4', viewCount: 999 } });
        }
        const old = await video('Old video', new Date('2039-12-01T00:00:00Z'));
        const alpha = await video('Alpha', start);
        const beta = await video('Beta 100%_', new Date('2040-01-01T17:00:00Z'));
        const outside = await video('Outside', end);
        const foreign = await video('Foreign', start, other);
        await prisma.videoView.createMany({ data: [
            [old.id, new Date(start.getTime() - 1)],
            [old.id, start],
            [old.id, new Date(end.getTime() - 1)],
            [old.id, end],
            [alpha.id, start],
            [foreign.id, start],
        ].map(([videoId, viewedAt]) => ({ videoId, viewedAt, sessionId: randomUUID() })) });
        server.listen(0, '127.0.0.1');
        await once(server, 'listening');
        const cookies = {};
        for (const id of userIds) cookies[id] = `session=${await signToken({ userId: id, role: id === admin ? 'ADMIN' : 'USER' })}`;
        async function get(extra = {}, actor = owner) {
            const params = new URLSearchParams({ range: 'custom', from: '2040-01-01', to: '2040-01-03', ...extra });
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/statistics/videos?${params}`, { headers: actor ? { cookie: cookies[actor] } : {} });
            return { status: response.status, data: await response.json() };
        }
        assert.equal((await get({}, null)).status, 401);
        assert.equal((await get({ ownerId: other })).status, 403);
        assert.equal((await get({ ownerId: randomUUID() }, admin)).status, 404);
        for (const bad of [{ from: '0000-01-01', to: '0000-01-02' }, { from: '2040-02-30' }, { to: '2039-12-31' }, { to: '2042-01-01' }, { range: 'today' }, { groupBy: 'year' }, { page: 0 }, { limit: 51 }, { order: 'desc;DROP TABLE' }]) {
            assert.equal((await get(bad)).status, 400, JSON.stringify(bad));
        }
        const response = await get();
        assert.equal(response.status, 200, JSON.stringify(response.data));
        const data = response.data;
        assert.deepEqual(data.kpis, { totalVideos: 2, totalViews: 3 });
        assert.equal(data.period.start, start.toISOString());
        assert.equal(data.period.endExclusive, end.toISOString());
        assert.deepEqual(data.timeline, [
            { date: '2040-01-01', views: 2 }, { date: '2040-01-02', views: 0 }, { date: '2040-01-03', views: 1 },
        ]);
        assert.equal(data.total, 3);
        assert.deepEqual(data.videos.map((v) => v.id), [old.id, alpha.id, beta.id]);
        assert.equal(data.videos[1].createdAt, start.toISOString());
        assert.deepEqual(data.topVideos.map((v) => v.views), [2, 1]);
        assert.ok(!data.videos.some((v) => v.id === outside.id || v.id === foreign.id));
        const page = (await get({ limit: 1, page: 2 })).data;
        assert.equal(page.totalPages, 3);
        assert.equal(page.videos[0].id, alpha.id);
        assert.deepEqual((await get({ page: 99 })).data.videos, []);
        assert.deepEqual((await get({ sort: 'title', order: 'asc' })).data.videos.map((v) => v.id), [alpha.id, beta.id, old.id]);
        assert.equal((await get({ sort: 'createdAt', order: 'desc' })).data.videos[0].id, beta.id);
        const search = (await get({ q: 'BETA' })).data;
        assert.equal(search.total, 1);
        assert.equal(search.videos[0].id, beta.id);
        assert.deepEqual(search.kpis, data.kpis);
        assert.equal((await get({ q: '%' })).data.total, 1);
        assert.equal((await get({ q: "' OR TRUE --" })).data.total, 0);
        assert.deepEqual((await get({ ownerId: owner }, admin)).data.kpis, data.kpis);
        const all = (await get({}, admin)).data;
        assert.ok(all.kpis.totalViews >= 4);
        assert.ok(all.kpis.totalVideos >= 3);
        const monthly = (await get({ groupBy: 'month' })).data;
        assert.deepEqual(monthly.timeline, [{ date: '2040-01-01', views: 3 }]);
        const weekly = (await get({ groupBy: 'week' })).data;
        assert.equal(weekly.timeline.reduce((sum, b) => sum + b.views, 0), 3);
        assert.ok(weekly.timeline.every((b) => new Date(`${b.date}T00:00:00Z`).getUTCDay() === 1));
        const empty = (await get({ from: '2050-01-01', to: '2050-01-02' })).data;
        assert.deepEqual(empty.kpis, { totalVideos: 0, totalViews: 0 });
        assert.deepEqual(empty.topVideos, []);
        assert.deepEqual(empty.videos, []);
        assert.equal(empty.totalPages, 0);
        assert.ok(empty.timeline.every((b) => b.views === 0));
    } finally {
        if (server.listening) await new Promise((resolve) => server.close(resolve));
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.$disconnect();
        redis.disconnect();
    }
});
