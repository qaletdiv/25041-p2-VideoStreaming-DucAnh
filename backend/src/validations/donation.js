import { z } from 'zod';

export const createDonationSchema = z.object({
    amount: z.number().int().min(1000).max(1000000),
    message: z.string().trim().max(300).default(''),
    requestId: z.string().uuid(),
});

export const listDonationsSchema = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});
