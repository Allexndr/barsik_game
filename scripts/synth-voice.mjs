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
 *   apple  (default, macOS)  `say` with Milena (ru) and Aru (kk). Aru is a
 *          real Kazakh voice and it is already on the machine, which makes
 *          this the only backend that can be run and checked end to end
 *          without downloading a model. Good enough to ship; not the best
 *          available.
 *   piper  Offline neural TTS. Better Russian than Apple's. Note the licence
 *          moved to GPL-3.0 in the maintained fork, which matters if the
 *          pack is redistributed — check before shipping.
 *          https://github.com/rhasspy/piper
 *   issai  KazakhTTS2 from Nazarbayev University: 270 hours, five voices,
 *          commercial use permitted, and Kazakhstani. The right answer for
 *          Kazakh; needs a Python environment and a model download.
 *          https://arxiv.org/pdf/2201.05771
 *
 * The manifest is the contract, so switching backends re-renders the same
 * ids and the game needs no change.
 *
 * Usage:
 *   node scripts/synth-voice.mjs                 # everything missing
 *   node scripts/synth-voice.mjs --force         # re-render all
 *   node scripts/synth-voice.mjs --lang kk       # one language
 *   node scripts/synth-voice.mjs --backend piper --piper-ru <model.onnx>
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
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

async function main() {
  if (!existsSync(MANIFEST)) {
    console.error('No manifest. Run: node scripts/extract-voice-lines.mjs');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const backend = arg('backend', 'apple');
  const onlyLang = arg('lang', null);
  const force = has('force');

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

  mkdirSync(join(VOICE, 'ru'), { recursive: true });
  mkdirSync(join(VOICE, 'kk'), { recursive: true });

  const entries = Object.entries(manifest.lines).filter(
    ([, l]) => !onlyLang || l.lang === onlyLang,
  );
  let done = 0, skipped = 0, failed = 0, bytes = 0;

  for (const [id, line] of entries) {
    const out = join(VOICE, line.lang, `${id}.mp3`);
    if (!force && existsSync(out)) {
      skipped++;
      bytes += statSync(out).size;
      continue;
    }
    const raw = join(tmpdir(), `barsik-${id}.${backend === 'apple' ? 'aiff' : 'wav'}`);
    try {
      if (backend === 'apple') await synthApple(line.text, line.lang, raw);
      else if (backend === 'piper') await synthPiper(line.text, line.lang, raw);
      else throw new Error(`unknown backend: ${backend}`);

      // 48 kbps mono is plenty for a single voice and keeps the whole pack
      // small enough to ship with the app rather than stream.
      await run('ffmpeg', [
        '-y', '-loglevel', 'error', '-i', raw,
        '-ac', '1', '-ar', '22050', '-b:a', '48k',
        // Trim the silence Apple's renderer leaves at both ends; six hundred
        // clips each starting with a pause makes the game feel sluggish.
        '-af', 'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,areverse',
        out,
      ]);
      bytes += statSync(out).size;
      done++;
    } catch (e) {
      failed++;
      console.error(`\n  ${id} (${line.lang}) "${line.text.slice(0, 40)}…": ${e.message.split('\n')[0]}`);
    } finally {
      try { unlinkSync(raw); } catch { /* already gone */ }
    }
    if ((done + skipped) % 25 === 0) {
      process.stdout.write(`\r  ${done + skipped}/${entries.length}   `);
    }
  }

  console.log(`\nRendered ${done}, kept ${skipped}, failed ${failed}`);
  console.log(`Pack size: ${(bytes / 1024 / 1024).toFixed(1)} MB across ${entries.length} clips`);
  if (failed) process.exit(1);

  // A marker the runtime can fetch to know a pack was built, without probing
  // six hundred URLs.
  writeFileSync(
    join(VOICE, 'built.json'),
    JSON.stringify({ at: new Date().toISOString(), backend, clips: entries.length }, null, 1),
  );
  console.log(`Wrote ${relative(ROOT, join(VOICE, 'built.json'))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
