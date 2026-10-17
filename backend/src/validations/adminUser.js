import { z } from 'zod';

export const listUsersSchema = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().max(100).default(''),
    status: z.enum(['all', 'active', 'locked']).default('all'),
});
export const userIdSchema = z.object({ id: z.string().min(1).max(100) });
export const updateUserStatusSchema = z.object({ isActive: z.boolean() }).strict();
