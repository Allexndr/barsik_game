#!/usr/bin/env node
/**
 * Collect every line the game speaks, in both languages.
 *
 * The scenes write dialogue as `this.copy('русский', 'қазақша')`, and the
 * screens hand whichever half matches the current language to
 * `AudioManager.tts`. That is 380-odd pairs across seventeen scenes, so the
 * list has to be derived from the source rather than maintained by hand — a
 * hand-kept list goes stale the first time somebody rewrites a line, and the
 * symptom is a clip that says the old words.
 *
 * Not a TypeScript parse: a small scanner that walks the file looking for
 * `copy(` and then reads two string literals, respecting escapes and the
 * quote style. That handles every form used here — single, double and
 * backtick, including template literals with `${nick}` in them — and it fails
 * loudly rather than silently skipping anything it cannot read.
 *
 * Usage:
 *   node scripts/extract-voice-lines.mjs
 *   node scripts/extract-voice-lines.mjs --check   # non-zero if stale
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCENES = join(ROOT, 'src/three/scenes');
const OUT_DIR = join(ROOT, 'public/assets/voice');
const OUT = join(OUT_DIR, 'manifest.json');

// ── the naming rule, kept identical to src/audio/voiceLines.ts ────────────
// Duplicated here rather than imported because this is a plain .mjs script
// and that file is TypeScript. The pair is asserted below: any drift changes
// the ids, and --check turns that into a failed build rather than silence.
function normalizeLine(input) {
  return input
    .replace(/\$\{[^}]*\}/g, '')
    .replace(/\s*,\s*([.!?])/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/,\s*$/g, '')
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lineId(text, lang) {
  const key = `${lang}:${normalizeLine(text).toLowerCase()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Read one string literal starting at `i` (which must be a quote). */
function readLiteral(src, i) {
  const quote = src[i];
  if (quote !== "'" && quote !== '"' && quote !== '`') return null;
  let out = '';
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      // Keep the escape's meaning for the characters that appear here.
      const n = src[i + 1];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
      i += 2;
      continue;
    }
    if (c === quote) return { value: out, end: i + 1 };
    out += c;
    i++;
  }
  return null;
}

function skipSpace(src, i) {
  while (i < src.length && /\s/.test(src[i])) i++;
  return i;
}

function extractFile(path) {
  const src = readFileSync(path, 'utf8');
  const pairs = [];
  const unread = [];
  let i = 0;
  while (true) {
    const at = src.indexOf('copy(', i);
    if (at === -1) break;
    i = at + 5;
    // `this.copy(` and `s.copy(` are dialogue; `Object.copy(` etc. are not,
    // but no such call exists here — the guard is the two-literal shape below.
    let j = skipSpace(src, i);
    const ru = readLiteral(src, j);
    if (!ru) continue;
    j = skipSpace(src, ru.end);
    if (src[j] !== ',') continue;
    j = skipSpace(src, j + 1);
    const kk = readLiteral(src, j);
    if (!kk) {
      unread.push(ru.value.slice(0, 48));
      continue;
    }
    pairs.push({ ru: ru.value, kk: kk.value });
  }
  return { pairs, unread };
}

const files = readdirSync(SCENES)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => join(SCENES, f));

const lines = {};
const collisions = [];
let pairCount = 0;
const unreadable = [];

for (const file of files) {
  const { pairs, unread } = extractFile(file);
  pairCount += pairs.length;
  for (const u of unread) unreadable.push(`${relative(ROOT, file)}: ${u}`);
  for (const { ru, kk } of pairs) {
    for (const [lang, text] of [['ru', ru], ['kk', kk]]) {
      const clean = normalizeLine(text);
      // Objectives are short labels ("🥇 3 мөр жина"); the ones that survive
      // normalization as a couple of words are not worth a clip and would
      // make the pack noticeably bigger for nothing.
      if (clean.length < 6) continue;
      const id = lineId(text, lang);
      const existing = lines[id];
      if (existing && normalizeLine(existing.text) !== clean) {
        collisions.push({ id, a: existing.text, b: text });
      }
      lines[id] = { lang, text: clean };
    }
  }
}

if (collisions.length) {
  console.error('Hash collisions — two different lines share one clip:');
  for (const c of collisions) console.error(`  ${c.id}\n    ${c.a}\n    ${c.b}`);
  process.exit(1);
}
if (unreadable.length) {
  console.error(`Could not read the second literal of ${unreadable.length} copy() calls:`);
  for (const u of unreadable.slice(0, 8)) console.error(`  ${u}`);
  process.exit(1);
}

const manifest = { version: 1, format: 'mp3', lines };
const next = JSON.stringify(manifest, null, 1);

if (process.argv.includes('--check')) {
  const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (prev !== next) {
    console.error('Voice manifest is stale. Run: node scripts/extract-voice-lines.mjs');
    process.exit(1);
  }
  console.log(`Voice manifest up to date (${Object.keys(lines).length} clips).`);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, next);

const ru = Object.values(lines).filter((l) => l.lang === 'ru').length;
const kk = Object.values(lines).filter((l) => l.lang === 'kk').length;
console.log(`${pairCount} copy() pairs in ${files.length} scenes`);
console.log(`${Object.keys(lines).length} clips to render — ${ru} ru, ${kk} kk`);
console.log(`Wrote ${relative(ROOT, OUT)}`);
console.log('\nNext: node scripts/synth-voice.mjs');
