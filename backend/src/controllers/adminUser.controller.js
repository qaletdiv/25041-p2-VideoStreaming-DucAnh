import * as users from '../services/adminUser.service.js';
import { controlStream, listUnfinishedStreams } from '../services/stream.service.js';
import { HttpError } from '../lib/httpError.js';

export async function listUsers(req, res) {
    res.json(await users.listUsers(req.validatedQuery));
}

export async function updateUserStatus(req, res) {
    const user = await users.updateUserStatus(req.params.id, req.user, req.body.isActive);
    if (!user.isActive) {
        const io = req.app.get('io');
        const sockets = io.in(`user:${user.id}`);
        sockets.emit('account:locked');
        sockets.disconnectSockets(true);
        // Chạy lại yêu cầu khóa cũng xử lý nốt các phòng chưa kết thúc.
        try {
            for (const stream of await listUnfinishedStreams(user.id)) {
                const state = await controlStream(stream.id, req.user, { action: 'END' });
                io.to(`stream:${stream.id}`).emit('stream:state', state);
                io.emit('stream:ended', { streamId: stream.id });
            }
        } catch {
            throw new HttpError(503, 'LOCK_STREAMS_PENDING', 'Account locked, but ending streams needs a retry');
        } finally {
            io.emit('stream:list-changed');
        }
    }
    res.json({ user });
}
