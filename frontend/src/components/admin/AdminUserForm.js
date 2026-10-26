'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { apiFetch } from '@/lib/api';
import { createAdminUserSchema, updateAdminUserSchema } from '@/lib/validations/adminUser';

export default function AdminUserForm({ user, onClose, onSaved }) {
    const t = useTranslations('adminUsers');
    const [busy, setBusy] = useState(false);
    const [fields, setFields] = useState({});
    const [error, setError] = useState(null);
    const editing = Boolean(user);
    const fieldError = (name) => {
        const key = fields[name]?.[0];
        return key ? t(t.has(`validation.${key}`) ? `validation.${key}` : 'errors.invalid') : undefined;
    };

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        const values = Object.fromEntries(new FormData(event.currentTarget));
        if (editing && !values.password) delete values.password;
        const parsed = (editing ? updateAdminUserSchema : createAdminUserSchema).safeParse(values);
        setFields({});
        setError(null);
        if (!parsed.success) {
            const errors = {};
            for (const issue of parsed.error.issues) errors[issue.path[0]] ??= [issue.message];
            setFields(errors);
            return;
        }
        setBusy(true);
        const response = await apiFetch(editing ? `/admin/users/${encodeURIComponent(user.id)}` : '/admin/users', {
            method: editing ? 'PATCH' : 'POST', body: parsed.data,
        });
        setBusy(false);
        if (!response.ok) {
            setFields(response.data?.error?.fields ?? {});
            setError(response.status === 401 || response.status === 403 ? 'forbidden' : response.data?.error?.code === 'EMAIL_TAKEN' ? 'emailTaken' : 'failed');
            return;
        }
        onSaved(editing ? 'updated' : 'created');
    }

    return <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm">
        <DialogTitle>{t(editing ? 'edit' : 'add')}</DialogTitle>
        <form onSubmit={submit} noValidate>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {error && <Alert severity="error">{t(`errors.${error}`)}</Alert>}
                    {['name', 'email', 'password'].map((name) => <TextField key={name} name={name}
                        label={t(name === 'password' && editing ? 'newPassword' : name)}
                        type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'}
                        defaultValue={name === 'password' ? '' : user?.[name] ?? ''}
                        required={name !== 'password' || !editing} disabled={busy}
                        autoComplete={name === 'password' ? 'new-password' : 'off'}
                        error={Boolean(fields[name])} helperText={fieldError(name) || (name === 'password' && editing ? t('passwordHint') : undefined)} />)}
                    {!editing && <TextField select name="role" label={t('role')} defaultValue="USER" disabled={busy}>
                        {['USER', 'ADMIN'].map((role) => <MenuItem key={role} value={role}>{t(`roles.${role}`)}</MenuItem>)}
                    </TextField>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button disabled={busy} onClick={onClose}>{t('cancel')}</Button>
                <Button disabled={busy} type="submit" variant="contained">{t('save')}</Button>
            </DialogActions>
        </form>
    </Dialog>;
}
