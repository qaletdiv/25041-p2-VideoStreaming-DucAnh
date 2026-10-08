const required = ['DATABASE_URL', 'REDIS_URL', 'CLIENT_ORIGIN', 'JWT_SECRET'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
    throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
}

if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET phải dài ít nhất 32 ký tự');
}

export const env = {
    isProduction: process.env.NODE_ENV === 'production',
    port: Number(process.env.PORT) || 4000,
    redisUrl: process.env.REDIS_URL,
    clientOrigins: process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()),
    jwtSecret: process.env.JWT_SECRET,
};