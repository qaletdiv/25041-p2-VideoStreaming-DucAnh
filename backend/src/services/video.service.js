import { prisma } from '../lib/prisma.js';

// Ánh xạ sort -> điều kiện sắp xếp của Prisma
const SORT_BY = {
    newest: { createdAt: 'desc' },
    oldest: { createdAt: 'asc' },
    popular: { viewCount: 'desc' },
};

// Danh sách video công khai (chỉ READY): tìm kiếm, lọc danh mục, sắp xếp, phân trang
export async function listVideos({ q, category, sort = 'newest', page = 1, limit = 12 }) {
    const where = { status: 'READY' };

    if (q) {
        // Tìm không phân biệt hoa thường trong tiêu đề và mô tả
        where.OR = [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
        ];
    }

    if (category) {
        where.category = { slug: category };
    }

    const skip = (page - 1) * limit;

    // Lấy trang và đếm tổng song song (2 query độc lập)
    const [videos, total] = await Promise.all([
        prisma.video.findMany({
            where,
            orderBy: SORT_BY[sort] ?? SORT_BY.newest,
            skip,
            take: limit,
            select: {
                id: true,
                title: true,
                description: true,
                thumbnailUrl: true,
                duration: true,
                viewCount: true,
                createdAt: true,
                uploader: { select: { id: true, name: true, avatarUrl: true } },
                category: { select: { id: true, name: true, slug: true } },
            },
        }),
        prisma.video.count({ where }),
    ]);

    return { videos, total, page, limit, totalPages: Math.ceil(total / limit) };
}
