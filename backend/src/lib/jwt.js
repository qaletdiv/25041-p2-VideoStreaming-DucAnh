import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.jwtSecret);
const ALGORITHM = 'HS256';

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 ngày

export async function signToken({ userId, role }) {
    return new SignJWT({ role })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
        .sign(secret);
}

export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
        return payload;
    } catch {
        return null; // sai chữ ký, hết hạn hoặc token hỏng
    }
}