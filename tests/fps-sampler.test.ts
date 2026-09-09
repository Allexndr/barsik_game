import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('dev FPS sampler', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('location', { search: '?fps=1' });
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exposes a sample without retaining the sampler after dispose', async () => {
    const { createFpsSampler } = await import('../src/dev/fpsSampler');
    const sampler = createFpsSampler('test');

    for (let i = 0; i <= 700; i++) sampler.frame(i * 16.67);

    const exposed = window.__fpsSamples?.() ?? [];
    expect(exposed.length).toBeGreaterThan(0);
    expect(exposed[0]).toMatchObject({ avg: expect.any(Number), p5: expect.any(Number) });

    sampler.dispose();
    expect(window.__fpsSamples).toBeUndefined();
    expect(window.__clearFpsSamples).toBeUndefined();
  });

  it('keeps slow frames so weak devices produce a low-FPS sample', async () => {
    const { createFpsSampler } = await import('../src/dev/fpsSampler');
    const sampler = createFpsSampler('slow');

    for (let i = 0; i <= 40; i++) sampler.frame(i * 400);

    const samples = window.__fpsSamples?.() ?? [];
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[0].avg).toBeLessThan(3);
    expect(samples[0].p5).toBeLessThan(3);
    sampler.dispose();
  });
});
