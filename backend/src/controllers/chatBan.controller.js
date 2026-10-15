import * as chatBans from '../services/chatBan.service.js';

function notify(req, userId, ban) {
    const io = req.app.get('io');
    io.to(`user:${userId}`).emit('stream:chat-ban', { streamId: req.params.id, ban, serverNow: Date.now() });
    io.to(`stream:${req.params.id}`).emit('stream:moderation-changed');
}

export async function createChatBan(req, res) {
    const ban = await chatBans.createChatBan(req.params.id, req.user, req.body);
    notify(req, ban.userId, ban);
    res.status(201).json({ ban });
}

export async function removeChatBan(req, res) {
    await chatBans.removeChatBan(req.params.id, req.user, req.params.userId);
    notify(req, req.params.userId, null);
    res.status(204).end();
}

export async function listChatBans(req, res) {
    res.json(await chatBans.listChatBans(req.params.id, req.user, req.validatedQuery));
}
