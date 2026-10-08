import { signToken } from '../lib/jwt.js';
import { setSessionCookie, clearSessionCookie } from '../lib/sessionCookie.js';
import * as authService from '../services/auth.service.js';

export async function register(req, res) {
    const user = await authService.registerUser(req.body);
    res.status(201).json({ user });
}

export async function login(req, res) {
    const user = await authService.authenticateUser(req.body);
    const token = await signToken({ userId: user.id, role: user.role });

    setSessionCookie(res, token);
    res.json({ user });
}

export function logout(req, res) {
    clearSessionCookie(res);
    res.status(204).end();
}

export function me(req, res) {
    res.json({ user: req.user });
}