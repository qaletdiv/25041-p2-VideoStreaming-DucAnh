import { z } from 'zod';

export const createStreamSchema = z.object({
    title: z.string().trim().min(1).max(200),
    videoId: z.string().min(1).max(100),
    requireAuth: z.boolean().default(false),
});

export const streamIdSchema = z.object({
    id: z.string().min(1).max(100),
});

export const streamOverlaySchema = z.object({
    x: z.number().int().min(0).max(100),
    y: z.number().int().min(0).max(100),
    width: z.number().int().min(20).max(100),
    height: z.number().int().min(15).max(100),
}).refine((value) => value.x + value.width <= 100 && value.y + value.height <= 100, {
    message: 'Overlay must stay inside the video',
});

export const streamActionSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('PLAY') }),
    z.object({ action: z.literal('PAUSE') }),
    z.object({ action: z.literal('SEEK'), positionMs: z.number().int().min(0) }),
    z.object({ action: z.literal('END') }),
]);
