'use client';
import { Link } from '@/i18n/navigation';
import { AppBar, Toolbar, Typography, Button, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';

export default function AppHeader({ onMenuClick }) {
    const t = useTranslations('header');
    return (
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <Toolbar>
                <IconButton
                    color="inherit"
                    edge="start"
                    aria-label={t('menu')}
                    onClick={onMenuClick}
                    sx={{ mr: 1, display: { md: 'none' } }}
                >
                    <MenuIcon />
                </IconButton>
                <Typography
                    variant="h6"
                    component={Link}
                    href="/"
                    sx={{ flexGrow: 1, color: 'inherit', textDecoration: 'none', fontWeight: 700 }}
                >
                    StreamHub
                </Typography>
                <LanguageSwitcher />
                <Button color="inherit" component={Link} href="/login">
                    {t('login')}
                </Button>
            </Toolbar>
        </AppBar>
    );
}