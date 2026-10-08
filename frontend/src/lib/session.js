import { cache } from 'react';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { signToken, verifyToken, SESSION_MAX_AGE } from './jwt';

const COOKIE_NAME = 'session';

export async function createSession(user) {
    const token = await signToken({ userId: user.id, role: user.role });
    const store = await cookies();

    store.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
    });
}

export async function deleteSession() {
    const store = await cookies();
    store.delete(COOKIE_NAME);
}

// Chỉ verify JWT, không chạm database (nhanh)
export async function getSession() {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
}

// Verify JWT rồi tra database: tài khoản còn tồn tại và chưa bị khóa mới hợp lệ
export const getCurrentUser = cache(async () => {
    const session = await getSession();
    if (!session?.sub) return null;

    const user = await prisma.user.findUnique({
        where: { id: session.sub },
        select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) return null;
    return user;
});