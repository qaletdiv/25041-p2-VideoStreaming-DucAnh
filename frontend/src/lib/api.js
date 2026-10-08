const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch(path, { method = 'GET', body } = {}) {
    if (!API_URL) {
        throw new Error('Thiếu biến môi trường NEXT_PUBLIC_API_URL');
    }

    try {
        const response = await fetch(`${API_URL}${path}`, {
            method,
            credentials: 'include', // gửi và nhận cookie xuyên origin
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });

        // 204 No Content không có thân; phản hồi lỗi lạ có thể không phải JSON
        const data = response.status === 204 ? null : await response.json().catch(() => null);

        return { ok: response.ok, status: response.status, data };
    } catch {
        // Mất mạng, backend tắt, hoặc bị CORS chặn
        return { ok: false, status: 0, data: { error: { code: 'NETWORK_ERROR' } } };
    }
}