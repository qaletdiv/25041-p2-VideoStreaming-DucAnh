'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
    { label: 'Trang chủ', href: '/', icon: <HomeIcon /> },
    { label: 'Tạo Stream', href: '/stream/create', icon: <LiveTvIcon /> },
    { label: 'Dashboard', href: '/dashboard', icon: <DashboardIcon /> },
    { label: 'Quản lý người dùng', href: '/admin/users', icon: <PeopleIcon /> },
];

export default function AppSidebar({ mobileOpen, onClose }) {
    const pathname = usePathname();

    const content = (
        <Box>
            <Toolbar />
            <List>
                {NAV_ITEMS.map((item) => (
                    <ListItemButton
                        key={item.href}
                        component={Link}
                        href={item.href}
                        selected={pathname === item.href}
                        onClick={onClose}
                    >
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItemButton>
                ))}
            </List>
        </Box>
    );

    return (
        <>
            {/* Mobile: trượt ra khi bấm nút ☰ */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={onClose}
                ModalProps={{ keepMounted: true }}
                sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
            >
                {content}
            </Drawer>

            {/* Desktop: luôn hiện bên trái */}
            <Drawer
                variant="permanent"
                open
                sx={{
                    display: { xs: 'none', md: 'block' },
                    width: DRAWER_WIDTH,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
                }}
            >
                {content}
            </Drawer>
        </>
    );
}