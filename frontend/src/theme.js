'use client';
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: { main: '#6c4cf1' },
        secondary: { main: '#ff4d6d' },
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: 'var(--font-roboto), Roboto, Arial, sans-serif',
        button: { textTransform: 'none', fontWeight: 600 },
    },
});

export default theme;