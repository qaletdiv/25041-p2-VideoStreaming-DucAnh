import { redis } from '../lib/redis.js';

const stateKey = (streamId) => `stream:${streamId}:state`;

// Chỉ khởi tạo một lần; gọi lại không ghi đè trạng thái đang phát
export async function initializeStreamState(streamId) {
    const initialState = {
        status: 'CREATED',
        positionMs: 0,
        stateChangedAt: null,
    };

    await redis.set(stateKey(streamId), JSON.stringify(initialState), 'NX');
    return getStreamState(streamId);
}

// serverNow giúp client bù chênh lệch giữa đồng hồ máy xem và server
export async function getStreamState(streamId) {
    const value = await redis.get(stateKey(streamId));
    if (value === null) return null;

    return { ...JSON.parse(value), serverNow: Date.now() };
}
