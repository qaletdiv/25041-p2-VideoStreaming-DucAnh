import { requireUser } from '@/lib/guards';
import { serverApiGet } from '@/lib/api.server';
import CreateStreamForm from '@/components/stream/CreateStreamForm';

export default async function CreateStreamPage() {
    const user = await requireUser();
    const path = user.role === 'ADMIN' ? '/videos?limit=100' : '/videos/mine?limit=100';
    const { ok, data } = await serverApiGet(path);
    const videos = ok ? data.videos.filter((video) => video.status === 'READY' || user.role === 'ADMIN') : [];

    return <CreateStreamForm videos={videos} />;
}
