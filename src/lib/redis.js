import Redis from 'ioredis';

const globalForRedis = globalThis;

export const redis =
    globalForRedis.redis ??
    new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
    });

redis.on('error', (error) => {
    console.error('[redis]', error.code || error.message);
});

if (process.env.NODE_ENV !== 'production') {
    globalForRedis.redis = redis;
}