import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET() {
    const status = { postgres: 'down', redis: 'down' };

    try {
        await prisma.$queryRaw`SELECT 1`;
        status.postgres = 'ok';
    } catch (error) {
        console.error('[health] postgres:', error.message);
    }

    try {
        const reply = await redis.ping();
        if (reply === 'PONG') status.redis = 'ok';
    } catch (error) {
        console.error('[health] redis:', error.message);
    }

    const healthy = status.postgres === 'ok' && status.redis === 'ok';
    return Response.json(status, { status: healthy ? 200 : 503 });
}