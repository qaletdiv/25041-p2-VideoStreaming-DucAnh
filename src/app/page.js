import { Button, Typography } from '@mui/material';

export default function HomePage() {
    return (
        <div>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                StreamHub
            </Typography>
            <Button variant="contained">Nút thử MUI</Button>
        </div>
    );
}