import type { Lang } from '@/i18n';
import { t } from '@/i18n';

/** Soft nick uniqueness via local cache (device). Later: Supabase unique check. */

const NICKS_KEY = 'barsik_nicks_cache';

export function normalizeNick(nick: string): string {
  return nick.trim().toLowerCase().replace(/\s+/g, '_');
}

export function getCachedNicks(): string[] {
  try {
    const raw = localStorage.getItem(NICKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isNickTaken(nick: string, exceptId?: string): boolean {
  const n = normalizeNick(nick);
  if (n.length < 2) return false;
  const list = getCachedNicks();
  // Also check current player slot
  try {
    const playerRaw = localStorage.getItem('barsik_player');
    if (playerRaw) {
      const p = JSON.parse(playerRaw);
      if (p?.id !== exceptId && normalizeNick(p.nick || '') === n) return true;
    }
  } catch {
    /* ignore */
  }
  return list.includes(n);
}

export function suggestNick(base: string): string {
  const clean = normalizeNick(base) || 'barsik';
  if (!isNickTaken(clean)) return clean;
  for (let i = 2; i < 99; i++) {
    const candidate = `${clean}${i}`;
    if (!isNickTaken(candidate)) return candidate;
  }
  return `${clean}_${Date.now().toString(36).slice(-4)}`;
}

export function registerNick(nick: string): void {
  const n = normalizeNick(nick);
  if (n.length < 2) return;
  const list = getCachedNicks();
  if (!list.includes(n)) {
    list.push(n);
    localStorage.setItem(NICKS_KEY, JSON.stringify(list.slice(-500)));
  }
}

export function validateNick(
  nick: string,
  lang: Lang = 'ru',
): { ok: boolean; message?: string; suggestion?: string } {
  const trimmed = nick.trim();
  if (trimmed.length < 2) return { ok: false, message: t(lang, 'nick.short') };
  if (trimmed.length > 16) return { ok: false, message: t(lang, 'nick.long') };
  if (!/^[\p{L}\p{N}_ -]+$/u.test(trimmed)) {
    return { ok: false, message: t(lang, 'nick.chars') };
  }
  if (isNickTaken(trimmed)) {
    const suggestion = suggestNick(trimmed);
    return { ok: false, message: t(lang, 'nick.taken'), suggestion };
  }
  return { ok: true };
}
