import * as users from '../services/adminUser.service.js';
import { controlStream, listUnfinishedStreams } from '../services/stream.service.js';
import { HttpError } from '../lib/httpError.js';
import { findActiveUserById } from '../services/auth.service.js';

async function synchronizeUser(io, id) {
    if (!io) return;
    const current = await findActiveUserById(id);
    const sockets = await io.in(`user:${id}`).fetchSockets();
    for (const socket of sockets) {
        if (!current || socket.data.sessionVersion !== current.sessionVersion) {
            socket.emit('account:session-expired');
            socket.disconnect(true);
            continue;
        }
        // Đổi role không ngắt stream đang phát; cập nhật quyền trên kết nối hiện tại.
        socket.data.user = current;
        if (current.role === 'ADMIN') await socket.join('statistics:admins');
        else await socket.leave('statistics:admins');
        socket.emit('account:updated');
    }
}

export async function createUser(req, res) {
    const user = await users.createUser(req.user, req.body);
    res.status(201).json({ user });
}

export async function updateUser(req, res) {
    const user = await users.updateUser(req.params.id, req.user, req.body);
    await synchronizeUser(req.app.get('io'), user.id);
    res.json({ user });
}

export async function updateUserRole(req, res) {
    const user = await users.updateUserRole(req.params.id, req.user, req.body.role);
    await synchronizeUser(req.app.get('io'), user.id);
    res.json({ user });
}

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
