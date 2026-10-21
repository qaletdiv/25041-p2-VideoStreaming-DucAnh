import { requireUser } from '@/lib/guards';
import StreamStatistics from '@/components/dashboard/StreamStatistics';

export default async function StatisticsPage({ searchParams }) {
    const user = await requireUser();
    const query = await searchParams;
    const ownerId = typeof query.ownerId === 'string' ? query.ownerId : '';
    return <StreamStatistics key={ownerId} ownerId={ownerId} isAdmin={user.role === 'ADMIN'} />;
}
