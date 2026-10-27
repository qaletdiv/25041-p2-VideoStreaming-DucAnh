import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';
import bcrypt from 'bcryptjs';

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

async function adminTransaction(actor, operation) {
    try {
        return await prisma.$transaction(async (tx) => {
            // Tuần tự hóa thao tác quản trị và kiểm tra lại quyền sau khi chờ khóa.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(73240017)`;
            const current = await tx.user.findUnique({ where: { id: actor.id } });
            if (!current?.isActive || current.sessionVersion !== actor.sessionVersion) {
                throw new HttpError(401, 'UNAUTHENTICATED', 'Session is no longer valid');
            }
            if (current.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', 'Admin required');
            return operation(tx);
        }, { maxWait: 10000, timeout: 10000 });
    } catch (error) {
        if (error.code === 'P2002') throw new HttpError(409, 'EMAIL_TAKEN', 'Email is already registered', { email: ['emailTaken'] });
        throw error;
    }
}

async function targetUser(tx, id) {
    const target = await tx.user.findUnique({ where: { id }, select: userSelect });
    if (!target) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    return target;
}

async function protectAdmin(tx, target, actor, removesAdmin) {
    if (!removesAdmin) return;
    if (target.id === actor.id) throw new HttpError(403, 'USER_PROTECTED', 'Cannot lock or demote yourself');
    if (target.role === 'ADMIN' && target.isActive
        && await tx.user.count({ where: { role: 'ADMIN', isActive: true } }) <= 1) {
        throw new HttpError(409, 'LAST_ACTIVE_ADMIN', 'An active admin must remain');
    }
}

export async function createUser(actor, { name, email, password, role }) {
    const passwordHash = await bcrypt.hash(password, 10);
    return adminTransaction(actor, (tx) => tx.user.create({ data: { name, email, passwordHash, role }, select: userSelect }));
}

export async function updateUser(id, actor, { name, email, password }) {
    const passwordHash = password === undefined ? undefined : await bcrypt.hash(password, 10);
    return adminTransaction(actor, async (tx) => {
        await targetUser(tx, id);
        return tx.user.update({ where: { id }, data: {
            name, email,
            ...(passwordHash ? { passwordHash, sessionVersion: { increment: 1 } } : {}),
        }, select: userSelect });
    });
}

export async function updateUserRole(id, actor, role) {
    return adminTransaction(actor, async (tx) => {
        const target = await targetUser(tx, id);
        await protectAdmin(tx, target, actor, target.role === 'ADMIN' && role !== 'ADMIN');
        return tx.user.update({ where: { id }, data: { role }, select: userSelect });
    });
}

export async function updateUserStatus(id, actor, isActive) {
    return adminTransaction(actor, async (tx) => {
        const target = await targetUser(tx, id);
        await protectAdmin(tx, target, actor, !isActive);
        return tx.user.update({ where: { id }, data: { isActive }, select: userSelect });
    });
}

