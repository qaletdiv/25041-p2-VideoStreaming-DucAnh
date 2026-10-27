'use client';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

export default function AccountSessionSync({ user }) {
    const router = useRouter();
    const id = user?.id;
    const role = user?.role;
    const name = user?.name;
    const email = user?.email;

    useEffect(() => {
        if (!id) return;
        let active = true;
        let checking = false;
        let expired = false;
        const socket = io(new URL(process.env.NEXT_PUBLIC_API_URL).origin, { withCredentials: true });
        function expire() {
            if (!active || expired) return;
            expired = true;
            socket.disconnect();
            router.replace('/login');
            router.refresh();
        }
        async function reconcile() {
            if (!active || checking || expired) return;
            checking = true;
            const response = await apiFetch('/auth/me');
            checking = false;
            if (!active) return;
            if (response.status === 401 || response.status === 403) return expire();
            const latest = response.data?.user;
            if (response.ok && latest && (latest.id !== id || latest.role !== role || latest.name !== name || latest.email !== email)) router.refresh();
        }
        // Kiểm tra lại sau reconnect hoặc quay lại tab để bù sự kiện bị lỡ.
        socket.on('connect', reconcile);
        socket.on('connect_error', reconcile);
        socket.on('account:updated', reconcile);
        socket.on('account:session-expired', expire);
        socket.on('account:locked', expire);
        window.addEventListener('focus', reconcile);
        return () => {
            active = false;
            window.removeEventListener('focus', reconcile);
            socket.disconnect();
        };
    }, [id, role, name, email, router]);
    return null;
}
