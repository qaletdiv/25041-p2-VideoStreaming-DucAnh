import { z } from 'zod';

const password = z.string().min(8, 'passwordMin').refine(
    (value) => new TextEncoder().encode(value).length <= 72, 'passwordMax',
);
const profile = {
    name: z.string().trim().min(2, 'nameMin').max(50, 'nameMax'),
    email: z.string().trim().toLowerCase().pipe(z.email('emailInvalid')),
};
export const createAdminUserSchema = z.object({ ...profile, password, role: z.enum(['ADMIN', 'USER']) });
export const updateAdminUserSchema = z.object({ ...profile, password: password.optional() });
