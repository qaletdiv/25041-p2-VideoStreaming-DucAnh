// Chỉ xác nhận khi playlist HLS và đoạn video đầu tiên đã tải được.
export async function checkHlsPlayback(url, fetchImpl = fetch) {
    try {
        const origin = new URL(url).origin;
        for (let depth = 0; depth < 3; depth++) {
            const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
            if (!response.ok) { await response.body?.cancel(); return false; }
            const text = await response.text();
            if (!text.trimStart().startsWith('#EXTM3U')) return false;
            const next = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith('#'));
            if (!next) return false;
            const nextUrl = new URL(next, url);
            if (nextUrl.origin !== origin) return false;
            if (text.includes('#EXTINF:')) {
                const segment = await fetchImpl(nextUrl.href, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(8000), redirect: 'error' });
                await segment.body?.cancel();
                return segment.ok;
            }
            url = nextUrl.href;
        }
    } catch { return false; }
    return false;
}
