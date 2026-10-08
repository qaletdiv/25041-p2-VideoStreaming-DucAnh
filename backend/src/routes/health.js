import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

const router = Router();

router.get('/', async (req, res) => {
    const status = { postgres: 'down', redis: 'down' };

    try {
        await prisma.$queryRaw`SELECT 1`;
        status.postgres = 'ok';
    } catch (error) {
        console.error('[health] postgres:', error.message);
    }

    try {
        if ((await redis.ping()) === 'PONG') status.redis = 'ok';
    } catch (error) {
        console.error('[health] redis:', error.message);
    }

    const healthy = status.postgres === 'ok' && status.redis === 'ok';
    res.status(healthy ? 200 : 503).json(status);
});

export default router;