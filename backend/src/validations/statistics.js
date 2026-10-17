import { z } from 'zod';

export const statisticsQuerySchema = z.object({
    ownerId: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});
