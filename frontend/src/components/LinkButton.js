'use client';
import { Button } from '@mui/material';
import { Link } from '@/i18n/navigation';

export default function LinkButton({ href, children, ...props }) {
    return (
        <Button component={Link} href={href} {...props}>
            {children}
        </Button>
    );
}