import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, client, login, prisma, seedFixtures } from './helpers';

describe('auth', () => {
  beforeAll(seedFixtures);

  it('registers, stores an Argon2id hash and starts a session', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/register', {
      email: 'New@Test.dev',
      password: 'Secret12345',
      firstName: 'Новый',
      acceptTerms: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@test.dev');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new@test.dev' } });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(user.passwordHash).not.toContain('Secret12345');
    const me = await c.get('/api/v1/auth/me');
    expect(me.body.user.email).toBe('new@test.dev');
    // A verification email is queued.
    expect(await prisma.emailJob.count({ where: { to: 'new@test.dev', template: 'verify_email' } })).toBe(1);
  });

  it('sets the session cookie as httpOnly and stores only a token hash', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/login', { email: 'customer@test.dev', password: 'Password123' });
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((x) => x.startsWith('silt_sid='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const token = cookie.split(';')[0].split('=')[1];
    expect(await prisma.session.count({ where: { tokenHash: token } })).toBe(0);
  });

  it('rejects wrong password and duplicate email', async () => {
    const c = await client();
    expect((await c.post('/api/v1/auth/login', { email: 'customer@test.dev', password: 'nope' })).status).toBe(401);
    const dup = await c.post('/api/v1/auth/register', { email: 'customer@test.dev', password: 'Secret12345', firstName: 'X', acceptTerms: true });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates input with a single error format', async () => {
    const c = await client();
    const res = await c.post('/api/v1/auth/register', { email: 'bad', password: '1', firstName: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('requires a CSRF token for state-changing requests', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'customer@test.dev', password: 'Password123' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('logs out and invalidates the session', async () => {
    const c = await login('customer@test.dev');
    expect((await c.post('/api/v1/auth/logout')).status).toBe(200);
    expect((await c.get('/api/v1/auth/me')).body.user).toBeNull();
  });

  it('blocked users cannot log in and lose existing sessions', async () => {
    const c = await login('customer@test.dev');
    await prisma.user.update({ where: { email: 'customer@test.dev' }, data: { isBlocked: true } });
    expect((await c.get('/api/v1/auth/me')).body.user).toBeNull();
    const c2 = await client();
    expect((await c2.post('/api/v1/auth/login', { email: 'customer@test.dev', password: 'Password123' })).status).toBe(403);
    await prisma.user.update({ where: { email: 'customer@test.dev' }, data: { isBlocked: false } });
  });

  it('password reset: same answer for unknown email, token is single-use', async () => {
    const c = await client();
    expect((await c.post('/api/v1/auth/forgot-password', { email: 'nobody@test.dev' })).body).toEqual({ ok: true });
    expect((await c.post('/api/v1/auth/forgot-password', { email: 'customer@test.dev' })).body).toEqual({ ok: true });
    const job = await prisma.emailJob.findFirstOrThrow({ where: { template: 'password_reset' }, orderBy: { createdAt: 'desc' } });
    const token = new URL((job.payload as { url: string }).url).searchParams.get('token')!;
    expect((await c.post('/api/v1/auth/reset-password', { token, password: 'NewPass12345' })).status).toBe(200);
    expect((await c.post('/api/v1/auth/reset-password', { token, password: 'NewPass12345' })).status).toBe(400);
    await login('customer@test.dev', 'NewPass12345');
  });
});
