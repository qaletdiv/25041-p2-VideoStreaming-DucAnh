import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';

const DAY = 86400000;
const OFFSET = 7 * 3600000;

export function resolveVideoStatisticsPeriod(query, now = new Date()) {
    const today = new Date(now.getTime() + OFFSET).toISOString().slice(0, 10);
    const to = query.range === 'custom' ? query.to : today;
    const days = query.range === '30d' ? 30 : query.range === '7d' ? 7 : 1;
    const from = query.range === 'custom' ? query.from
        : new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY).toISOString().slice(0, 10);
    return {
        from, to, timezone: 'Asia/Ho_Chi_Minh', groupBy: query.groupBy,
        start: new Date(`${from}T00:00:00+07:00`),
        endExclusive: new Date(Date.parse(`${to}T00:00:00+07:00`) + DAY),
    };
}

export async function getVideoStatistics(user, query) {
    if (user.role !== 'ADMIN' && query.ownerId && query.ownerId !== user.id) {
        throw new HttpError(403, 'FORBIDDEN', 'Statistics are private');
    }
    const uploaderId = user.role === 'ADMIN' ? query.ownerId : user.id;
    if (uploaderId && !await prisma.user.findUnique({ where: { id: uploaderId }, select: { id: true } })) {
        throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const period = resolveVideoStatisticsPeriod(query);
    const scope = uploaderId ? Prisma.sql`v."uploaderId" = ${uploaderId}` : Prisma.sql`TRUE`;
    // Chỉ tên cột/hướng sắp xếp từ danh sách cố định được đưa vào SQL.
    const column = { views: Prisma.sql`"views"`, createdAt: Prisma.sql`"createdAt"`, title: Prisma.sql`lower("title")` }[query.sort];
    const direction = query.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const interval = { day: '1 day', week: '1 week', month: '1 month' }[query.groupBy];
    const start = period.start;
    const end = period.endExclusive;
    // Một statement dùng cùng snapshot cho KPI, biểu đồ và phân trang.
    const [result] = await prisma.$queryRaw(Prisma.sql`
        WITH scoped AS (
            SELECT v.* FROM "Video" v WHERE ${scope}
        ), period_views AS (
            SELECT vv."videoId", vv."viewedAt" FROM "VideoView" vv
            JOIN scoped v ON v.id = vv."videoId"
            WHERE vv."viewedAt" >= ${start} AND vv."viewedAt" < ${end}
        ), counts AS (
            SELECT "videoId", count(*)::int AS views FROM period_views GROUP BY "videoId"
        ), candidates AS (
            SELECT v.id, v.title, v."thumbnailUrl", v.duration, v."createdAt", COALESCE(c.views, 0) AS views
            FROM scoped v LEFT JOIN counts c ON c."videoId" = v.id
            WHERE (v."createdAt" >= ${start} AND v."createdAt" < ${end}) OR c.views > 0
        ), filtered AS (
            SELECT * FROM candidates WHERE strpos(lower(title), lower(${query.q})) > 0
        ), paged AS (
            SELECT *, row_number() OVER (ORDER BY ${column} ${direction}, id ASC) AS ordinal
            FROM filtered ORDER BY ${column} ${direction}, id ASC
            LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
        ), top_videos AS (
            SELECT * FROM candidates WHERE views > 0 ORDER BY views DESC, id ASC LIMIT 10
        ), buckets AS (
            SELECT date_trunc(${query.groupBy}::text,
                "viewedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') AS bucket,
                count(*)::int AS views
            FROM period_views GROUP BY bucket
        ), calendar AS (
            SELECT generate_series(
                date_trunc(${query.groupBy}::text, ${period.from}::date::timestamp),
                date_trunc(${query.groupBy}::text, ${period.to}::date::timestamp),
                ${interval}::interval
            ) AS bucket
        )
        SELECT
            (SELECT count(*)::int FROM scoped WHERE "createdAt" >= ${start} AND "createdAt" < ${end}) AS "totalVideos",
            (SELECT count(*)::int FROM period_views) AS "totalViews",
            (SELECT count(*)::int FROM filtered) AS total,
            COALESCE((SELECT json_agg(json_build_object(
                'id', id, 'title', title, 'thumbnailUrl', "thumbnailUrl", 'duration', duration,
                'createdAt', to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'views', views
            ) ORDER BY ordinal) FROM paged), '[]'::json) AS videos,
            COALESCE((SELECT json_agg(json_build_object(
                'id', id, 'title', title, 'views', views
            ) ORDER BY views DESC, id ASC) FROM top_videos), '[]'::json) AS "topVideos",
            (SELECT json_agg(json_build_object(
                'date', to_char(calendar.bucket, 'YYYY-MM-DD'), 'views', COALESCE(buckets.views, 0)
            ) ORDER BY calendar.bucket) FROM calendar LEFT JOIN buckets USING (bucket)) AS timeline
    `);
    return {
        period, scope: { uploaderId: uploaderId ?? null },
        kpis: { totalVideos: result.totalVideos, totalViews: result.totalViews },
        timeline: result.timeline, topVideos: result.topVideos,
        videos: result.videos, total: result.total, page: query.page, limit: query.limit,
        totalPages: Math.ceil(result.total / query.limit),
    };
}
