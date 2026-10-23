import { requireUser } from '@/lib/guards';
import VideoStatistics from '@/components/dashboard/VideoStatistics';

export default async function StatisticsPage({ searchParams }) {
    const user = await requireUser();
    const query = await searchParams;
    const ownerId = typeof query.ownerId === 'string' ? query.ownerId : '';
    return <VideoStatistics key={ownerId} ownerId={ownerId} isAdmin={user.role === 'ADMIN'} />;
}
