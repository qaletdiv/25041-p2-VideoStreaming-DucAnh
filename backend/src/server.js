import { createServer } from 'node:http';
import { env } from './config/env.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

const server = createServer(app);

server.listen(env.port, () => {
    console.log(`Backend đang chạy tại http://localhost:${env.port}`);
});

async function shutdown(signal) {
    console.log(`Nhận ${signal}, đang tắt server...`);
    server.close(async () => {
        await prisma.$disconnect();
        redis.disconnect();
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));