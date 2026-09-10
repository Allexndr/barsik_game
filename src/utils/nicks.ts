import type { Lang } from '@/i18n';
import { t } from '@/i18n';
import { checkText, moderationMessage } from './moderation';

/** Мягкая проверка уникальности ника по локальному кешу устройства. Позже — проверка в Supabase. */

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
  // Проверяем и текущий слот игрока.
  try {
    const playerRaw = localStorage.getItem('barsik_player');
    if (playerRaw) {
      const p = JSON.parse(playerRaw);
      if (p?.id !== exceptId && normalizeNick(p.nick || '') === n) return true;
    }
  } catch {
    /* не важно */
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
  // Ник показывается другим детям в таблице результатов, и до сих пор никто не
  // смотрел, что в нём написано. Длина и класс символов содержательной проверкой не
  // являются.
  const safety = checkText(trimmed, { minLength: 2, maxLength: 16 });
  if (!safety.ok) {
    return { ok: false, message: moderationMessage(safety.reason, lang === 'kk' ? 'kk' : 'ru') };
  }
  if (isNickTaken(trimmed)) {
    const suggestion = suggestNick(trimmed);
    return { ok: false, message: t(lang, 'nick.taken'), suggestion };
  }
  return { ok: true };
}
