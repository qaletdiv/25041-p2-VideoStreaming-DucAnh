import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { isProtectedPath } from './lib/routes';

const handleI18nRouting = createMiddleware(routing);

export function proxy(request) {
    const { pathname } = request.nextUrl;
    const [, firstSegment, ...rest] = pathname.split('/');

    // Chỉ kiểm tra khi URL đã có tiền tố ngôn ngữ; nếu chưa, để i18n chuyển hướng trước
    if (routing.locales.includes(firstSegment)) {
        const pathWithoutLocale = `/${rest.join('/')}`;
        const hasSession = request.cookies.has('session');

        if (isProtectedPath(pathWithoutLocale) && !hasSession) {
            return NextResponse.redirect(new URL(`/${firstSegment}/login`, request.url));
        }
    }

    return handleI18nRouting(request);
}

export const config = {
    matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};