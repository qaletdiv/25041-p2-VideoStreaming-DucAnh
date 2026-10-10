import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const categories = [
    { name: 'Game', slug: 'game' },
    { name: 'Giải trí', slug: 'giai-tri' },
    { name: 'Công nghệ', slug: 'cong-nghe' },
    { name: 'Âm nhạc', slug: 'am-nhac' },
    { name: 'Giáo dục', slug: 'giao-duc' },
];

const users = [
    { name: 'Admin', email: 'admin@streamhub.local', role: 'ADMIN' },
    { name: 'User Một', email: 'user1@streamhub.local', role: 'USER' },
    { name: 'User Hai', email: 'user2@streamhub.local', role: 'USER' },
];

async function main() {
    for (const category of categories) {
        await prisma.category.upsert({
            where: { slug: category.slug },
            update: {},
            create: category,
        });
    }

    for (const user of users) {
        const passwordHash = await bcrypt.hash('123456', 10);
        await prisma.user.upsert({
            where: { email: user.email },
            update: {},
            create: { ...user, passwordHash },
        });
    }

    // 30 video mẫu: dữ liệu tính theo công thức từ i (không ngẫu nhiên) để chạy lại luôn giống nhau
    const sampleVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    const uploaderEmails = ['user1@streamhub.local', 'user2@streamhub.local'];
    const categorySlugs = ['game', 'giai-tri', 'cong-nghe', 'am-nhac', 'giao-duc'];
    const baseDate = new Date('2026-10-01T00:00:00Z');

    for (let i = 1; i <= 30; i++) {
        const id = `seed-video-${String(i).padStart(2, '0')}`;
        const createdAt = new Date(baseDate.getTime() + i * 18 * 60 * 60 * 1000);

        await prisma.video.upsert({
            where: { id },
            update: {},
            create: {
                id,
                title: `Video mẫu ${String(i).padStart(2, '0')}`,
                videoUrl: sampleVideoUrl,
                thumbnailUrl: null,
                duration: 60 + ((i * 37) % 600),
                status: 'READY',
                viewCount: (i * 7919) % 5000,
                createdAt,
                uploader: { connect: { email: uploaderEmails[i % 2] } },
                category: { connect: { slug: categorySlugs[i % 5] } },
            },
        });
    }

    console.log(`Seed xong: ${categories.length} category, ${users.length} user, 30 video`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());