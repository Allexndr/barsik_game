import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin identity authorization integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
    vi.stubEnv('SUPABASE_ADMIN_EMAILS', 'owner@example.com');
    vi.stubEnv('ADMIN_ALLOW_LEGACY_TOKEN', 'false');
    vi.stubEnv('ADMIN_TOKEN', 'legacy-test-token');
    vi.stubEnv('ADMIN_USERNAME', 'owner');
    vi.stubEnv('ADMIN_PASSWORD', 'a-long-test-password');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'a-test-only-signing-secret-with-enough-entropy');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('accepts a Supabase identity with an admin role', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'user-1',
      email: 'operator@example.com',
      app_metadata: { role: 'admin' },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { guard } = await import('../../api/admin/_lib');
    const result = await guard({ headers: { authorization: 'Bearer user-token' } });

    expect(result).toEqual({ ok: true, actor: 'operator@example.com' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://supabase.test/auth/v1/user',
      { headers: {
        apikey: 'service-role-test-key',
        Authorization: 'Bearer user-token',
      } },
    );
  });

  it('rejects a valid Supabase identity without admin privileges', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'user-2',
      email: 'player@example.com',
      app_metadata: {},
    }), { status: 200 })));

    const { guard } = await import('../../api/admin/_lib');
    await expect(guard({ headers: { authorization: 'Bearer player-token' } }))
      .resolves.toEqual({ ok: false, status: 403, error: 'Недостаточно прав' });
  });

  it('does not fall back to the legacy token when migration mode is off', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { guard } = await import('../../api/admin/_lib');
    await expect(guard({ headers: { 'x-admin-token': 'legacy-test-token' } }))
      .resolves.toEqual({ ok: false, status: 401, error: 'Требуется авторизация администратора' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authenticates the configured username and password, then accepts the signed session', async () => {
    const { default: login } = await import('../../api/admin/login');
    const { guard } = await import('../../api/admin/_lib');
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await login({
      method: 'POST',
      headers: {},
      body: { username: 'owner', password: 'a-long-test-password' },
    }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const session = res.json.mock.calls[0][0] as { token: string; actor: string };
    expect(session.actor).toBe('owner');
    await expect(guard({ headers: { authorization: `Bearer ${session.token}` } }))
      .resolves.toEqual({ ok: true, actor: 'owner' });
  });

  it('rejects an incorrect password without issuing a session', async () => {
    const { default: login } = await import('../../api/admin/login');
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };

    await login({
      method: 'POST',
      headers: {},
      body: { username: 'owner', password: 'wrong-password' },
    }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Неверный логин или пароль' });
  });
});
