'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    Box, CircularProgress, FormControl, Grid, IconButton, InputAdornment,
    InputLabel, MenuItem, Select, TextField, Toolbar, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';
import VideoCard from '@/components/VideoCard';

const SORTS = ['newest', 'oldest', 'popular'];

export default function VideoGrid({ initialData, categories }) {
    const t = useTranslations('home');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [data, setData] = useState(initialData);
    const [isLoading, setIsLoading] = useState(false);
    // Key URL lúc SSR: tránh gọi lại API khi vừa vào trang (đã có dữ liệu SSR)
    const ssrParamsKey = useRef(searchParams.toString());

    // URL là nguồn sự thật: URL thay đổi -> lấy lại dữ liệu (kể cả dán URL thủ công)
    useEffect(() => {
        const key = searchParams.toString();
        if (key === ssrParamsKey.current) return;

        let ignore = false;
        setIsLoading(true);
        apiFetch(`/videos?${key}`)
            .then(({ ok, data }) => {
                if (!ignore && ok) setData(data);
            })
            .finally(() => {
                if (!ignore) setIsLoading(false);
            });
        return () => {
            ignore = true;
        };
    }, [searchParams]);

    // Mọi thay đổi lọc đều đẩy vào URL (state nằm trên URL, không trong component)
    const updateParams = (changes) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(changes).forEach(([key, value]) => {
            if (value) params.set(key, value);
            else params.delete(key);
        });
        params.delete('page'); // đổi lọc/sắp xếp -> về trang 1
        router.push(`${pathname}?${params.toString()}`);
    };

    const gotoPage = (target) => {
        const params = new URLSearchParams(searchParams);
        if (target <= 1) params.delete('page');
        else params.set('page', String(target));
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleSearch = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        updateParams({ q: (formData.get('search') ?? '').toString().trim() });
    };

    const currentSort = SORTS.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest';
    const currentCategory = searchParams.get('category') ?? '';
    const searchValue = searchParams.get('q') ?? '';

    return (
        <Box>
            <Toolbar disableGutters sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Box component="form" onSubmit={handleSearch} sx={{ flexGrow: 1, minWidth: 220 }}>
                    <TextField
                        name="search"
                        size="small"
                        fullWidth
                        defaultValue={searchValue}
                        placeholder={t('searchPlaceholder')}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                </Box>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel id="category-label">{t('categoryAll')}</InputLabel>
                    <Select
                        labelId="category-label"
                        value={currentCategory}
                        label={t('categoryAll')}
                        onChange={(event) => updateParams({ category: event.target.value })}
                    >
                        <MenuItem value=""><em>{t('categoryAll')}</em></MenuItem>
                        {categories.map((category) => (
                            <MenuItem key={category.id} value={category.slug}>{category.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id="sort-label">{t('sortLabel')}</InputLabel>
                    <Select
                        labelId="sort-label"
                        value={currentSort}
                        label={t('sortLabel')}
                        onChange={(event) => updateParams({ sort: event.target.value })}
                    >
                        <MenuItem value="newest">{t('sortNewest')}</MenuItem>
                        <MenuItem value="oldest">{t('sortOldest')}</MenuItem>
                        <MenuItem value="popular">{t('sortPopular')}</MenuItem>
                    </Select>
                </FormControl>
            </Toolbar>

            {isLoading && <CircularProgress size={24} sx={{ mb: 1 }} />}

            {data.videos.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                    {t('noVideos')}
                </Typography>
            ) : (
                <Grid container spacing={2}>
                    {data.videos.map((video) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={video.id}>
                            <VideoCard video={video} />
                        </Grid>
                    ))}
                </Grid>
            )}

            {data.totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3 }}>
                    <IconButton onClick={() => gotoPage(data.page - 1)} disabled={data.page <= 1} aria-label={t('previous')}>
                        <ChevronLeftIcon />
                    </IconButton>
                    <Typography>{t('pageInfo', { current: data.page, total: data.totalPages })}</Typography>
                    <IconButton onClick={() => gotoPage(data.page + 1)} disabled={data.page >= data.totalPages} aria-label={t('next')}>
                        <ChevronRightIcon />
                    </IconButton>
                </Box>
            )}
        </Box>
    );
}
