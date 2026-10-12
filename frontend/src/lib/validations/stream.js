import { z } from 'zod';

export const createStreamSchema = z.object({
    title: z.string().trim().min(1, 'titleRequired').max(200, 'titleMax'),
    videoId: z.string().min(1, 'videoRequired'),
    requireAuth: z.boolean(),
});
