import { prisma } from '../lib/prisma.js';
import { controlStream } from '../services/stream.service.js';

export const OWNER_RECONNECT_GRACE_MS = 15_000;

export function createOwnerPresence(io) {
    const rooms = new Map();
    let stopped = false;

    function schedule(streamId, entry) {
        if (stopped || entry.timer || entry.sockets.size) return;
        entry.timer = setTimeout(async () => {
            entry.timer = null;
            try {
                const stream = await prisma.stream.findUnique({ where: { id: streamId }, select: { status: true } });
                if (stopped || entry.sockets.size) return;
                if (!stream || stream.status === 'ENDED') { rooms.delete(streamId); return; }
                const state = await controlStream(streamId, { id: entry.ownerId, role: 'USER' }, { action: 'END' });
                io.to(`stream:${streamId}`).emit('stream:state', state);
                io.emit('stream:ended', { streamId });
                io.emit('stream:list-changed');
                rooms.delete(streamId);
            } catch (error) {
                console.error('[socket] owner disconnected:', error);
                schedule(streamId, entry);
            }
        }, OWNER_RECONNECT_GRACE_MS);
        entry.timer.unref();
    }

    return {
        join(streamId, ownerId, socketId) {
            if (stopped) return;
            const entry = rooms.get(streamId) ?? { ownerId, sockets: new Set(), timer: null };
            clearTimeout(entry.timer);
            entry.timer = null;
            entry.sockets.add(socketId);
            rooms.set(streamId, entry);
        },
        leave(streamId, socketId) {
            const entry = rooms.get(streamId);
            if (!entry || !entry.sockets.delete(socketId)) return;
            schedule(streamId, entry);
        },
        stop() {
            stopped = true;
            for (const entry of rooms.values()) clearTimeout(entry.timer);
            rooms.clear();
        },
    };
}
