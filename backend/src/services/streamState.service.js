import { redis } from '../lib/redis.js';
import { randomUUID } from 'node:crypto';

const stateKey = (streamId) => `stream:${streamId}:state`;
const controlLockKey = (streamId) => `stream:${streamId}:control-lock`;

const RELEASE_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
end
return 0
`;

export async function withStreamControlLock(streamId, callback) {
    const key = controlLockKey(streamId);
    const token = randomUUID();
    const acquired = await redis.set(key, token, 'PX', 30_000, 'NX');
    if (acquired !== 'OK') return null;

    try {
        return await callback();
    } finally {
        try {
            await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
        } catch (error) {
            console.error('[redis] release stream control lock:', error);
        }
    }
}

export async function restoreStreamState(streamId, state) {
    await redis.set(stateKey(streamId), JSON.stringify(state));
}

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

const TRANSITION_SCRIPT = `
local key = KEYS[1]
local action = ARGV[1]
local now = tonumber(ARGV[2])
local durationMs = tonumber(ARGV[3])
local seekMs = tonumber(ARGV[4])

local raw = redis.call('GET', key)
if not raw then return 'NOT_FOUND' end

local state = cjson.decode(raw)
if state.status == 'ENDED' then return 'INVALID_TRANSITION' end

local position = state.positionMs
if state.status == 'PLAYING' then
    position = math.min(durationMs, position + math.max(0, now - state.stateChangedAt))
end

if action == 'PLAY' then
    if state.status ~= 'CREATED' and state.status ~= 'PAUSED' then
        return 'INVALID_TRANSITION'
    end
    state.status = 'PLAYING'
elseif action == 'PAUSE' then
    if state.status ~= 'PLAYING' then return 'INVALID_TRANSITION' end
    state.status = 'PAUSED'
elseif action == 'SEEK' then
    if state.status ~= 'PLAYING' and state.status ~= 'PAUSED' then
        return 'INVALID_TRANSITION'
    end
    position = math.min(durationMs, seekMs)
elseif action == 'END' then
    state.status = 'ENDED'
else
    return 'INVALID_ACTION'
end

state.positionMs = position
state.stateChangedAt = now
redis.call('SET', key, cjson.encode(state))
return cjson.encode(state)
`;

export async function transitionStreamState(streamId, action, durationMs, seekMs = 0) {
    if (!Number.isSafeInteger(durationMs) || durationMs < 0 ||
        !Number.isSafeInteger(seekMs) || seekMs < 0) {
        throw new RangeError('durationMs and seekMs must be non-negative integers');
    }

    const now = Date.now();
    const result = await redis.eval(
        TRANSITION_SCRIPT, 1, stateKey(streamId),
        action, now, durationMs, seekMs,
    );

    if (result === 'NOT_FOUND') return null;
    if (result === 'INVALID_TRANSITION' || result === 'INVALID_ACTION') {
        throw new RangeError(result);
    }

    return { ...JSON.parse(result), serverNow: now };
}

const VIEWER_WINDOW_MS = 30_000;
const VIEWER_KEY_TTL_SECONDS = 60;
const viewersKey = (streamId) => `stream:${streamId}:viewers`;

// viewerId là định danh kết nối do server cấp, không nhận ID tuỳ ý từ client
export async function heartbeatViewer(streamId, viewerId) {
    const now = Date.now();
    const key = viewersKey(streamId);

    const results = await redis.multi()
        .zadd(key, now, viewerId)
        .zremrangebyscore(key, '-inf', now - VIEWER_WINDOW_MS)
        .zcount(key, now - VIEWER_WINDOW_MS + 1, '+inf')
        .expire(key, VIEWER_KEY_TTL_SECONDS)
        .exec();

    if (results.some(([error]) => error)) {
        throw results.find(([error]) => error)[0];
    }

    return { viewers: results[2][1], serverNow: now };
}

export async function countViewers(streamId) {
    const now = Date.now();
    const key = viewersKey(streamId);

    const results = await redis.multi()
        .zremrangebyscore(key, '-inf', now - VIEWER_WINDOW_MS)
        .zcount(key, now - VIEWER_WINDOW_MS + 1, '+inf')
        .exec();

    if (results.some(([error]) => error)) {
        throw results.find(([error]) => error)[0];
    }

    return { viewers: results[1][1], serverNow: now };
}
