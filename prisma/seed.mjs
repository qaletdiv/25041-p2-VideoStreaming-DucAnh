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

    console.log(`Seed xong: ${categories.length} category, ${users.length} user`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());