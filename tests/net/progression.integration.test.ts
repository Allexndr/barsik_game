import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const canonical = {
  current_level: 2,
  unlocked_levels: [0, 1],
  level_stars: { '0': 10, '1': 15 },
  stars: 25,
  friend_ids: ['gardener'],
  season_complete: false,
};

describe('progression network integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('authenticates, submits a completion, and applies canonical server state', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-test-token',
        refresh_token: 'refresh-test-token',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(canonical), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { syncCompletedLevel } = await import('../../src/net/progression');
    const { useGameStore } = await import('../../src/store/useGameStore');

    await syncCompletedLevel(1, 15, 'gardener');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/auth/v1/signup',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://supabase.test/rest/v1/rpc/barsik_complete_level',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-test-token',
          apikey: 'anon-test-key',
        }),
        body: JSON.stringify({ p_level_id: 1, p_stars: 15, p_friend_id: 'gardener' }),
      }),
    );
    expect(useGameStore.getState()).toMatchObject({
      currentLevel: 2,
      unlockedLevels: [0, 1],
      levelStars: { 0: 10, 1: 15 },
      stars: 25,
      friends: [expect.objectContaining({ id: 'gardener' })],
      season1Complete: false,
    });
  });

  it('does not apply rejected completions or leak a client-side error', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-test-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'level_out_of_order' }), { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { syncCompletedLevel } = await import('../../src/net/progression');
    const { useGameStore } = await import('../../src/store/useGameStore');

    await expect(syncCompletedLevel(9, 30, 'yagodka_rare')).resolves.toBeUndefined();

    expect(useGameStore.getState().currentLevel).toBe(0);
    expect(warn).toHaveBeenCalledWith('[progression] completion_rejected', {
      levelId: 9,
      status: 422,
    });
  });

  it('refreshes an expired session and retries the completion exactly once', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'expired-token',
        refresh_token: 'refresh-test-token',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'jwt expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'refreshed-token',
        refresh_token: 'refreshed-refresh-token',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(canonical), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { syncCompletedLevel } = await import('../../src/net/progression');
    const { useGameStore } = await import('../../src/store/useGameStore');

    await syncCompletedLevel(1, 15, 'gardener');

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://supabase.test/auth/v1/token?grant_type=refresh_token',
      expect.objectContaining({
        body: JSON.stringify({ refresh_token: 'refresh-test-token' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://supabase.test/rest/v1/rpc/barsik_complete_level',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer refreshed-token' }),
      }),
    );
    expect(useGameStore.getState().currentLevel).toBe(2);
  });
});
