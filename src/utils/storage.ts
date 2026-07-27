/**
 * localStorage access that never throws (private mode, quota, SSR).
 * All game keys live here so storage layout is greppable in one place.
 */

export const STORAGE_KEYS = {
  player: 'barsik_player',
  progress: 'barsik_progress',
  lang: 'barsik_lang',
  muted: 'barsik_muted',
  mission0Done: 'barsik_mission0_done',
  nicks: 'barsik_nicks_cache',
  cloudPending: 'barsik_cloud_pending',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readString(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: StorageKey, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function removeKey(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readJson<T>(key: StorageKey): T | null {
  const raw = readString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(key: StorageKey, value: unknown): void {
  try {
    writeString(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function isFlagSet(key: StorageKey): boolean {
  return readString(key) === '1';
}

export function setFlag(key: StorageKey, on: boolean): void {
  writeString(key, on ? '1' : '0');
}
