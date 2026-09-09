import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('admin identity authorization integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
    vi.stubEnv('SUPABASE_ADMIN_EMAILS', 'owner@example.com');
    vi.stubEnv('ADMIN_ALLOW_LEGACY_TOKEN', 'false');
    vi.stubEnv('ADMIN_TOKEN', 'legacy-test-token');
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
});
