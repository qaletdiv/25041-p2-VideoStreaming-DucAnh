import { randomUUID } from 'node:crypto';
import { redis } from '../lib/redis.js';
import { HttpError } from '../lib/httpError.js';

const chatKey = (streamId) => `stream:${streamId}:chat`;
const rateKey = (streamId, userId) => `stream:${streamId}:chat-rate:${userId}`;

export async function listRecentMessages(streamId) {
    const items = await redis.lrange(chatKey(streamId), 0, 99);
    return items.reverse().map((item) => JSON.parse(item));
}

export async function publishMessage(streamId, user, text) {
    const allowed = await redis.set(rateKey(streamId, user.id), '1', 'EX', 1, 'NX');
    if (allowed !== 'OK') {
        throw new HttpError(429, 'CHAT_RATE_LIMIT', 'Please wait before sending another message');
    }

    const message = {
        id: randomUUID(),
        streamId,
        text,
        sentAt: new Date().toISOString(),
        user: { id: user.id, name: user.name, role: user.role },
    };

    const results = await redis.multi()
        .lpush(chatKey(streamId), JSON.stringify(message))
        .ltrim(chatKey(streamId), 0, 99)
        .expire(chatKey(streamId), 24 * 60 * 60)
        .exec();
    const failure = results.find(([error]) => error);
    if (failure) throw failure[0];

    return message;
}
