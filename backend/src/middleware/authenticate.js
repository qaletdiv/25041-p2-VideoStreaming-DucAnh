import { verifyToken } from '../lib/jwt.js';
import { SESSION_COOKIE } from '../lib/sessionCookie.js';
import { HttpError } from '../lib/httpError.js';
import { findActiveUserById } from '../services/auth.service.js';

export async function authenticate(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    const payload = token ? await verifyToken(token) : null;
    const user = payload?.sub ? await findActiveUserById(payload.sub) : null;

    if (!user) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
    }

    req.user = user;
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