import { getTranslations } from 'next-intl/server';
import { Box, Typography } from '@mui/material';
import VideoGrid from '@/components/VideoGrid';
import { serverApiGet } from '@/lib/api.server';

// Giá trị sắp xếp hợp lệ (giống schema backend)
const SORTS = ['newest', 'oldest', 'popular'];
const PAGE_SIZE = 12;

export default async function HomePage({ searchParams }) {
    const t = await getTranslations('home');
    const params = await searchParams;

    // Chuẩn hóa tham số từ URL (giống schema backend, bỏ giá trị lạ)
    const q = typeof params.q === 'string' && params.q.trim() ? params.q.trim().slice(0, 100) : undefined;
    const category = typeof params.category === 'string' && params.category.trim() ? params.category.trim().slice(0, 100) : undefined;
    const sort = SORTS.includes(params.sort) ? params.sort : 'newest';
    const page = Math.max(parseInt(params.page, 10) || 1, 1);

    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (category) query.set('category', category);
    query.set('sort', sort);
    query.set('page', String(page));
    query.set('limit', String(PAGE_SIZE));

    // SSR trang đầu; backend lỗi thì trả null -> grid rỗng, trang không sập
    const { ok, data } = await serverApiGet(`/videos?${query.toString()}`);
    const categoriesResponse = await serverApiGet('/categories');

    return (
        <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
                {t('title')}
            </Typography>
            <VideoGrid
                initialData={ok ? data : { videos: [], total: 0, page, limit: PAGE_SIZE, totalPages: 0 }}
                categories={categoriesResponse.ok ? categoriesResponse.data.categories : []}
            />
        </Box>
    );
}
