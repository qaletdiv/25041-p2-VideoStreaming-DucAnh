import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { getStream } from './stream.service.js';
import { withStreamControlLock } from './streamState.service.js';

const select = {
    id: true, streamId: true, amount: true, message: true, createdAt: true,
    user: { select: { name: true } },
};

export async function listDonations(streamId, user, { page, limit }) {
    await getStream(streamId, user);
    const where = { streamId };
    const [donations, total] = await prisma.$transaction([
        prisma.donation.findMany({ where, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
        prisma.donation.count({ where }),
    ]);
    return { donations, total, page, totalPages: Math.ceil(total / limit) };
}

export async function createDonation(streamId, user, input) {
    // Dùng chung khóa điều khiển để không ghi donate sau khi phòng đã kết thúc.
    const result = await withStreamControlLock(streamId, async () => {
        const existing = await prisma.donation.findUnique({
            where: { userId_requestId: { userId: user.id, requestId: input.requestId } },
            select,
        });
        if (existing) {
            if (existing.streamId !== streamId || existing.amount !== input.amount || existing.message !== input.message) {
                throw new HttpError(409, 'DONATION_CONFLICT', 'Request ID already used');
            }
            return { donation: existing, created: false };
        }
        const { stream, state } = await getStream(streamId, user);
        if (stream.status === 'ENDED' || state?.status === 'ENDED') {
            throw new HttpError(409, 'STREAM_ENDED', 'Stream has ended');
        }
        const donation = await prisma.donation.create({
            data: { ...input, streamId, userId: user.id }, select,
        });
        return { donation, created: true };
    });
    if (!result) throw new HttpError(409, 'STREAM_BUSY', 'Stream is busy');
    return result;
}
