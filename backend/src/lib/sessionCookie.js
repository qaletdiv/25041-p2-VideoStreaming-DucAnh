import { env } from '../config/env.js';
import { SESSION_MAX_AGE_SECONDS } from './jwt.js';

export const SESSION_COOKIE = 'session';

const baseOptions = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
};

export function setSessionCookie(res, token) {
    // Lưu ý: maxAge của Express tính bằng MILLISECOND
    res.cookie(SESSION_COOKIE, token, {
        ...baseOptions,
        maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    });
}

export function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE, baseOptions);
}