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
 * Backends, in the order they are worth using:
 *
 *   edge   (default)  Microsoft Edge neural voices via `edge-tts`.
 *          Real RU + KK: ru-RU-SvetlanaNeural, kk-KZ-AigulNeural.
 *          Free CLI, no API key. Best quality available without a paid
 *          cloud account. Needs network while rendering; runtime stays
 *          offline (clips ship in public/assets/voice/).
 *   apple  macOS `say` with Milena (ru) and Aru (kk). Offline, quick
 *          smoke builds. Robotic vs Edge neural — keep as fallback.
 *   piper  Offline neural TTS. Better Russian than Apple's. GPL-3.0
 *          on the maintained fork — check before redistributing.
 *          https://github.com/rhasspy/piper
 *   issai  KazakhTTS2 from Nazarbayev University: 270 hours, five voices,
 *          commercial use permitted. Needs Python + model download.
 *          https://arxiv.org/pdf/2201.05771
 *
 * The manifest is the contract, so switching backends re-renders the same
 * ids and the game needs no change.
 *
 * Usage:
 *   node scripts/synth-voice.mjs                 # everything missing (edge)
 *   node scripts/synth-voice.mjs --force         # re-render all
 *   node scripts/synth-voice.mjs --lang kk       # one language
 *   node scripts/synth-voice.mjs --backend apple
 *   node scripts/synth-voice.mjs --backend piper --piper-ru <model.onnx>
 *   node scripts/synth-voice.mjs --concurrency 6
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

/**
 * Apple's voices. Milena reads Russian naturally at a slightly slowed rate;
 * children's dialogue at the default 180 wpm is too fast to follow at five.
 */
const APPLE_VOICE = { ru: arg('apple-ru', 'Milena'), kk: arg('apple-kk', 'Aru') };
const RATE = Number(arg('rate', '165'));

/** Edge neural — kid-friendly female voices for both languages. */
const EDGE_VOICE = {
  ru: arg('edge-ru', 'ru-RU-SvetlanaNeural'),
  kk: arg('edge-kk', 'kk-KZ-AigulNeural'),
};

async function synthApple(text, lang, aiff) {
  // No --data-format: `say` rejects it here with "Opening output file failed:
  // fmt?" and writes a zero-byte file. ffmpeg resamples on the next step
  // anyway, so the flag bought nothing.
  await run('say', ['-v', APPLE_VOICE[lang], '-r', String(RATE), '-o', aiff, text]);
}

async function synthPiper(text, lang, wav) {
  const model = arg(`piper-${lang}`, null);
  if (!model) throw new Error(`--piper-${lang} <model.onnx> is required for the piper backend`);
  await run('sh', ['-c', `printf %s ${JSON.stringify(text)} | piper --model ${JSON.stringify(model)} --output_file ${JSON.stringify(wav)}`]);
}

/**
 * Edge neural TTS. Writes mp3 directly; we still pass through ffmpeg for
 * silence trim + bitrate so the pack stays uniform with other backends.
 * Retries with backoff — Microsoft throttles bursty free-tier traffic.
 */
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
      const wait = 1500 * (i + 1) * (i + 1); // 1.5s, 6s, 13.5s, …
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function encodeClip(raw, out) {
  // Sibling temp must keep a real audio extension — ffmpeg refuses
  // `.mp3.partial` ("Unable to choose an output format").
  const tmpOut = `${out}.part.mp3`;
  // 48 kbps mono is plenty for a single voice and keeps the whole pack
  // small enough to ship with the app rather than stream.
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', raw,
    '-ac', '1', '-ar', '22050', '-b:a', '48k',
    // Trim leading/trailing silence so six hundred clips don't each start
    // with a pause that makes the game feel sluggish.
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
  const concurrency = Math.max(1, Number(arg('concurrency', backend === 'edge' ? '2' : '1')));

  // Fail before rendering six hundred clips, not after the first one.
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
        console.error('System Settings → Accessibility → Spoken Content → System Voice → Manage Voices.');
        process.exit(1);
      }
    }
  }
  if (backend === 'edge') {
    try {
      await run('edge-tts', ['--version']);
    } catch {
      console.error('edge-tts not found. Install: pipx install edge-tts  (or brew/pip)');
      process.exit(1);
    }
    console.log(`Edge voices: ru=${EDGE_VOICE.ru}  kk=${EDGE_VOICE.kk}`);
  }

  mkdirSync(join(VOICE, 'ru'), { recursive: true });
  mkdirSync(join(VOICE, 'kk'), { recursive: true });

  const entries = Object.entries(manifest.lines).filter(
    ([, l]) => !onlyLang || l.lang === onlyLang,
  );

  console.log(`Backend=${backend}  clips=${entries.length}  concurrency=${concurrency}  force=${force}`);

  let done = 0, skipped = 0, failed = 0, bytes = 0;
  const failures = [];

  await mapPool(entries, concurrency, async ([id, line]) => {
    const out = join(VOICE, line.lang, `${id}.mp3`);
    if (!force && existsSync(out)) {
      skipped++;
      bytes += statSync(out).size;
      return;
    }
    const ext = backend === 'apple' ? 'aiff' : backend === 'piper' ? 'wav' : 'mp3';
    const raw = join(tmpdir(), `barsik-${process.pid}-${id}.${ext}`);
    try {
      if (backend === 'apple') await synthApple(line.text, line.lang, raw);
      else if (backend === 'piper') await synthPiper(line.text, line.lang, raw);
      else if (backend === 'edge') await synthEdge(line.text, line.lang, raw);
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

  // A marker the runtime can fetch to know a pack was built, without probing
  // six hundred URLs.
  writeFileSync(
    join(VOICE, 'built.json'),
    JSON.stringify({
      at: new Date().toISOString(),
      backend,
      voices: backend === 'edge' ? EDGE_VOICE : backend === 'apple' ? APPLE_VOICE : undefined,
      clips: entries.length,
    }, null, 1),
  );
  console.log(`Wrote ${relative(ROOT, join(VOICE, 'built.json'))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
