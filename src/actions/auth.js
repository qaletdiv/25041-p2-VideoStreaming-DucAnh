'use server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';
import { loginSchema, registerSchema } from '@/lib/validations/auth';

// Mã băm giả: để thời gian phản hồi như nhau dù email có tồn tại hay không
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

export async function registerUser(values) {
    // Không tin dữ liệu từ client: kiểm tra lại bằng cùng schema
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
        return { errors: z.flattenError(parsed.error).fieldErrors };
    }

    const { name, email, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
        await prisma.user.create({ data: { name, email, passwordHash } });
    } catch (error) {
        // P2002: vi phạm ràng buộc @unique (email đã tồn tại)
        if (error.code === 'P2002') {
            return { errors: { email: ['emailTaken'] } };
        }
        console.error('[register]', error);
        return { errors: { form: ['serverError'] } };
    }

    return { success: true };
}

export async function loginUser(values) {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
        return { errors: z.flattenError(parsed.error).fieldErrors };
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Luôn chạy bcrypt.compare, kể cả khi không có user
    const isPasswordValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !isPasswordValid) {
        return { errors: { form: ['invalidCredentials'] } };
    }

    // Chỉ báo "bị khóa" sau khi mật khẩu đã đúng, tránh lộ thông tin cho người lạ
    if (!user.isActive) {
        return { errors: { form: ['accountLocked'] } };
    }

    await createSession(user);
    revalidatePath('/', 'layout');

    return { success: true };
}