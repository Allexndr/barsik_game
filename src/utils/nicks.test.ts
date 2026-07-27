import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCachedNicks,
  isNickTaken,
  normalizeNick,
  registerNick,
  suggestNick,
  validateNick,
} from '@/utils/nicks';

const NICKS_KEY = 'barsik_nicks_cache';

describe('normalizeNick', () => {
  it('trims, lowercases and replaces whitespace runs with underscores', () => {
    expect(normalizeNick('  Barsik  Kot ')).toBe('barsik_kot');
    expect(normalizeNick('AYA')).toBe('aya');
  });
});

describe('nick cache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty list when nothing is cached', () => {
    expect(getCachedNicks()).toEqual([]);
  });

  it('returns an empty list for malformed or non-array cache content', () => {
    localStorage.setItem(NICKS_KEY, 'not-json');
    expect(getCachedNicks()).toEqual([]);
    localStorage.setItem(NICKS_KEY, '{"a":1}');
    expect(getCachedNicks()).toEqual([]);
  });

  it('registers normalized nicks once', () => {
    registerNick(' Aya ');
    registerNick('aya');
    expect(getCachedNicks()).toEqual(['aya']);
  });

  it('ignores nicks shorter than two characters', () => {
    registerNick('a');
    expect(getCachedNicks()).toEqual([]);
  });

  it('keeps at most the last 500 nicks', () => {
    const existing = Array.from({ length: 500 }, (_, i) => `nick${i}`);
    localStorage.setItem(NICKS_KEY, JSON.stringify(existing));
    registerNick('newcomer');
    const list = getCachedNicks();
    expect(list).toHaveLength(500);
    expect(list[0]).toBe('nick1');
    expect(list.at(-1)).toBe('newcomer');
  });
});

describe('isNickTaken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is false for nicks shorter than two characters', () => {
    registerNick('ay');
    expect(isNickTaken('a')).toBe(false);
  });

  it('detects a nick stored in the cache', () => {
    registerNick('aya');
    expect(isNickTaken('AYA')).toBe(true);
    expect(isNickTaken('bobik')).toBe(false);
  });

  it('detects the nick of the stored player', () => {
    localStorage.setItem('barsik_player', JSON.stringify({ id: 'p1', nick: 'Aya' }));
    expect(isNickTaken('aya')).toBe(true);
  });

  it('ignores the stored player when it is the excluded id', () => {
    localStorage.setItem('barsik_player', JSON.stringify({ id: 'p1', nick: 'Aya' }));
    expect(isNickTaken('aya', 'p1')).toBe(false);
  });

  it('survives a corrupted player record', () => {
    localStorage.setItem('barsik_player', 'broken');
    expect(isNickTaken('aya')).toBe(false);
  });
});

describe('suggestNick', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the normalized base when it is free', () => {
    expect(suggestNick(' Aya ')).toBe('aya');
  });

  it('falls back to barsik for an empty base', () => {
    expect(suggestNick('   ')).toBe('barsik');
  });

  it('appends the first free numeric suffix', () => {
    registerNick('aya');
    registerNick('aya2');
    expect(suggestNick('aya')).toBe('aya3');
  });

  it('falls back to a timestamp suffix when every candidate is taken', () => {
    const taken = ['aya', ...Array.from({ length: 97 }, (_, i) => `aya${i + 2}`)];
    localStorage.setItem(NICKS_KEY, JSON.stringify(taken));
    expect(suggestNick('aya')).toMatch(/^aya_[0-9a-z]{4}$/);
  });
});

describe('validateNick', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('accepts a plain nick', () => {
    expect(validateNick('Aya')).toEqual({ ok: true });
  });

  it('rejects a too short nick', () => {
    const res = validateNick('a');
    expect(res.ok).toBe(false);
    expect(res.message).toBe('Имя слишком короткое');
  });

  it('rejects a too long nick', () => {
    const res = validateNick('a'.repeat(17));
    expect(res.ok).toBe(false);
    expect(res.message).toBe('Максимум 16 символов');
  });

  it('rejects forbidden characters', () => {
    const res = validateNick('aya!');
    expect(res.ok).toBe(false);
    expect(res.message).toBe('Только буквы, цифры и _');
  });

  it('accepts letters of any script plus digits, underscore, space and dash', () => {
    expect(validateNick('Барсик 1-2_3').ok).toBe(true);
  });

  it('reports a taken nick with a suggestion', () => {
    registerNick('aya');
    const res = validateNick('Aya');
    expect(res.ok).toBe(false);
    expect(res.message).toBe('Такое имя уже есть');
    expect(res.suggestion).toBe('aya2');
  });

  it('localizes messages', () => {
    expect(validateNick('a', 'kk').message).toBe('Есім тым қысқа');
  });
});
