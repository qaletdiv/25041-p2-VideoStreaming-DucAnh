import Redis from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 1,
});

redis.on('error', (error) => {
    console.error('[redis]', error.code || error.message);
});