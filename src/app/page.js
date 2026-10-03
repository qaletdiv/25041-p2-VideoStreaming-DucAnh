import { Button, Typography } from '@mui/material';

export default function HomePage() {
    return (
        <main style={{ padding: 24 }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                StreamHub
            </Typography>
            <Button variant="contained">Nút thử MUI</Button>
        </main>
    );
}