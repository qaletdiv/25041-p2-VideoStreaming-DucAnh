'use client';
import { useState } from 'react';
import { Box, Toolbar } from '@mui/material';
import AppHeader from './AppHeader';
import AppSidebar from './AppSidebar';

export default function AppShell({ children, user }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex' }}>
      <AppHeader user={user} onMenuClick={() => setMobileOpen(true)} />
      <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}