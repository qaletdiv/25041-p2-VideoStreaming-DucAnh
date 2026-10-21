import { z } from 'zod';

export const createChatBanSchema = z.object({
    userId: z.string().min(1).max(100),
    durationMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.null()]),
    reason: z.string().trim().max(200).default(''),
});
export const chatBanParamsSchema = z.object({ id: z.string().min(1).max(100), userId: z.string().min(1).max(100) });
export const listChatBansSchema = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});
