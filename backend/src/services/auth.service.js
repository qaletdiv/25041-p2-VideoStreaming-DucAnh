import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/httpError.js';

// Mã băm giả: để thời gian phản hồi như nhau dù email có tồn tại hay không
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

const publicUserSelect = { id: true, name: true, email: true, role: true };

export async function registerUser({ name, email, password }) {
    const passwordHash = await bcrypt.hash(password, 10);

    try {
        return await prisma.user.create({
            data: { name, email, passwordHash },
            select: publicUserSelect,
        });
    } catch (error) {
        // P2002: vi phạm ràng buộc @unique (email đã tồn tại)
        if (error.code === 'P2002') {
            throw new HttpError(409, 'EMAIL_TAKEN', 'Email is already registered', {
                email: ['emailTaken'],
            });
        }
        throw error;
    }
}

export async function authenticateUser({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email } });

    // Luôn chạy bcrypt.compare, kể cả khi không có user
    const isPasswordValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !isPasswordValid) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
    }

    // Chỉ báo "bị khóa" sau khi mật khẩu đã đúng, tránh lộ thông tin cho người lạ
    if (!user.isActive) {
        throw new HttpError(403, 'ACCOUNT_LOCKED', 'Account is locked');
    }

    return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// Dùng cho middleware authenticate: tài khoản phải còn tồn tại và chưa bị khóa
export async function findActiveUserById(id) {
    const user = await prisma.user.findUnique({
        where: { id },
        select: { ...publicUserSelect, isActive: true },
    });

    if (!user || !user.isActive) return null;

    const { isActive, ...publicUser } = user;
    return publicUser;
}