import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/session';
import LoginForm from '@/components/auth/LoginForm';

export default async function LoginPage({ params }) {
    const { locale } = await params;

    // Đã đăng nhập thì không cần thấy form đăng nhập nữa
    const user = await getCurrentUser();
    if (user) {
        redirect({ href: '/', locale });
    }

    return <LoginForm />;
}