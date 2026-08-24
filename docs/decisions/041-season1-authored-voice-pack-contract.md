# ADR 041 — Season 1 authored voice-pack contract

- Status: accepted
- Date: 2026-08-24
- Scope: Russian/Kazakh authored dialogue extraction, synthesis and obsolete-clip cleanup

## Analysis

The committed manifest contained 645 lines while the source-derived `copy()`
contract already required 718. The asset folders contained 707 MP3 files, so
the runtime had both missing selectable clips and files that no manifest entry
could ever select.

The stale manifest was not the whole problem. The extractor only scanned
two-literal `copy(ru, kk)` calls, but Season 1 also authors spoken events through
`say(ru, kk)`, `setBeat(ru, kk)`, `{ ru, kk }` story data and explicitly typed
localized tuple arrays. This omitted the snowman rescue beats, scarf search,
ice-sculpture milestones, squirrel story stops and Level 16's five personal
friend greetings even after an ordinary manifest refresh.

That gap is product-visible on Android. The browser often has no Kazakh voice;
when an authored clip is absent, the fallback may be silent or pronounce
Kazakh with an unsuitable voice. For a young player who cannot yet read the
subtitle, the story event effectively does not happen.

## Plan

1. Extend `scripts/extract-voice-lines.mjs` to cover every authored localization
   shape used by the scenes without adding a TypeScript parser dependency.
2. Reject dynamic-only template fragments that contain no useful sentence to
   synthesize.
3. Regenerate both languages with the installed Milena and Aru voices.
4. Add an opt-in, narrowly validated `--prune` pass to
   `scripts/synth-voice.mjs`; it may delete only generated eight-hex-id MP3s
   under `public/assets/voice/ru` and `public/assets/voice/kk` which are absent
   from the current manifest.
5. Verify source freshness, manifest/file parity, build gates and actual
   browser requests in both languages.

## Patch

- The extractor now scans `copy`, `say` and `setBeat` two-literal calls, paired
  `ru:`/`kk:` object properties and `Array<[string, string]>` authored data.
- A later literal `ru:` is a hard object boundary, so malformed data cannot be
  silently paired with the next object.
- Interpolated fragments with fewer than eight authored letters are excluded;
  this prevents text such as a bare `(ішінен)` connector from becoming a
  voice clip while retaining nickname-bearing sentences.
- `--prune` ignores unexpected filenames and unrelated assets. It only unlinks
  a generated MP3 when its id/language pair is not present in the manifest.
- The resulting pack contains 754 selectable clips: 381 Russian and 373
  Kazakh. There are zero missing files and zero orphan MP3s.
- The cleanup removed 114 obsolete generated clips (1,494.6 KB). Relative to
  the branch baseline, Git records 157 new and 110 deleted MP3s because some
  previously orphaned files became selectable again under the complete
  extractor.

From the player's perspective, the short authored consequences between quest
phases now speak in the selected language instead of silently falling through
to a device-dependent voice.

## QA route

1. `node scripts/extract-voice-lines.mjs --check` reports 754 up-to-date clips.
2. Compare the manifest with both language folders: require 754 files, zero
   missing ids, zero orphan ids and zero zero-byte files.
3. Probe representative generated clips with `ffprobe`; Russian
   `6412af02.mp3` is a valid 22.05 kHz mono MP3 lasting 2.617 s and Kazakh
   `3346bbce.mp3` lasts 3.323 s.
4. Run type-check, lint, production build and `git diff --check`. The only lint
   output remains the pre-existing Fast Refresh warning in `src/main.tsx`; the
   build keeps the pre-existing 561.81 kB Three vendor warning.
5. Desktop Chrome 1440×900, Level 16 Russian: click the real Play button and
   require manifest plus new intro/event clips to return `206 audio/mpeg` with
   zero console/page errors.
6. Mobile Chrome emulation 390×844, `?mission=16&lang=kk`: click the real Play
   button, require `documentElement.lang=kk`, visible joystick/jump controls,
   new Kazakh clips `7fe66c6f`, `2d9df0bb`, `d5c808df` at `206 audio/mpeg` and
   zero console/page errors.

## Known limit

Runtime values other than the player nickname can still make an interpolated
line miss a static clip id. Dynamic progress readouts should either be
deliberately non-narrated or given a finite authored variant set in a separate
accessibility package; this ADR closes static authored story/event lines and
does not claim arbitrary runtime speech synthesis is deterministic.
