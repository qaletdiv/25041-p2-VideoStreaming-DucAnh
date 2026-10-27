import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { withStreamControlLock } from './streamState.service.js';

export async function recordVideoView(videoId, user, { sessionId, streamId = null }) {
    const record = () => prisma.$transaction(async (tx) => {
        const video = await tx.video.findUnique({
            where: { id: videoId }, select: { status: true, uploaderId: true, viewCount: true },
        });
        if (!video || video.status !== 'READY') {
            throw new HttpError(404, 'VIDEO_NOT_FOUND', 'Video not found');
        }
        if (streamId) {
            const stream = await tx.stream.findUnique({ where: { id: streamId } });
            if (!stream || stream.videoId !== videoId) {
                throw new HttpError(404, 'STREAM_NOT_FOUND', 'Stream not found');
            }
            if (stream.requireAuth && !user) {
                throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
            }
            if (stream.status === 'ENDED') {
                throw new HttpError(409, 'STREAM_ENDED', 'Stream has ended');
            }
            if (stream.ownerId === user?.id) {
                return { counted: false, viewCount: video.viewCount, uploaderId: video.uploaderId };
            }
        }

        // Unique ở DB xử lý cả hai request cùng đến; không bắt lỗi trong transaction đã hỏng.
        const inserted = await tx.videoView.createMany({
            data: [{ sessionId, videoId, streamId }], skipDuplicates: true,
        });
        if (!inserted.count) {
            const existing = await tx.videoView.findUnique({ where: { sessionId } });
            if (!existing || existing.videoId !== videoId || existing.streamId !== streamId) {
                throw new HttpError(409, 'VIEW_SESSION_CONFLICT', 'View session already used');
            }
            const current = await tx.video.findUniqueOrThrow({ where: { id: videoId }, select: { viewCount: true } });
            return { counted: false, viewCount: current.viewCount, uploaderId: video.uploaderId };
        }
        // Lịch sử và tổng lượt xem cùng commit hoặc cùng rollback.
        const updated = await tx.video.updateMany({
            where: { id: videoId, status: 'READY' }, data: { viewCount: { increment: 1 } },
        });
        if (!updated.count) throw new HttpError(404, 'VIDEO_NOT_FOUND', 'Video not found');
        const current = await tx.video.findUniqueOrThrow({ where: { id: videoId }, select: { viewCount: true } });
        return { counted: true, viewCount: current.viewCount, uploaderId: video.uploaderId };
    }, { maxWait: 10000, timeout: 10000 });

    if (!streamId) return record();
    // Dùng chung khóa với END để không ghi lượt mới sau khi kết thúc phòng.
    const result = await withStreamControlLock(streamId, record);
    if (!result) throw new HttpError(409, 'STREAM_BUSY', 'Stream is busy');
    return result;
}
