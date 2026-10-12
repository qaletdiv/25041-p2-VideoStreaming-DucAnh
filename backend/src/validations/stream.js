import { z } from 'zod';

export const createStreamSchema = z.object({
    title: z.string().trim().min(1).max(200),
    videoId: z.string().min(1).max(100),
    requireAuth: z.boolean().default(false),
});

export const streamIdSchema = z.object({
    id: z.string().min(1).max(100),
});
