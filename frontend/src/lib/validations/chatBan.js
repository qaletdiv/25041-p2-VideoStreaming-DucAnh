import { z } from 'zod';

export const chatBanSchema = z.object({
    userId: z.string().min(1).max(100),
    durationMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.null()]),
    reason: z.string().trim().max(200).default(''),
});
