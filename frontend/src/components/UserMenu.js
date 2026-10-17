'use client';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
    Alert, Avatar, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Snackbar, Typography,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useRouter } from '@/i18n/navigation';
import { apiFetch } from '@/lib/api';

export default function UserMenu({ user }) {
    const t = useTranslations('header');
    const router = useRouter();
    const [anchorEl, setAnchorEl] = useState(null);
    const [isPending, startTransition] = useTransition();
    const [logoutError, setLogoutError] = useState(false);

    const handleClose = () => setAnchorEl(null);

    const handleLogout = () => {
        handleClose();
        setLogoutError(false);
        startTransition(async () => {
            const result = await apiFetch('/auth/logout', { method: 'post' });
            if (!result.ok) {
                setLogoutError(true);
                return;
            }
            router.replace('/');
            router.refresh();
        });
    };

    return (
        <>
            <IconButton
                onClick={(event) => setAnchorEl(event.currentTarget)}
                aria-label={t('account')}
                size="small"
            >
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main' }}>
                    {user.name.charAt(0).toUpperCase()}
                </Avatar>
            </IconButton>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle2">{user.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {user.email}
                    </Typography>
                </Box>
                <Divider />
                <MenuItem onClick={handleLogout} disabled={isPending}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    {t('logout')}
                </MenuItem>
            </Menu>
            <Snackbar open={logoutError} onClose={() => setLogoutError(false)}>
                <Alert severity="error" onClose={() => setLogoutError(false)}>{t('logoutFailed')}</Alert>
            </Snackbar>
        </>
    );
}
