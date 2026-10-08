import 'server-only';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const SESSION_COOKIE = 'session';

export async function serverApiGet(path) {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE)?.value;

    try {
        const response = await fetch(`${API_URL}${path}`, {
            // Chuyển tiếp CHỈ cookie phiên, không chuyển cookie khác
            headers: session ? { cookie: `${SESSION_COOKIE}=${session}` } : {},
            cache: 'no-store',
            signal: AbortSignal.timeout(5000),
        });

        const data = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, data };
    } catch {
        return { ok: false, status: 0, data: null };
    }
}