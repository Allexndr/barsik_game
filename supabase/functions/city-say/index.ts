/**
 * city-say — the only way a message reaches the city.
 *
 * Why this exists at all: Supabase Realtime broadcast goes client to client.
 * A filter that runs in the browser is a suggestion — anyone who opens the
 * console can call `channel.send` directly and reach every child in the room
 * with anything they like. So the browser never broadcasts. It POSTs here,
 * this function decides, and only this function (holding the service-role
 * key) is allowed to publish.
 *
 * The moderation rules are imported from the app source rather than copied.
 * A second copy of a safety filter drifts from the first, and the day it does
 * is the day the two disagree about something that matters.
 *
 * Deploy:
 *   supabase functions deploy city-say --no-verify-jwt
 * Requires the schema in supabase/city_chat.sql to be applied first.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkText } from '../../../src/utils/moderation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** One room for now. A city that is one well-made place, as decided. */
const ROOMS = new Set(['city-1']);

const MAX_LEN = 120;

/**
 * Rate limit, per device id.
 *
 * In memory, which means per warm instance rather than global — enough to
 * stop a child holding down Enter, not enough to stop a determined flood
 * across cold starts. The durable version is the `city_rate` table below;
 * this is the cheap first gate so the common case never touches the database.
 */
const RECENT = new Map<string, number[]>();
const BURST_MS = 1500;
const PER_MINUTE = 20;

function tooFast(device: string, now: number): boolean {
  const hits = (RECENT.get(device) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  RECENT.set(device, hits);
  if (hits.length > PER_MINUTE) return true;
  return hits.length > 1 && now - hits[hits.length - 2] < BURST_MS;
}

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get('CITY_SAY_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-request-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? corsHeaders(req) : {}), 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  const requestId = req.headers.get('x-request-id')?.match(/^[A-Za-z0-9._:-]{1,100}$/)?.[0]
    ?? crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, req);

  let payload: { room?: string; nick?: string; device?: string; text?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad-json' }, 400, req);
  }

  const room = String(payload.room ?? '');
  const nick = String(payload.nick ?? '').slice(0, 16);
  const device = String(payload.device ?? '').slice(0, 64);
  const text = String(payload.text ?? '');

  if (!ROOMS.has(room)) return json({ error: 'no-room' }, 400, req);
  if (!device) return json({ error: 'no-device' }, 400, req);

  // The nickname goes through the same filter as the message. It is shown
  // next to every line, so it is a message that repeats itself.
  const nickCheck = checkText(nick, { minLength: 2, maxLength: 16 });
  if (!nickCheck.ok) return json({ error: 'nick', reason: nickCheck.reason }, 400, req);

  const verdict = checkText(text, {
    minLength: 1,
    maxLength: MAX_LEN,
    allowPunctuation: true,
  });
  if (!verdict.ok) {
    // Log the rejection without the text. Knowing that a device trips the
    // filter ten times a minute is what identifies a child who needs an adult;
    // storing what they wrote is a liability and helps nobody.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: rejectError } = await admin
      .from('city_rejects')
      .insert({ device, room, reason: verdict.reason });
    if (rejectError) {
      console.error('[city-say] reject_audit_failed', {
        requestId,
        room,
        code: rejectError.code,
      });
    }
    return json({ error: 'blocked', reason: verdict.reason }, 200, req);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  if (tooFast(device, Date.now())) return json({ error: 'slow-down' }, 429, req);
  const { data: durableAllowed, error: rateError } = await admin.rpc('city_rate_allow', { p_device: device });
  if (rateError) {
    console.error('[city-say] rate_limit_check_failed', { requestId, code: rateError.code });
    return json({ error: 'rate-limit-unavailable', requestId }, 503, req);
  }
  if (durableAllowed !== true) return json({ error: 'slow-down' }, 429, req);

  // Kept for reporting, not for reading back: the client renders from the
  // live channel. A short retention window is set by the cron in the SQL.
  const { data: row, error: insertError } = await admin
    .from('city_messages')
    .insert({ room, nick: nickCheck.text, device, text: verdict.text })
    .select('id, created_at')
    .single();
  if (insertError) {
    console.error('[city-say] store_failed', {
      requestId,
      room,
      code: insertError.code,
    });
    return json({ error: 'store', requestId }, 500, req);
  }

  const channel = admin.channel(`room:${room}`, { config: { private: true } });
  const subscribeResult = await channel.subscribe();
  if (subscribeResult !== 'SUBSCRIBED') {
    console.error('[city-say] broadcast_subscribe_failed', { requestId, room, state: subscribeResult });
    await admin.removeChannel(channel);
    return json({ error: 'broadcast', requestId }, 502, req);
  }
  const sendResult = await channel.send({
    type: 'broadcast',
    event: 'say',
    payload: { id: row.id, nick: nickCheck.text, text: verdict.text, at: row.created_at },
  });
  await admin.removeChannel(channel);
  if (sendResult !== 'ok') {
    console.error('[city-say] broadcast_failed', { requestId, room, result: sendResult });
    return json({ error: 'broadcast', requestId }, 502, req);
  }

  return json({ ok: true, id: row.id }, 200, req);
});
