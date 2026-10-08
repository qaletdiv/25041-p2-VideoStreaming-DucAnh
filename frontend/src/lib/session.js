import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { serverApiGet } from '@/lib/api.server';

export const getCurrentUser = cache(async () => {
    // Không có cookie phiên thì khỏi tốn một lượt gọi backend
    const cookieStore = await cookies();
    if (!cookieStore.has('session')) return null;

    const { ok, data } = await serverApiGet('/auth/me');
    return ok ? data.user : null;
});