import { env } from '../config/env.js';
import { signUploadParams } from '../lib/cloudinary.js';

// Tham số upload thẳng Cloudinary cho người dùng đang đăng nhập.
// Thư mục riêng mỗi người dùng; timestamp lùi 45 phút để chữ ký còn 15 phút hiệu lực.
export function createUploadSignature(userId) {
    const folder = `user_${userId}`;
    const timestamp = Math.floor(Date.now() / 1000) - 45 * 60;
    const signature = signUploadParams({ folder, timestamp }, env.cloudinary.apiSecret);

    return {
        cloudName: env.cloudinary.cloudName,
        apiKey: env.cloudinary.apiKey,
        folder,
        timestamp,
        signature,
    };
}
