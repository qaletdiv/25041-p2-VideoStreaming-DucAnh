import { env } from '../config/env.js';

const API_BASE = 'https://api.cloudinary.com/v1_1';

// Gọi Cloudinary Admin API (Basic auth bằng API Key/Secret). Trả null khi asset không tồn tại (404)
async function adminRequest(method, path) {
    const auth = Buffer.from(`${env.cloudinary.apiKey}:${env.cloudinary.apiSecret}`).toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
        const response = await fetch(`${API_BASE}/${env.cloudinary.cloudName}${path}`, {
            method,
            headers: { Authorization: `Basic ${auth}` },
            signal: controller.signal,
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Cloudinary Admin API HTTP ${response.status}`);
        return response.json();
    } finally {
        clearTimeout(timer);
    }
}

// Lấy thông tin asset video (kèm duration, resource_type)
export function getVideoResource(publicId) {
    return adminRequest('GET', `/resources/video/upload/${encodeURIComponent(publicId)}?media_metadata=true`);
}

// Xóa asset video khỏi Cloudinary (invalidate để xóa cache CDN)
export function deleteVideoResource(publicId) {
    return adminRequest('DELETE', `/resources/video/upload?public_ids[]=${encodeURIComponent(publicId)}&invalidate=true`);
}
