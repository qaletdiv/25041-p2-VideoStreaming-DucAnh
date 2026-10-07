import { z } from 'zod';

export const registerSchema = z
    .object({
        name: z.string().trim().min(2, 'nameMin').max(50, 'nameMax'),
        email: z.string().trim().toLowerCase().pipe(z.email('emailInvalid')),
        password: z.string().min(8, 'passwordMin').max(72, 'passwordMax'),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'passwordMismatch',
        path: ['confirmPassword'],
    });