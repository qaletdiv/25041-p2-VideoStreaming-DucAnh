import { z } from 'zod';

// Giới hạn dung lượng: 100MB (Cloudinary Free plan upload trực tiếp)
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Chỉ chấp nhận file video
export const ACCEPTED_VIDEO_TYPES = [
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    'video/x-msvideo', 'video/x-matroska',
];

// Metadata video: khớp quy tắc với schema backend (title 1-200, desc max 2000)
export const videoMetaSchema = z.object({
    title: z.string().trim()
        .min(1, { message: 'titleRequired' })
        .max(200, { message: 'titleMax' }),
    description: z.string().trim()
        .max(2000, { message: 'descriptionMax' })
        .optional()
        .or(z.literal('')),
    categoryId: z.string().trim().max(100).optional().or(z.literal('')),
});
