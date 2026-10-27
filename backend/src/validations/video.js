import { z } from 'zod';

// Tham số truy vấn GET /api/videos (query string là chuỗi -> coerce sang số)
export const listVideosSchema = z.object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    sort: z.enum(['newest', 'oldest', 'popular']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
});

// Tạo video: FE chỉ báo publicId, BE tự xác minh và lấy metadata từ Cloudinary
export const createVideoSchema = z.object({
    publicId: z.string().trim().min(1).max(500).regex(/^[\w./-]+$/),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    categoryId: z.string().trim().min(1).max(100).optional(),
});

// Danh sách video của mình
export const listMyVideosSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
});

// Tham số đường dẫn /api/videos/:id
export const videoIdSchema = z.object({
    id: z.string().min(1).max(100),
});

export const videoViewSchema = z.object({
    sessionId: z.string().uuid(),
    streamId: z.string().min(1).max(100).optional(),
}).strict();
