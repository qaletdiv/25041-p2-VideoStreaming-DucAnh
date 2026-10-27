import { signToken } from '../lib/jwt.js';
import { setSessionCookie, clearSessionCookie } from '../lib/sessionCookie.js';
import * as authService from '../services/auth.service.js';
import { listUnfinishedStreams, controlStream } from '../services/stream.service.js';
import { HttpError } from '../lib/httpError.js';

export async function register(req, res) {
    const user = await authService.registerUser(req.body);
    res.status(201).json({ user });
}

export async function login(req, res) {
    const { sessionVersion, ...user } = await authService.authenticateUser(req.body);
    const token = await signToken({ userId: user.id, role: user.role, sessionVersion });

    setSessionCookie(res, token);
    res.json({ user });
}

export async function logout(req, res) {
    if (req.user) {
        const io = req.app.get('io');
        try {
            for (const stream of await listUnfinishedStreams(req.user.id)) {
                const state = await controlStream(stream.id, req.user, { action: 'END' });
                io.to(`stream:${stream.id}`).emit('stream:state', state);
                io.emit('stream:ended', { streamId: stream.id });
            }
        } catch {
            // Giữ phiên để người dùng có thể thử đăng xuất lại khi kết thúc phòng lỗi.
            throw new HttpError(503, 'LOGOUT_STREAMS_PENDING', 'Unable to end all streams; retry logout');
        } finally {
            io.emit('stream:list-changed');
        }
        io.in(`user:${req.user.id}`).disconnectSockets(true);
    }
    clearSessionCookie(res);
    res.status(204).end();
}

export function me(req, res) {
    const { sessionVersion, ...user } = req.user;
    res.json({ user });
}
