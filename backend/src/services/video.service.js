import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';
import { getVideoResource, deleteVideoResource } from '../lib/cloudinaryAdmin.js';

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

const MY_VIDEO_SELECT = {
    id: true,
    title: true,
    description: true,
    publicId: true,
    videoUrl: true,
    thumbnailUrl: true,
    duration: true,
    status: true,
    viewCount: true,
    createdAt: true,
    uploader: { select: { id: true, name: true } },
    category: { select: { id: true, name: true, slug: true } },
};

// Tạo video: asset phải nằm đúng thư mục riêng của người gọi trên Cloudinary
export async function createVideo(userId, { publicId, title, description, categoryId }) {
    const folder = `user_${userId}/`;
    if (!publicId.startsWith(folder)) {
        throw new HttpError(403, 'FOLDER_MISMATCH', 'Upload folder does not match your account');
    }

    // Hỏi Cloudinary Admin API: asset có thật và là video
    const resource = await getVideoResource(publicId);
    if (!resource || resource.resource_type !== 'video') {
        throw new HttpError(404, 'ASSET_NOT_FOUND', 'Uploaded video not found on Cloudinary');
    }

    if (categoryId) {
        const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
        if (!category) throw new HttpError(400, 'CATEGORY_NOT_FOUND', 'Category not found');
    }

    return prisma.video.create({
        data: {
            title,
            description,
            publicId,
            uploaderId: userId,
            categoryId: categoryId ?? null,
            duration: Math.round(resource.duration ?? 0),
            videoUrl: `https://res.cloudinary.com/${env.cloudinary.cloudName}/video/upload/sp_auto/${publicId}.m3u8`,
            thumbnailUrl: `https://res.cloudinary.com/${env.cloudinary.cloudName}/video/upload/${publicId}.jpg`,
            status: 'PROCESSING',
        },
        select: MY_VIDEO_SELECT,
    });
}

// Danh sách video của người gọi (mọi trạng thái), mới nhất trước
export async function listMyVideos(userId, { page = 1, limit = 12 }) {
    const where = { uploaderId: userId };
    const skip = (page - 1) * limit;

    const [videos, total] = await Promise.all([
        prisma.video.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: MY_VIDEO_SELECT,
        }),
        prisma.video.count({ where }),
    ]);

    return { videos, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// Xóa video: chủ sở hữu hoặc Admin; xóa luôn asset trên Cloudinary
export async function deleteVideo(userId, role, videoId) {
    const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { id: true, publicId: true, uploaderId: true },
    });
    if (!video) throw new HttpError(404, 'VIDEO_NOT_FOUND', 'Video not found');
    if (video.uploaderId !== userId && role !== 'ADMIN') {
        throw new HttpError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }

    if (video.publicId) {
        const result = await deleteVideoResource(video.publicId);
        // null = lỗi mạng/404 -> vẫn xóa record; partial = true -> có lỗi khi xóa
        if (result && result.partial) {
            throw new HttpError(502, 'CLOUDINARY_DELETE_FAILED', 'Failed to delete the video from Cloudinary');
        }
    }

    await prisma.video.delete({ where: { id: videoId } });
    return { id: videoId };
}

// Sweeper: chuyển PROCESSING -> READY/FAILED (server.js gọi định kỳ)
export async function finalizeProcessingVideos() {
    const pending = await prisma.video.findMany({
        where: { status: 'PROCESSING', createdAt: { lt: new Date(Date.now() - 30_000) } },
        select: { id: true, publicId: true, createdAt: true },
    });

    for (const video of pending) {
        // Quá 30 phút hoặc mất publicId -> thất bại
        if (Date.now() - video.createdAt.getTime() > 30 * 60_000 || !video.publicId) {
            await prisma.video.update({ where: { id: video.id }, data: { status: 'FAILED' } });
            continue;
        }

        try {
            const resource = await getVideoResource(video.publicId);
            if (!resource) {
                await prisma.video.update({ where: { id: video.id }, data: { status: 'FAILED' } });
            } else if (Number(resource.duration) > 0) {
                await prisma.video.update({
                    where: { id: video.id },
                    data: { status: 'READY', duration: Math.round(resource.duration) },
                });
            }
            // Chưa có duration -> để PROCESSING, duyệt lại sau
        } catch {
            // Lỗi Cloudinary -> bỏ qua, duyệt lại ở chu kỳ sau
        }
    }
}
