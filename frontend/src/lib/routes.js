// Các trang bắt buộc đăng nhập (đường dẫn KHÔNG có tiền tố ngôn ngữ)
const PROTECTED_PREFIXES = ['/dashboard', '/stream/create', '/admin'];

export function isProtectedPath(path) {
    return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}