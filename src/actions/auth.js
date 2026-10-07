'use server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validations/auth';

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