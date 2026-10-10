import * as uploadService from '../services/upload.service.js';

// Mỗi lần upload xin chữ ký mới; chỉ người đăng nhập mới được gọi
export function createSignature(req, res) {
    const data = uploadService.createUploadSignature(req.user.id);
    res.json({ data });
}
