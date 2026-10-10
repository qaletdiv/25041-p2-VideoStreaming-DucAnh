'use client';
import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { routing } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

export default function LanguageSwitcher() {
    const t = useTranslations('header');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleChange = (event, newLocale) => {
        // newLocale là null khi bấm lại nút đang chọn; đang chuyển trang cũng bỏ qua
        if (newLocale === null || newLocale === locale || isPending) return;

        startTransition(() => {
            // Giữ query string khi đổi ngôn ngữ (trạng thái lọc/trang đang nằm trên URL)
            const query = searchParams.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { locale: newLocale });
        });
    };

    return (
        <ToggleButtonGroup
            exclusive
            size="small"
            value={locale}
            onChange={handleChange}
            aria-label={t('switchLanguage')}
            sx={{
                mr: 1,
                '& .MuiToggleButton-root': {
                    color: 'primary.contrastText',
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                    px: 1.5,
                    fontWeight: 600,
                },
                '& .MuiToggleButton-root.Mui-selected': {
                    bgcolor: 'common.white',
                    color: 'primary.main',
                },
                '& .MuiToggleButton-root.Mui-selected:hover': {
                    bgcolor: 'grey.200',
                },
            }}
        >
            {routing.locales.map((l) => (
                <ToggleButton key={l} value={l}>
                    {l.toUpperCase()}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}