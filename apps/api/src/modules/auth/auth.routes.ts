import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@silt/shared';
import { createRoutes } from '../../lib/route';
import { authLimiter } from '../../middleware/security';
import * as auth from './auth.service';
import { destroySession } from './session.service';

export const authRouter = Router();
authRouter.use(['/login', '/register', '/forgot-password', '/reset-password', '/resend-verification'], authLimiter);
const r = createRoutes(authRouter, '/auth', 'Авторизация');

r.get('/me', { summary: 'Текущий пользователь (null для гостя). Выдаёт CSRF-cookie' }, ({ req }) => ({ user: req.user ?? null }));

r.post('/register', { summary: 'Регистрация', body: registerSchema, status: 201 }, async ({ req, res, body }) => ({
  user: await auth.register(req, res, body),
}));

r.post('/login', { summary: 'Вход', body: loginSchema }, async ({ req, res, body }) => ({
  user: await auth.login(req, res, body),
}));

r.post('/logout', { summary: 'Выход' }, async ({ req, res }) => {
  await destroySession(req, res);
  return { ok: true };
});

r.post('/verify-email', { summary: 'Подтверждение email по токену из письма', body: verifyEmailSchema }, async ({ body }) => {
  await auth.verifyEmail(body.token);
  return { ok: true };
});

r.post('/resend-verification', { summary: 'Повторно отправить письмо подтверждения', auth: 'user' }, async ({ req }) => {
  await auth.sendVerification(req.user!.id);
  return { ok: true };
});

r.post('/forgot-password', { summary: 'Запрос ссылки для сброса пароля', body: forgotPasswordSchema }, async ({ body }) => {
  await auth.forgotPassword(body.email);
  return { ok: true };
});

r.post('/reset-password', { summary: 'Новый пароль по токену', body: resetPasswordSchema }, async ({ body }) => {
  await auth.resetPassword(body.token, body.password);
  return { ok: true };
});

r.post('/change-password', { summary: 'Смена пароля (остальные сессии завершаются)', body: changePasswordSchema, auth: 'user' }, async ({ req, body }) => {
  await auth.changePassword(req.user!.id, req.sessionId, body.currentPassword, body.newPassword);
  return { ok: true };
});
