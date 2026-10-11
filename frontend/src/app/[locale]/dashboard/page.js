import { requireUser } from '@/lib/guards';
import MyVideoList from '@/components/dashboard/MyVideoList';

export default async function DashboardPage() {
    await requireUser();

    return <MyVideoList />;
}