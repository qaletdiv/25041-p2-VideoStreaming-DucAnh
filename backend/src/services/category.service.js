import { prisma } from '../lib/prisma.js';

// Danh sách danh mục để lọc (sắp xếp theo tên)
export async function listCategories() {
    return prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true },
    });
}
