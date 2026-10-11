import { requireUser } from '@/lib/guards';
import { serverApiGet } from '@/lib/api.server';
import VideoUploadForm from '@/components/upload/VideoUploadForm';

export default async function UploadVideoPage() {
    await requireUser();

    // Lấy danh mục cho dropdown; backend lỗi thì trả mảng rỗng
    const { ok, data } = await serverApiGet('/categories');
    const categories = ok ? data.categories : [];

    return <VideoUploadForm categories={categories} />;
}
