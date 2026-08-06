/**
 * Identity of a spoken line, shared by the build script and the browser.
 *
 * The game currently speaks through `window.speechSynthesis`, which hands the
 * job to whatever voice the operating system happens to have. On a Kazakh
 * phrase that is usually nothing at all — Android ships no `kk-KZ` voice — so
 * half the audience gets silence or a Russian voice mangling Kazakh. Neither
 * is acceptable in a game whose players are five and cannot read the line
 * they are missing.
 *
 * The lines are a fixed, known set, so they should be rendered once, checked
 * once, and shipped as files. This module is the contract between the two
 * halves of that: the extractor names a clip, the player looks up the same
 * name. It has no dependencies for exactly the reason the moderation filter
 * has none — a second copy of the naming rule that drifts from the first is
 * a bug that produces silence, and silence is hard to notice in a test.
 */

/**
 * Everything that must be identical between "the text we rendered" and "the
 * text we are about to speak".
 *
 * Interpolations are dropped rather than rendered. `Собери печати, ${n}.`
 * cannot be one clip, because `n` is whatever the child typed at the start.
 * A recorded voice that skips the name is normal in children's games; the
 * alternative is falling back to the robot for every line that greets them,
 * which would be most of them.
 */
export function normalizeLine(input: string, nick?: string): string {
  let s = input;
  // At build time the interpolation is still `${n}` and disappears with the
  // rule below. At run time it is already the child's name, and nothing in
  // the string marks it as one — so the caller has to say what the name is.
  // Without this, every line that greets the player missed its clip and fell
  // back to the browser: caught by fetching the bytes rather than trusting a
  // 200, since a dev server answers 200 with index.html for anything.
  if (nick && nick.trim().length > 1) {
    const esc = nick.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`(?<![\\p{L}])${esc}(?![\\p{L}])`, 'giu'), '');
  }
  return s
    // Interpolations, both the source form and anything already substituted
    // into a nickname slot.
    .replace(/\$\{[^}]*\}/g, '')
    // Punctuation left stranded by the removal: ", ." or " ,"
    .replace(/\s*,\s*([.!?])/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/,\s*$/g, '')
    // Emoji and pictographs are on objectives, not on dialogue, but a stray
    // one must not change a clip's identity.
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * FNV-1a, 32-bit, hex. Small, dependency-free, identical in Node and the
 * browser. Collisions are checked for at extraction time rather than assumed
 * away — with a few hundred lines the odds are tiny, but a collision here is
 * one character saying another character's line.
 */
export function lineId(text: string, lang: 'ru' | 'kk', nick?: string): string {
  const key = `${lang}:${normalizeLine(text, nick).toLowerCase()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Written by scripts/extract-voice-lines.mjs, read by AudioManager. */
export interface VoiceManifest {
  version: number;
  /** File extension the clips were rendered to, without the dot. */
  format: string;
  /** id → the text it was rendered from, for debugging a wrong clip. */
  lines: Record<string, { lang: 'ru' | 'kk'; text: string }>;
}

export const VOICE_BASE = '/assets/voice/';
