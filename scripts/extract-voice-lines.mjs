#!/usr/bin/env node
/**
 * Collect every line the game speaks, in both languages.
 *
 * The scenes write dialogue in three forms: direct localization calls such as
 * `this.copy('русский', 'қазақша')`, short-lived event helpers such as
 * `this.say(...)` / `this.setBeat(...)`, and authored `{ ru, kk }` data which
 * is selected later. The screens hand whichever half matches the current
 * language to `AudioManager.tts`, so the list has to be derived from every
 * form rather than maintained by hand. A hand-kept list goes stale the first
 * time somebody rewrites a line, and the symptom is a clip that says the old
 * words.
 *
 * Not a TypeScript parse: a small scanner reads two-literal localization
 * calls, paired `ru:` / `kk:` properties and explicitly typed localized tuple
 * arrays. It respects escapes and all three quote styles, including template
 * literals with `${nick}` in them, and fails loudly rather than silently
 * skipping a localized value it cannot read.
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

const LOCALIZED_CALLS = ['copy', 'say', 'setBeat'];

function extractCallPairs(src) {
  const pairs = [];
  const unread = [];
  for (const call of LOCALIZED_CALLS) {
    let i = 0;
    while (true) {
      const at = src.indexOf(`${call}(`, i);
      if (at === -1) break;
      i = at + call.length + 1;
      // Method definitions and unrelated calls do not begin with two string
      // literals, so the literal shape is the guard rather than a fragile
      // `this.` prefix check.
      let j = skipSpace(src, i);
      const ru = readLiteral(src, j);
      if (!ru) continue;
      j = skipSpace(src, ru.end);
      if (src[j] !== ',') continue;
      j = skipSpace(src, j + 1);
      const kk = readLiteral(src, j);
      if (!kk) {
        unread.push(`${call}(): ${ru.value.slice(0, 48)}`);
        continue;
      }
      pairs.push({ ru: ru.value, kk: kk.value });
    }
  }
  return { pairs, unread };
}

function extractPropertyPairs(src) {
  const pairs = [];
  const unread = [];
  const ruProperty = /\bru\s*:/g;
  let match;
  while ((match = ruProperty.exec(src))) {
    const ru = readLiteral(src, skipSpace(src, ruProperty.lastIndex));
    if (!ru) continue; // Type declarations such as `ru: string`.

    const tail = src.slice(ru.end);
    const kkMatch = /\bkk\s*:/.exec(tail);
    const nextRu = /\bru\s*:/.exec(tail);
    // Never pair a value with the next object when the current object is
    // malformed. A later literal `ru:` is a hard boundary.
    if (!kkMatch || (nextRu && nextRu.index < kkMatch.index)) {
      unread.push(`ru/kk object: ${ru.value.slice(0, 48)}`);
      continue;
    }
    const kkAt = ru.end + kkMatch.index + kkMatch[0].length;
    const kk = readLiteral(src, skipSpace(src, kkAt));
    if (!kk) {
      unread.push(`ru/kk object: ${ru.value.slice(0, 48)}`);
      continue;
    }
    pairs.push({ ru: ru.value, kk: kk.value });
    ruProperty.lastIndex = kk.end;
  }
  return { pairs, unread };
}

function matchingBracket(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
      const literal = readLiteral(src, i);
      if (!literal) return -1;
      i = literal.end - 1;
      continue;
    }
    if (src[i] === '[') depth++;
    if (src[i] === ']' && --depth === 0) return i;
  }
  return -1;
}

function extractTypedTuplePairs(src) {
  const pairs = [];
  const unread = [];
  const declaration = /Array<\[\s*string\s*,\s*string\s*\]>\s*=\s*\[/g;
  let match;
  while ((match = declaration.exec(src))) {
    const open = declaration.lastIndex - 1;
    const close = matchingBracket(src, open);
    if (close < 0) {
      unread.push('localized tuple array: missing closing bracket');
      continue;
    }
    let i = open + 1;
    while (i < close) {
      const pairOpen = src.indexOf('[', i);
      if (pairOpen < 0 || pairOpen >= close) break;
      let j = skipSpace(src, pairOpen + 1);
      const ru = readLiteral(src, j);
      if (!ru) { i = pairOpen + 1; continue; }
      j = skipSpace(src, ru.end);
      if (src[j] !== ',') { i = ru.end; continue; }
      const kk = readLiteral(src, skipSpace(src, j + 1));
      if (!kk) {
        unread.push(`localized tuple: ${ru.value.slice(0, 48)}`);
        i = ru.end;
        continue;
      }
      pairs.push({ ru: ru.value, kk: kk.value });
      i = kk.end;
    }
    declaration.lastIndex = close + 1;
  }
  return { pairs, unread };
}

function extractFile(path) {
  const src = readFileSync(path, 'utf8');
  const extracts = [
    extractCallPairs(src),
    extractPropertyPairs(src),
    extractTypedTuplePairs(src),
  ];
  return {
    pairs: extracts.flatMap((result) => result.pairs),
    unread: extracts.flatMap((result) => result.unread),
  };
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
      const authoredLetters = text
        .replace(/\$\{[^}]*\}/g, '')
        .replace(/[^\p{L}]/gu, '');
      // Objectives are short labels ("🥇 3 мөр жина"); the ones that survive
      // normalization as a couple of words are not worth a clip and would
      // make the pack noticeably bigger for nothing.
      if (clean.length < 6) continue;
      // A dynamic-only event such as `${strain} (${done} ішінен
      // ${total})` has no useful sentence to synthesize at build time. Keep
      // nickname-bearing sentences and authored progress feedback, but do not
      // render connector words and punctuation as a standalone clip.
      if (text.includes('${') && authoredLetters.length < 8) continue;
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
console.log(`${pairCount} localized pairs in ${files.length} scene files`);
console.log(`${Object.keys(lines).length} clips to render — ${ru} ru, ${kk} kk`);
console.log(`Wrote ${relative(ROOT, OUT)}`);
console.log('\nNext: node scripts/synth-voice.mjs');
