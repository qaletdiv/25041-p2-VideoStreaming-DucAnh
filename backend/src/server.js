import { createServer } from 'node:http';
import { env } from './config/env.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { finalizeProcessingVideos } from './services/video.service.js';

const server = createServer(app);

// Định kỳ chuyển video PROCESSING -> READY/FAILED (unref để không giữ process)
const sweeper = setInterval(() => {
    finalizeProcessingVideos().catch((error) => console.error('Sweeper video:', error.message));
}, 60_000);
sweeper.unref();

server.listen(env.port, () => {
    console.log(`Backend đang chạy tại http://localhost:${env.port}`);
});

async function shutdown(signal) {
    console.log(`Nhận ${signal}, đang tắt server...`);
    clearInterval(sweeper);
    server.close(async () => {
        await prisma.$disconnect();
        redis.disconnect();
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));