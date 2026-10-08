import 'server-only';
import { forbidden } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';

// Bắt buộc đã đăng nhập; chưa thì chuyển về trang đăng nhập
export async function requireUser() {
    const user = await getCurrentUser();

    if (!user) {
        redirect({ href: '/login', locale: await getLocale() });
    }

    return user;
}

// Bắt buộc có một trong các Role; không đủ quyền thì hiển thị trang 403
export async function requireRole(...roles) {
    const user = await requireUser();

    if (!roles.includes(user.role)) {
        forbidden();
    }

    return user;
}