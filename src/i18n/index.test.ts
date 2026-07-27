import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LANG_KEY, isLang, localizedAsset, readStoredLang, t, writeStoredLang } from '@/i18n';

describe('isLang', () => {
  it('accepts only supported languages', () => {
    expect(isLang('ru')).toBe(true);
    expect(isLang('kk')).toBe(true);
    expect(isLang('en')).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});

describe('stored language', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to ru when nothing is stored', () => {
    expect(readStoredLang()).toBe('ru');
  });

  it('defaults to ru for an unsupported stored value', () => {
    localStorage.setItem(LANG_KEY, 'en');
    expect(readStoredLang()).toBe('ru');
  });

  it('round-trips a supported language', () => {
    writeStoredLang('kk');
    expect(localStorage.getItem(LANG_KEY)).toBe('kk');
    expect(readStoredLang()).toBe('kk');
  });

  it('falls back to ru when storage reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readStoredLang()).toBe('ru');
  });

  it('swallows storage write errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeStoredLang('kk')).not.toThrow();
  });
});

describe('t', () => {
  it('translates a key per language', () => {
    expect(t('ru', 'nav.friends')).toBe('Друзья');
    expect(t('kk', 'nav.friends')).not.toBe(t('ru', 'nav.friends'));
  });

  it('falls back to the russian dictionary, then to the key itself', () => {
    expect(t('kk', 'totally.missing.key')).toBe('totally.missing.key');
  });

  it('interpolates placeholders', () => {
    expect(t('ru', 'reward.at', { n: 50 })).toContain('50');
    expect(t('ru', 'reward.at', { n: 50 })).not.toContain('{n}');
    expect(t('kk', 'reward.at', { n: 7 })).toContain('7');
  });

  it('replaces every occurrence of a placeholder', () => {
    expect(t('ru', '{a}-{a}', { a: 'x' })).toBe('x-x');
  });
});

describe('localizedAsset', () => {
  it('returns the path unchanged for ru', () => {
    expect(localizedAsset('/assets/foo/bar.png', 'ru')).toBe('/assets/foo/bar.png');
  });

  it('inserts the _kk suffix before the extension', () => {
    expect(localizedAsset('/assets/foo/bar.png', 'kk')).toBe('/assets/foo/bar_kk.png');
  });

  it('preserves a query string', () => {
    expect(localizedAsset('/assets/foo/bar.png?v=2', 'kk')).toBe('/assets/foo/bar_kk.png?v=2');
  });

  it('appends the suffix when there is no extension', () => {
    expect(localizedAsset('/assets/foo/bar', 'kk')).toBe('/assets/foo/bar_kk');
    expect(localizedAsset('/assets/foo/bar?v=2', 'kk')).toBe('/assets/foo/bar_kk?v=2');
  });
});
