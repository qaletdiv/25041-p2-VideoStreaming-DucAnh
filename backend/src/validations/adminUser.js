import { z } from 'zod';

export const listUsersSchema = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().max(100).default(''),
    status: z.enum(['all', 'active', 'locked']).default('all'),
});
export const userIdSchema = z.object({ id: z.string().min(1).max(100) });
export const updateUserStatusSchema = z.object({ isActive: z.boolean() }).strict();

const name = z.string().trim().min(2, 'nameMin').max(50, 'nameMax');
const email = z.string().trim().toLowerCase().pipe(z.email('emailInvalid'));
const password = z.string().min(8, 'passwordMin').refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'passwordMax');
export const createUserSchema = z.object({ name, email, password, role: z.enum(['ADMIN', 'USER']) }).strict();
export const updateUserSchema = z.object({ name, email, password: password.optional() }).strict();
export const updateUserRoleSchema = z.object({ role: z.enum(['ADMIN', 'USER']) }).strict();
