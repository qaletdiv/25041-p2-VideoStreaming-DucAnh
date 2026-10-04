'use client';
import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { LOCALES } from '@/i18n/config';
import { setLocale } from '@/actions/locale';

export default function LanguageSwitcher() {
    const t = useTranslations('header');
    const locale = useLocale();
    const [isPending, startTransition] = useTransition();

    const handleChange = (event, newLocale) => {
        // newLocale là null khi bấm lại nút đang chọn; đang chờ server cũng bỏ qua
        if (newLocale === null || newLocale === locale || isPending) return;

        startTransition(async () => {
            await setLocale(newLocale);
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
            {LOCALES.map((l) => (
                <ToggleButton key={l} value={l}>
                    {l.toUpperCase()}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}