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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  let payload: { room?: string; nick?: string; device?: string; text?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad-json' }, 400);
  }

  const room = String(payload.room ?? '');
  const nick = String(payload.nick ?? '').slice(0, 16);
  const device = String(payload.device ?? '').slice(0, 64);
  const text = String(payload.text ?? '');

  if (!ROOMS.has(room)) return json({ error: 'no-room' }, 400);
  if (!device) return json({ error: 'no-device' }, 400);

  // The nickname goes through the same filter as the message. It is shown
  // next to every line, so it is a message that repeats itself.
  const nickCheck = checkText(nick, { minLength: 2, maxLength: 16 });
  if (!nickCheck.ok) return json({ error: 'nick', reason: nickCheck.reason }, 400);

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
    await admin.from('city_rejects').insert({ device, room, reason: verdict.reason });
    return json({ error: 'blocked', reason: verdict.reason }, 200);
  }

  if (tooFast(device, Date.now())) return json({ error: 'slow-down' }, 429);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Kept for reporting, not for reading back: the client renders from the
  // live channel. A short retention window is set by the cron in the SQL.
  const { data: row, error: insertError } = await admin
    .from('city_messages')
    .insert({ room, nick: nickCheck.text, device, text: verdict.text })
    .select('id, created_at')
    .single();
  if (insertError) return json({ error: 'store' }, 500);

  const channel = admin.channel(`room:${room}`, { config: { private: true } });
  await channel.subscribe();
  await channel.send({
    type: 'broadcast',
    event: 'say',
    payload: { id: row.id, nick: nickCheck.text, text: verdict.text, at: row.created_at },
  });
  await admin.removeChannel(channel);

  return json({ ok: true, id: row.id });
});
