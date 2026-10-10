import { z } from 'zod';

// Tham số truy vấn GET /api/videos (query string là chuỗi -> coerce sang số)
export const listVideosSchema = z.object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    sort: z.enum(['newest', 'oldest', 'popular']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
});
