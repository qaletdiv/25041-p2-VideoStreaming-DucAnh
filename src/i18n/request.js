import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from './config';

export default getRequestConfig(async () => {
    const store = await cookies();
    const saved = store.get(LOCALE_COOKIE)?.value;
    const locale = LOCALES.includes(saved) ? saved : DEFAULT_LOCALE;

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,
    };
});