import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import app from './app.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { finalizeProcessingVideos } from './services/video.service.js';
import { registerStreamSockets } from './socket/streams.js';

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: env.clientOrigins,
        credentials: true,
    },
    allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        callback(null, !origin || env.clientOrigins.includes(origin));
    },
});
registerStreamSockets(io);

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
    io.close(async () => {
        await prisma.$disconnect();
        redis.disconnect();
        process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
