# AUDIO-AUDIT

Дата: 2026-08-30. Проверка по коду/manifest и browser load; слуховая оценка не выполнялась.

## Current system

- `AudioManager` selects per-level music, SFX keys and RU/KK voice pack.
- Voice manifest is loaded early; missing clip falls back to browser TTS.
- Audio starts from first pointer/keyboard gesture for autoplay policy.
- Mute, volume and TTS settings persist locally.
- `voice:check` passes with 712 manifest clips; 720 MP3 files are present, 0 manifest entries
  are missing. 8 orphan files remain candidates for a separate deletion decision and were not
  removed automatically.

## Risks and actions

| Приоритет | Проблема | Доказательство | Рекомендуемая проверка |
|---|---|---|---|
| P1 | sound is part of L0 navigation | L0 objective says «иди на звук домбры» | run muted/no-audio fallback on device |
| P1 | TTS/voice quality unknown | no listening pass in this session | RU/KK native-speaker matrix |
| P1 | autoplay/first gesture | listeners in mission screens | first click, reload, mute persistence |
| P2 | voice drift risk | hash-named manifest + inline calls | `npm run voice:check` in CI |
| P2 | expected fallback log noise | `*_rigged.glb` attempts may warn | classify expected fallback as debug |
| P2 | reduced motion | particles/confetti/camera are mixed | verify motion/audio pairing with preference |

## Acceptance

No clipped/overlapping speech, correct language after switch, mute silences music/SFX/TTS,
level transition stops old music, missing clip does not create an unhandled exception.
