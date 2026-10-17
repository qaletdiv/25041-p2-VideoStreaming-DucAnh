import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';

const userSelect = { id: true, name: true, email: true, role: true, isActive: true, createdAt: true };

export async function listUsers({ page, limit, search, status }) {
    const where = {
        ...(status === 'all' ? {} : { isActive: status === 'active' }),
        ...(search ? { OR: ['name', 'email'].map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })) } : {}),
    };
    const [users, total] = await prisma.$transaction([
        prisma.user.findMany({ where, select: userSelect, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
        prisma.user.count({ where }),
    ]);
    return { users, total, page, totalPages: Math.ceil(total / limit) };
}

export async function updateUserStatus(id, actor, isActive) {
    const target = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    if (id === actor.id || target.role === 'ADMIN') {
        throw new HttpError(403, 'USER_PROTECTED', 'Admin accounts cannot be changed here');
    }
    return prisma.user.update({ where: { id }, data: { isActive }, select: userSelect });
}

