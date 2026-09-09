#!/usr/bin/env node
/**
 * Render the voice pack from the manifest.
 *
 * Why a pack at all: the game speaks through `window.speechSynthesis`, which
 * uses whatever voice the device happens to own. Android ships no `kk-KZ`
 * voice, so every Kazakh line is either silent or read by a Russian voice
 * pronouncing Kazakh — for an audience that cannot yet read the subtitle it
 * is missing. Rendering once means one known voice per language on every
 * device, offline, with no per-utterance latency.
 *
 * Backends:
 *
 *   edge     (default)  Microsoft Edge neural via `edge-tts`.
 *            Real RU + KK male/female (Svetlana/Dmitry, Aigul/Daulet).
 *   together Together AI `/v1/audio/speech` (needs TOGETHER_API_KEY).
 *            Good for warm RU (Orpheus/Kokoro). KK is not native — prefer
 *            Edge for Kazakh, or `--backend hybrid`.
 *   hybrid   RU → Together, KK → Edge. Best of both for bilingual packs.
 *   apple    macOS `say` (smoke).
 *   piper    Offline neural TTS.
 *
 * Personas (`--persona f|m`) pick male/female voices and write into:
 *   f → public/assets/voice/{lang}/{id}.mp3   (default, existing layout)
 *   m → public/assets/voice/m/{lang}/{id}.mp3
 *
 * Usage:
 *   node scripts/synth-voice.mjs
 *   node scripts/synth-voice.mjs --persona m --force
 *   node scripts/synth-voice.mjs --backend hybrid --persona f --lang ru
 *   node scripts/synth-voice.mjs --backend together --persona m --lang ru
 *   TOGETHER_API_KEY=… node scripts/synth-voice.mjs --backend hybrid --persona f
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync, statSync, renameSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VOICE = join(ROOT, 'public/assets/voice');
const MANIFEST = join(VOICE, 'manifest.json');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const PERSONA = arg('persona', 'f'); // f | m
if (PERSONA !== 'f' && PERSONA !== 'm') {
  console.error(`--persona must be f or m (got ${PERSONA})`);
  process.exit(1);
}

const APPLE_VOICE = {
  f: { ru: arg('apple-ru', 'Milena'), kk: arg('apple-kk', 'Aru') },
  m: { ru: arg('apple-ru', 'Yuri'), kk: arg('apple-kk', 'Aru') },
}[PERSONA];
const RATE = Number(arg('rate', '165'));

const EDGE_VOICE = {
  f: {
    ru: arg('edge-ru', 'ru-RU-SvetlanaNeural'),
    kk: arg('edge-kk', 'kk-KZ-AigulNeural'),
  },
  m: {
    ru: arg('edge-ru', 'ru-RU-DmitryNeural'),
    kk: arg('edge-kk', 'kk-KZ-DauletNeural'),
  },
}[PERSONA];

/** Together Orpheus — expressive EN-trained voices; OK-ish on Russian Cyrillic. */
const TOGETHER_VOICE = {
  f: arg('together-voice-f', 'tara'),
  m: arg('together-voice-m', 'dan'),
}[PERSONA];
const TOGETHER_MODEL = arg('together-model', 'canopylabs/orpheus-3b-0.1-ft');

function packDir(lang) {
  return PERSONA === 'm' ? join(VOICE, 'm', lang) : join(VOICE, lang);
}

function clipPath(lang, id) {
  return join(packDir(lang), `${id}.mp3`);
}

async function synthApple(text, lang, aiff) {
  await run('say', ['-v', APPLE_VOICE[lang], '-r', String(RATE), '-o', aiff, text]);
}

async function synthPiper(text, lang, wav) {
  const model = arg(`piper-${lang}`, null);
  if (!model) throw new Error(`--piper-${lang} <model.onnx> is required for the piper backend`);
  await run('sh', ['-c', `printf %s ${JSON.stringify(text)} | piper --model ${JSON.stringify(model)} --output_file ${JSON.stringify(wav)}`]);
}

async function synthEdge(text, lang, mp3) {
  const attempts = Math.max(1, Number(arg('retries', '5')));
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await run('edge-tts', [
        '--voice', EDGE_VOICE[lang],
        '--text', text,
        '--write-media', mp3,
      ], { timeout: 90_000 });
      return;
    } catch (e) {
      lastErr = e;
      const wait = 1500 * (i + 1) * (i + 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/**
 * Together AI TTS. Uses curl (Python urllib often gets CF 1010 from this host).
 * Key from env only — never commit.
 */
async function synthTogether(text, lang, mp3) {
  const key = process.env.TOGETHER_API_KEY;
  if (!key) throw new Error('TOGETHER_API_KEY is not set');
  const body = JSON.stringify({
    model: TOGETHER_MODEL,
    input: text,
    voice: TOGETHER_VOICE,
    response_format: 'mp3',
    language: lang,
  });
  const attempts = Math.max(1, Number(arg('retries', '4')));
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await run('curl', [
        '-sS', '-f',
        '-X', 'POST', 'https://api.together.ai/v1/audio/speech',
        '-H', `Authorization: Bearer ${key}`,
        '-H', 'Content-Type: application/json',
        '-H', 'User-Agent: barsik-synth/1.0',
        '-d', body,
        '-o', mp3,
      ], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
      if (!existsSync(mp3) || statSync(mp3).size < 200) {
        throw new Error('Together returned empty/tiny audio');
      }
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastErr;
}

async function encodeClip(raw, out) {
  const tmpOut = `${out}.part.mp3`;
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', raw,
    '-ac', '1', '-ar', '22050', '-b:a', '48k',
    '-af', 'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,areverse',
    tmpOut,
  ]);
  renameSync(tmpOut, out);
}

async function mapPool(items, concurrency, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

async function main() {
  if (!existsSync(MANIFEST)) {
    console.error('No manifest. Run: node scripts/extract-voice-lines.mjs');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const backend = arg('backend', 'edge');
  const onlyLang = arg('lang', null);
  const force = has('force');
  const defaultConc = backend === 'edge' ? '2' : backend === 'together' || backend === 'hybrid' ? '3' : '1';
  const concurrency = Math.max(1, Number(arg('concurrency', defaultConc)));

  try {
    await run('ffmpeg', ['-version']);
  } catch {
    console.error('ffmpeg not found — needed to encode mp3. brew install ffmpeg');
    process.exit(1);
  }
  if (backend === 'apple') {
    const { stdout } = await run('say', ['-v', '?']);
    for (const lang of onlyLang ? [onlyLang] : ['ru', 'kk']) {
      if (!stdout.includes(APPLE_VOICE[lang])) {
        console.error(`Voice "${APPLE_VOICE[lang]}" is not installed.`);
        process.exit(1);
      }
    }
  }
  if (backend === 'edge' || backend === 'hybrid') {
    try {
      await run('edge-tts', ['--version']);
    } catch {
      console.error('edge-tts not found. Install: pipx install edge-tts  (or brew/pip)');
      process.exit(1);
    }
    console.log(`Edge voices (${PERSONA}): ru=${EDGE_VOICE.ru}  kk=${EDGE_VOICE.kk}`);
  }
  if (backend === 'together' || backend === 'hybrid') {
    if (!process.env.TOGETHER_API_KEY) {
      console.error('TOGETHER_API_KEY required for together/hybrid backend');
      process.exit(1);
    }
    console.log(`Together (${PERSONA}): model=${TOGETHER_MODEL} voice=${TOGETHER_VOICE}`);
  }

  mkdirSync(join(VOICE, 'ru'), { recursive: true });
  mkdirSync(join(VOICE, 'kk'), { recursive: true });
  mkdirSync(join(VOICE, 'm', 'ru'), { recursive: true });
  mkdirSync(join(VOICE, 'm', 'kk'), { recursive: true });

  const entries = Object.entries(manifest.lines).filter(
    ([, l]) => !onlyLang || l.lang === onlyLang,
  );

  console.log(`Backend=${backend} persona=${PERSONA} clips=${entries.length} concurrency=${concurrency} force=${force}`);

  let done = 0, skipped = 0, failed = 0, bytes = 0;
  const failures = [];

  await mapPool(entries, concurrency, async ([id, line]) => {
    const out = clipPath(line.lang, id);
    if (!force && existsSync(out)) {
      skipped++;
      bytes += statSync(out).size;
      return;
    }
    mkdirSync(packDir(line.lang), { recursive: true });
    const useTogether = backend === 'together' || (backend === 'hybrid' && line.lang === 'ru');
    const useEdge = backend === 'edge' || (backend === 'hybrid' && line.lang === 'kk');
    const ext = backend === 'apple' ? 'aiff' : backend === 'piper' ? 'wav' : 'mp3';
    const raw = join(tmpdir(), `barsik-${process.pid}-${PERSONA}-${id}.${ext}`);
    try {
      if (backend === 'apple') await synthApple(line.text, line.lang, raw);
      else if (backend === 'piper') await synthPiper(line.text, line.lang, raw);
      else if (useTogether) await synthTogether(line.text, line.lang, raw);
      else if (useEdge) await synthEdge(line.text, line.lang, raw);
      else throw new Error(`unknown backend: ${backend}`);

      await encodeClip(raw, out);
      bytes += statSync(out).size;
      done++;
    } catch (e) {
      failed++;
      const msg = (e.message || String(e)).split('\n')[0];
      failures.push(`${id} (${line.lang}): ${msg}`);
      if (failures.length <= 8) {
        console.error(`\n  ${id} (${line.lang}) "${line.text.slice(0, 40)}…": ${msg}`);
      }
    } finally {
      try { unlinkSync(raw); } catch { /* already gone */ }
    }
    const n = done + skipped + failed;
    if (n % 25 === 0 || n === entries.length) {
      process.stdout.write(`\r  ${n}/${entries.length} (ok ${done}, skip ${skipped}, fail ${failed})   `);
    }
  });

  console.log(`\nRendered ${done}, kept ${skipped}, failed ${failed}`);
  console.log(`Pack size: ${(bytes / 1024 / 1024).toFixed(1)} MB across ${entries.length} clips`);
  if (failed) {
    for (const f of failures.slice(0, 20)) console.error(`  ${f}`);
    if (failures.length > 20) console.error(`  …and ${failures.length - 20} more`);
    process.exit(1);
  }

  const markerName = PERSONA === 'm' ? 'built-m.json' : 'built.json';
  writeFileSync(
    join(VOICE, markerName),
    JSON.stringify({
      at: new Date().toISOString(),
      backend,
      persona: PERSONA,
      voices: backend === 'edge' || backend === 'hybrid'
        ? { edge: EDGE_VOICE, together: backend === 'hybrid' ? { model: TOGETHER_MODEL, voice: TOGETHER_VOICE } : undefined }
        : backend === 'together'
          ? { model: TOGETHER_MODEL, voice: TOGETHER_VOICE }
          : backend === 'apple' ? APPLE_VOICE : undefined,
      clips: Object.keys(manifest.lines).length,
    }, null, 1),
  );
  console.log(`Wrote ${relative(ROOT, join(VOICE, markerName))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
