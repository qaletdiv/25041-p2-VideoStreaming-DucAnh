import { SignJWT, jwtVerify } from 'jose';

const rawSecret = process.env.JWT_SECRET;

if (!rawSecret || rawSecret.length < 32) {
    throw new Error('JWT_SECRET phải được đặt và dài ít nhất 32 ký tự');
}

const secret = new TextEncoder().encode(rawSecret);
const ALGORITHM = 'HS256';

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày, tính bằng giây

export async function signToken({ userId, role }) {
    return new SignJWT({ role })
        .setProtectedHeader({ alg: ALGORITHM })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_MAX_AGE}s`)
        .sign(secret);
}

export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
        return payload;
    } catch {
        return null; // sai chữ ký, hết hạn, hoặc token hỏng
    }
}