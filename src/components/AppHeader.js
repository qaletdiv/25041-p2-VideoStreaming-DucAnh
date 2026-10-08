'use client';
import { useTranslations } from 'next-intl';
import { AppBar, Toolbar, Typography, Button, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Link } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';

export default function AppHeader({ user, onMenuClick }) {
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

                {user ? (
                    <UserMenu user={user} />
                ) : (
                    <>
                        <Button color="inherit" component={Link} href="/login">
                            {t('login')}
                        </Button>
                        <Button
                            color="inherit"
                            variant="outlined"
                            component={Link}
                            href="/register"
                            sx={{ ml: 1, display: { xs: 'none', sm: 'inline-flex' } }}
                        >
                            {t('register')}
                        </Button>
                    </>
                )}
            </Toolbar>
        </AppBar>
    );
}