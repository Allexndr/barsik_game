import type { Lang } from '@/i18n';
import { t } from '@/i18n';
import { STORAGE_KEYS, readJson, writeJson } from '@/utils/storage';
import type { Player } from '@/types';

/** Soft nick uniqueness via local cache (device). Later: Supabase unique check. */

export function normalizeNick(nick: string): string {
  return nick.trim().toLowerCase().replace(/\s+/g, '_');
}

export function getCachedNicks(): string[] {
  const parsed = readJson<string[]>(STORAGE_KEYS.nicks);
  return Array.isArray(parsed) ? parsed : [];
}

export function isNickTaken(nick: string, exceptId?: string): boolean {
  const n = normalizeNick(nick);
  if (n.length < 2) return false;
  const list = getCachedNicks();
  // Also check current player slot
  const p = readJson<Player>(STORAGE_KEYS.player);
  if (p && p.id !== exceptId && normalizeNick(p.nick || '') === n) return true;
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
    writeJson(STORAGE_KEYS.nicks, list.slice(-500));
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
