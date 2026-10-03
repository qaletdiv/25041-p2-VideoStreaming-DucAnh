'use client';
import Link from 'next/link';
import { AppBar, Toolbar, Typography, Button, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

export default function AppHeader({ onMenuClick }) {
    return (
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
            <Toolbar>
                <IconButton
                    color="inherit"
                    edge="start"
                    aria-label="menu"
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
                <Button color="inherit" component={Link} href="/login">
                    Đăng nhập
                </Button>
            </Toolbar>
        </AppBar>
    );
}