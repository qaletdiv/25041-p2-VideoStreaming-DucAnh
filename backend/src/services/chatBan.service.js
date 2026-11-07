import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';

const select = { userId: true, reason: true, expiresAt: true, createdAt: true, streamId: true };
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
    const createdAt = new Date();
    const expiresAt = durationMinutes === null ? null : new Date(createdAt.getTime() + durationMinutes * 60_000);
    const ban = await prisma.streamChatBan.upsert({
        where: { streamId_userId: { streamId, userId } },
        create: { streamId, userId, moderatorId: actor.id, expiresAt, reason, createdAt },
        update: { moderatorId: actor.id, expiresAt, reason, createdAt }, select,
    });
    return { ...ban, ownerId: stream.ownerId };
}

export async function removeChatBan(streamId, actor, userId, banStreamId = streamId) {
    const stream = await requireModerator(streamId, actor);
    const source = banStreamId === streamId ? stream : await prisma.stream.findUnique({ where: { id: banStreamId }, select: { ownerId: true } });
    if (!source || source.ownerId !== stream.ownerId) throw new HttpError(403, 'FORBIDDEN', 'Ban belongs to another streamer');
    const ban = await prisma.streamChatBan.findUnique({ where: { streamId_userId: { streamId: banStreamId, userId } }, select });
    if (!ban || (banStreamId !== streamId && ban.expiresAt !== null)) return null;
    await prisma.streamChatBan.delete({ where: { streamId_userId: { streamId: banStreamId, userId } } });
    return { ...ban, ownerId: source.ownerId };
}

export async function listChatBans(streamId, actor, { page, limit }) {
    const stream = await requireModerator(streamId, actor);
    const where = { OR: [
        { streamId, ...activeWhere(new Date()) },
        { expiresAt: null, stream: { ownerId: stream.ownerId } },
    ] };
    const [bans, total] = await prisma.$transaction([
        prisma.streamChatBan.findMany({ where, select: { ...select, user: { select: { name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        prisma.streamChatBan.count({ where }),
    ]);
    return { bans, page, totalPages: Math.ceil(total / limit) };
}
