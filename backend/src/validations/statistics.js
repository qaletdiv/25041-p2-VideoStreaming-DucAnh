import { z } from 'zod';

export const statisticsQuerySchema = z.object({
    ownerId: z.string().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !value.startsWith('0000-') && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');

export const videoStatisticsQuerySchema = z.object({
    range: z.enum(['today', '7d', '30d', 'custom']).default('7d'),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
    ownerId: z.string().min(1).max(100).optional(),
    q: z.string().trim().max(100).default(''),
    sort: z.enum(['views', 'createdAt', 'title']).default('views'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
}).strict().superRefine((value, ctx) => {
    if (value.range === 'custom') {
        if (!value.from || !value.to) {
            ctx.addIssue({ code: 'custom', path: ['from'], message: 'Both from and to are required' });
            return;
        }
        const days = (Date.parse(value.to) - Date.parse(value.from)) / 86400000 + 1;
        if (!Number.isFinite(days) || days < 1 || days > 366) {
            ctx.addIssue({ code: 'custom', path: ['to'], message: 'Choose a range of 1 to 366 days' });
        }
    } else if (value.from || value.to) {
        ctx.addIssue({ code: 'custom', path: ['range'], message: 'Dates require custom range' });
    }
});
