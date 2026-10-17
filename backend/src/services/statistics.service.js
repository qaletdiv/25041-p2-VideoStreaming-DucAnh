import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';

export async function getStatistics(user, { ownerId, page, limit }) {
    if (user.role !== 'ADMIN' && ownerId && ownerId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Statistics are private');
    const selectedId = user.role === 'ADMIN' ? ownerId : user.id;
    const owner = selectedId ? await prisma.user.findUnique({ where: { id: selectedId }, select: { id: true, name: true } }) : null;
    if (selectedId && !owner) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    const where = selectedId ? { ownerId: selectedId } : {};
    const [total, active, donations, samples, streams] = await prisma.$transaction([
        prisma.stream.count({ where }),
        prisma.stream.count({ where: { ...where, status: { not: 'ENDED' } } }),
        prisma.donation.aggregate({ where: { stream: where }, _sum: { amount: true }, _count: true }),
        prisma.streamSample.aggregate({ where: { stream: where }, _max: { viewers: true }, _avg: { viewers: true }, _count: true }),
        prisma.stream.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit,
            select: { id: true, title: true, status: true, createdAt: true, startedAt: true, endedAt: true, owner: { select: { id: true, name: true } } } }),
    ]);
    return { owner, total, active, donationAmount: donations._sum.amount ?? 0, donationCount: donations._count,
        peakViewers: samples._max.viewers, averageViewers: samples._avg.viewers, sampleCount: samples._count,
        streams, page, totalPages: Math.ceil(total / limit) };
}

export async function getStreamStatistics(user, id) {
    const stream = await prisma.stream.findUnique({ where: { id }, select: { id: true, title: true, ownerId: true, startedAt: true, endedAt: true } });
    if (!stream) throw new HttpError(404, 'STREAM_NOT_FOUND', 'Stream not found');
    if (user.role !== 'ADMIN' && stream.ownerId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Statistics are private');
    const [donations, samples, recent] = await prisma.$transaction([
        prisma.donation.aggregate({ where: { streamId: id }, _sum: { amount: true }, _count: true }),
        prisma.streamSample.aggregate({ where: { streamId: id }, _max: { viewers: true }, _avg: { viewers: true }, _count: true }),
        prisma.streamSample.findMany({ where: { streamId: id }, orderBy: { ts: 'desc' }, take: 120, select: { ts: true, viewers: true } }),
    ]);
    return { stream, donationAmount: donations._sum.amount ?? 0, donationCount: donations._count,
        peakViewers: samples._max.viewers, averageViewers: samples._avg.viewers, sampleCount: samples._count, samples: recent.reverse() };
}
