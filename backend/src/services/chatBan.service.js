import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';

const select = { userId: true, reason: true, expiresAt: true };
const activeWhere = (now) => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

async function requireModerator(streamId, actor) {
    const stream = await prisma.stream.findUnique({ where: { id: streamId }, select: { ownerId: true } });
    if (!stream) throw new HttpError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    if (stream.ownerId !== actor.id && actor.role !== 'ADMIN') {
        throw new HttpError(403, 'FORBIDDEN', 'Only the owner or an admin can moderate chat');
    }
    return stream;
}

export async function getActiveChatBan(streamId, userId) {
    if (!userId) return null;
    return prisma.streamChatBan.findFirst({ where: { streamId, userId, ...activeWhere(new Date()) }, select });
}

export async function createChatBan(streamId, actor, { userId, durationMinutes, reason }) {
    const stream = await requireModerator(streamId, actor);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    if (userId === actor.id || userId === stream.ownerId || user.role === 'ADMIN') {
        throw new HttpError(403, 'BAN_TARGET_PROTECTED', 'Cannot ban the owner, an admin or yourself');
    }
    const expiresAt = durationMinutes === null ? null : new Date(Date.now() + durationMinutes * 60_000);
    return prisma.streamChatBan.upsert({
        where: { streamId_userId: { streamId, userId } },
        create: { streamId, userId, moderatorId: actor.id, expiresAt, reason },
        update: { moderatorId: actor.id, expiresAt, reason }, select,
    });
}

export async function removeChatBan(streamId, actor, userId) {
    await requireModerator(streamId, actor);
    await prisma.streamChatBan.deleteMany({ where: { streamId, userId } });
}

export async function listChatBans(streamId, actor, { page, limit }) {
    await requireModerator(streamId, actor);
    const where = { streamId, ...activeWhere(new Date()) };
    const [bans, total] = await prisma.$transaction([
        prisma.streamChatBan.findMany({ where, select: { ...select, user: { select: { name: true } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        prisma.streamChatBan.count({ where }),
    ]);
    return { bans, page, totalPages: Math.ceil(total / limit) };
}
