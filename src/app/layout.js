import { Roboto } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppShell from '@/components/AppShell';
import theme from '@/theme';

const roboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin', 'vietnamese'],
    display: 'swap',
    variable: '--font-roboto',
});

export const metadata = {
    title: 'StreamHub',
    description: 'Hệ thống Video Streaming & Live Interaction',
};

export default function RootLayout({ children }) {
    return (
        <html lang="vi" className={roboto.variable}>
            <body>
                <AppRouterCacheProvider>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <AppShell>{children}</AppShell>
                    </ThemeProvider>
                </AppRouterCacheProvider>
            </body>
        </html>
    );
}