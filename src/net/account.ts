import type { Player } from '@/types';

export interface AccountUser {
  id: string;
  nick: string;
  gender: Player['gender'];
  lang: Player['lang'];
  createdAt: string;
}

export interface AccountSession {
  user: AccountUser;
  progress: unknown | null;
}

const API_ROOT = '/api';
let accountActive = false;

export function hasAccountSession(): boolean {
  return accountActive;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const body = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) {
    const error = new Error(body.error || `api_${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}

export function toPlayer(user: AccountUser): Player {
  return {
    id: user.id,
    nick: user.nick,
    gender: user.gender,
    ageCategory: '',
    phone: '',
    email: '',
    lang: user.lang,
    level: 0,
    stars: 0,
    createdAt: user.createdAt,
    profileStage: 'guest_nick',
  };
}

export async function registerAccount(input: {
  nick: string;
  pin: string;
  gender: Player['gender'];
  lang: Player['lang'];
}): Promise<AccountSession> {
  const result = await request<AccountSession>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  accountActive = true;
  return result;
}

export async function loginAccount(nick: string, pin: string): Promise<AccountSession> {
  const result = await request<AccountSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nick, pin }),
  });
  accountActive = true;
  return result;
}

export async function restoreAccount(): Promise<AccountSession | null> {
  try {
    const result = await request<{ user: AccountUser | null; progress: unknown | null }>('/auth/me');
    const user = result.user;
    if (!user) {
      accountActive = false;
      return null;
    }
    accountActive = true;
    return { ...result, user };
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 401) { accountActive = false; return null; }
    console.warn('[account] restore_failed', error);
    return null;
  }
}

export async function saveAccountProgress(progress: unknown): Promise<void> {
  if (!accountActive) return;
  try {
    await request('/progress', { method: 'PUT', body: JSON.stringify(progress) });
  } catch (error) {
    console.warn('[account] progress_save_failed', error);
  }
}

export async function logoutAccount(): Promise<void> {
  accountActive = false;
  try {
    await request('/auth/logout', { method: 'POST', body: '{}' });
  } catch (error) {
    console.warn('[account] logout_failed', error);
  }
}
