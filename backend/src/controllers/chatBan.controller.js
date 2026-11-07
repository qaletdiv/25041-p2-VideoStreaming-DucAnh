import * as chatBans from '../services/chatBan.service.js';
import { prisma } from '../lib/prisma.js';

function notify(req, userId, ban) {
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('stream:chat-ban', { streamId: req.params.id, ban, serverNow: Date.now() });
    io.to(`stream:${req.params.id}`).emit('stream:moderation-changed');
}

export async function createChatBan(req, res) {
    const ban = await chatBans.createChatBan(req.params.id, req.user, req.body);
    const { ownerId, ...publicBan } = ban;
    notify(req, ban.userId, publicBan);
    if (ban.expiresAt === null) {
        const io = req.app.get('io');
        try {
            const sockets = await io.in(`user:${ban.userId}`).fetchSockets();
            const joinedStreamIds = [...new Set(sockets.map((socket) => socket.data.streamId).filter(Boolean))];
            const joinedStreams = joinedStreamIds.length
                ? await prisma.stream.findMany({ where: { id: { in: joinedStreamIds } }, select: { id: true, ownerId: true } })
                : [];
            const bannedStreamIds = new Set(joinedStreams.filter((stream) => stream.ownerId === ownerId).map((stream) => stream.id));
            for (const socket of sockets) {
                const joinedStreamId = socket.data.streamId;
                if (bannedStreamIds.has(joinedStreamId)) {
                    socket.emit('stream:access-banned', { streamId: joinedStreamId });
                    socket.disconnect(true);
                }
            }
        } catch (error) {
            console.error('[chat-ban] Could not disconnect permanently banned viewers:', error);
        }
    }
    res.status(201).json({ ban: publicBan });
}

export async function removeChatBan(req, res) {
    const ban = await chatBans.removeChatBan(req.params.id, req.user, req.params.userId, req.params.banStreamId ?? req.params.id);
    if (ban) {
        req.app.get('io').to(`user:${req.params.userId}`).emit('stream:chat-ban', { streamId: ban.streamId, ban: null, serverNow: Date.now() });
        req.app.get('io').to(`stream:${ban.streamId}`).emit('stream:moderation-changed');
    } else notify(req, req.params.userId, null);
    if (ban?.expiresAt === null) req.app.get('io').to(`user:${req.params.userId}`).emit('stream:access-unbanned', { ownerId: ban.ownerId });
    res.status(204).end();
}

export async function listChatBans(req, res) {
    res.json(await chatBans.listChatBans(req.params.id, req.user, req.validatedQuery));
}
