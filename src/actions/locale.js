'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALES, LOCALE_COOKIE } from '@/i18n/config';

export async function setLocale(locale) {
    // Server Action là endpoint công khai: luôn kiểm tra dữ liệu đầu vào
    if (!LOCALES.includes(locale)) return;

    const store = await cookies();
    store.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
    });

    revalidatePath('/', 'layout');
}