import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
import { isChatId } from '@/utils/safeChat';
import { checkText } from '@/utils/moderation';

/**
 * Сетевой слой хаба.
 *
 * Одна локация — один канал. Внутри канала два разных механизма, и разделены
 * они не случайно:
 *
 * - **presence** держит список тех, кто сейчас здесь, и их неизменные данные —
 *   имя и окрас. Supabase сам присылает уход игрока, даже если у того просто
 *   пропал интернет, поэтому «призраки» на площади не остаются.
 * - **broadcast** носит то, что меняется каждый кадр: координаты и реплики. Он
 *   ничего не хранит и не пишет в базу — это и нужно, потому что писать в базу
 *   десять раз в секунду на каждого ребёнка нельзя ни по деньгам, ни по смыслу.
 *
 * Сцена про Supabase ничего не знает: она получает список соседей и колбэки.
 * Если сети нет, хаб просто работает в одиночку — ребёнок этого не замечает,
 * кроме отсутствия соседей.
 */

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://vsuqaatpzyatzhmmdmug.supabase.co';
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdXFhYXRwenlhdHpobW1kbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODYwNDUsImV4cCI6MjA5OTY2MjA0NX0.fA7_lyCIPUppg_DmgMuwKHaFR93jMLXD7T7tEfWsceo';

/** Как часто уходят координаты. 10 раз в секунду — сглаживание берёт на себя сцена. */
export const MOVE_HZ = 10;

/**
 * Потолок длины свободной реплики.
 *
 * Не про экономию трафика: длинная строка над головой закрывает пол-экрана, а
 * в детском чате она почти всегда либо спам, либо попытка обойти фильтр
 * пробелами внутри слова.
 */
export const FREE_TEXT_MAX = 90;

/** Сколько ждать пакета, прежде чем считать соседа отвалившимся. */
const STALE_MS = 6000;

export type HubPose = 'idle' | 'walk' | 'run' | 'wave' | 'dance' | 'cheer' | 'sit' | 'point';

export interface HubIdentity {
  id: string;
  name: string;
  /** Окрас — чтобы соседи отличались друг от друга, а не были клонами. */
  fur: number;
  spots: number;
  hoodie: number;
}

export interface HubPeer extends HubIdentity {
  x: number;
  z: number;
  ry: number;
  pose: HubPose;
  /** Номер фразы из каталога — основной режим, см. safeChat.ts. */
  sayId?: number;
  /** Свободный текст — только если родитель включил его в настройках. */
  sayText?: string;
  sayAt?: number;
  lastSeen: number;
}

export type HubStatus = 'offline' | 'connecting' | 'online';

export interface HubConnection {
  status(): HubStatus;
  peers(): HubPeer[];
  /** Координаты уходят не чаще MOVE_HZ; лишние вызовы бесплатны. */
  move(x: number, z: number, ry: number, pose: HubPose): void;
  say(chatId: number): void;
  /**
   * Свободная реплика. Уходит только когда режим включён родителем; на
   * приёмной стороне всё равно проходит фильтр заново.
   */
  sayText(text: string): void;
  leave(): void;
}

const POSES: ReadonlySet<string> = new Set<HubPose>([
  'idle', 'walk', 'run', 'wave', 'dance', 'cheer', 'sit', 'point',
]);

/** Пакет из сети — данные, а не команда: проверяем каждое поле. */
function sanitize(raw: unknown, known: Map<string, HubPeer>): HubPeer | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const id = typeof p.id === 'string' ? p.id.slice(0, 64) : null;
  if (!id) return null;
  const prev = known.get(id);
  if (!prev) return null; // двигать можно только того, кто заявлен в presence
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const pose = typeof p.pose === 'string' && POSES.has(p.pose) ? (p.pose as HubPose) : 'idle';
  return {
    ...prev,
    // Зажимаем координаты: чужой клиент не должен уметь утащить аватар
    // за карту и растянуть сцену на километр.
    x: Math.max(-200, Math.min(200, num(p.x, prev.x))),
    z: Math.max(-200, Math.min(200, num(p.z, prev.z))),
    ry: num(p.ry, prev.ry),
    pose,
    lastSeen: Date.now(),
  };
}

function sanitizeIdentity(raw: unknown): HubIdentity | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) return null;
  const colour = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffff ? v : fallback;
  return {
    id: p.id.slice(0, 64),
    // Имя уже прошло модерацию при вводе, но пришло оно с чужой машины —
    // режем длину, чтобы над головой не выросла простыня.
    name: (typeof p.name === 'string' ? p.name : '').slice(0, 24) || '…',
    fur: colour(p.fur, 0xf5f3ef),
    spots: colour(p.spots, 0x8ba4b8),
    hoodie: colour(p.hoodie, 0x3dcc6e),
  };
}

export function connectHub(
  location: string,
  me: HubIdentity,
  onChange: () => void,
): HubConnection {
  const known = new Map<string, HubPeer>();
  let status: HubStatus = 'connecting';
  let client: RealtimeClient | null = null;
  let channel: RealtimeChannel | null = null;
  let lastSent = 0;
  let pending: { x: number; z: number; ry: number; pose: HubPose } | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let dead = false;

  const fail = (why: string) => {
    if (dead) return;
    status = 'offline';
    console.warn('[hub] офлайн:', why);
    onChange();
  };

  try {
    client = new RealtimeClient(`${SUPABASE_URL}/realtime/v1`, {
      params: { apikey: SUPABASE_ANON },
    });
    channel = client.channel(`hub:${location}`, {
      config: {
        // enabled: без него presenceState() остаётся пустым — клиент не
        // запрашивает начальный снимок и не видит вообще никого.
        presence: { key: me.id, enabled: true },
        // self: false — свои же пакеты обратно не нужны, местного игрока
        // рисует сцена напрямую и без задержки сети.
        broadcast: { self: false },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel!.presenceState<Record<string, unknown>>();
      const seen = new Set<string>();
      for (const entries of Object.values(state)) {
        for (const entry of entries as unknown as Record<string, unknown>[]) {
          const ident = sanitizeIdentity(entry);
          if (!ident || ident.id === me.id) continue;
          seen.add(ident.id);
          const prev = known.get(ident.id);
          known.set(ident.id, {
            ...ident,
            x: prev?.x ?? 0,
            z: prev?.z ?? 0,
            ry: prev?.ry ?? 0,
            pose: prev?.pose ?? 'idle',
            sayId: prev?.sayId,
            sayAt: prev?.sayAt,
            lastSeen: Date.now(),
          });
        }
      }
      for (const id of [...known.keys()]) if (!seen.has(id)) known.delete(id);
      onChange();
    });

    channel.on('broadcast', { event: 'm' }, ({ payload }) => {
      const next = sanitize(payload, known);
      if (next) known.set(next.id, next);
    });

    channel.on('broadcast', { event: 's' }, ({ payload }) => {
      const p = payload as Record<string, unknown> | null;
      if (!p || typeof p.id !== 'string') return;
      const peer = known.get(p.id);
      // Незнакомый номер фразы выбрасываем молча: на экран ребёнка не должно
      // попасть ничего, чего нет в нашем собственном каталоге.
      if (!peer || !isChatId(p.c)) return;
      peer.sayId = p.c as number;
      peer.sayText = undefined;
      peer.sayAt = Date.now();
      onChange();
    });

    channel.on('broadcast', { event: 't' }, ({ payload }) => {
      const p = payload as Record<string, unknown> | null;
      if (!p || typeof p.id !== 'string' || typeof p.t !== 'string') return;
      const peer = known.get(p.id);
      if (!peer) return;
      // Фильтр на приёме — единственный, который действительно защищает
      // ребёнка. Проверку у отправителя изменённый клиент просто выбросит,
      // а эту он выбросить не может: она стоит на нашей машине.
      const verdict = checkText(p.t, { minLength: 1, maxLength: FREE_TEXT_MAX, allowPunctuation: true });
      if (!verdict.ok) return;
      peer.sayText = verdict.text;
      peer.sayId = undefined;
      peer.sayAt = Date.now();
      onChange();
    });

    channel.subscribe((state, err) => {
      if (dead) return;
      if (state === 'SUBSCRIBED') {
        status = 'online';
        void channel!.track({ ...me });
        onChange();
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        fail(err?.message ?? state);
      } else if (state === 'CLOSED') {
        status = 'offline';
        onChange();
      }
    });

    // Отправка координат пачкой, а не на каждое движение: кадров шестьдесят
    // в секунду, пакетов нужно десять.
    timer = setInterval(() => {
      const now = Date.now();
      if (pending && status === 'online' && now - lastSent >= 1000 / MOVE_HZ) {
        lastSent = now;
        void channel!.send({ type: 'broadcast', event: 'm', payload: { id: me.id, ...pending } });
        pending = null;
      }
      // Сосед, от которого давно нет пакетов, но presence его ещё держит —
      // скорее всего свернул вкладку. Убираем, чтобы не стоял столбом.
      let dropped = false;
      for (const [id, peer] of known) {
        if (now - peer.lastSeen > STALE_MS) { known.delete(id); dropped = true; }
      }
      if (dropped) onChange();
    }, 1000 / MOVE_HZ);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }

  return {
    status: () => status,
    peers: () => [...known.values()],
    move(x, z, ry, pose) {
      pending = { x, z, ry, pose };
    },
    say(chatId) {
      if (!isChatId(chatId) || status !== 'online' || !channel) return;
      void channel.send({ type: 'broadcast', event: 's', payload: { id: me.id, c: chatId } });
    },
    sayText(text) {
      if (status !== 'online' || !channel) return;
      const verdict = checkText(text, { minLength: 1, maxLength: FREE_TEXT_MAX, allowPunctuation: true });
      if (!verdict.ok) return;
      void channel.send({ type: 'broadcast', event: 't', payload: { id: me.id, t: verdict.text } });
    },
    leave() {
      dead = true;
      if (timer) clearInterval(timer);
      timer = null;
      known.clear();
      try {
        if (channel) void channel.unsubscribe();
        if (client) void client.disconnect();
      } catch {
        // Уже разорвано — молча: это дорога выхода, шуметь тут не о чем.
      }
      status = 'offline';
    },
  };
}
