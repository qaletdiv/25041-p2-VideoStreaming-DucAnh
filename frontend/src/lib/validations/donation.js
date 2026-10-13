import { z } from 'zod';

export const donationSchema = z.object({
    amount: z.coerce.number().int('amountInvalid').min(1000, 'amountInvalid').max(1000000, 'amountInvalid'),
    message: z.string().trim().max(300, 'messageTooLong'),
});
