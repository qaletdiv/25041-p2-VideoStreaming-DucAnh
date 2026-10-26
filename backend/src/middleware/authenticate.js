import { verifyToken } from '../lib/jwt.js';
import { SESSION_COOKIE } from '../lib/sessionCookie.js';
import { HttpError } from '../lib/httpError.js';
import { findActiveUserById } from '../services/auth.service.js';

export async function authenticate(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    const payload = token ? await verifyToken(token) : null;
    const user = payload?.sub ? await findActiveUserById(payload.sub, payload.sessionVersion ?? 0) : null;

    if (!user) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    req.user = user;
    next();
}

// Route công khai vẫn nhận diện người dùng nếu có cookie hợp lệ
export async function optionalAuthenticate(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    const payload = token ? await verifyToken(token) : null;
    req.user = payload?.sub ? await findActiveUserById(payload.sub, payload.sessionVersion ?? 0) : null;
    next();
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
        }

        if (!roles.includes(req.user.role)) {
            throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
        }

        next();
    };
}
