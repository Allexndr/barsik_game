# S1 Board — общая доска отдела

> Агенты **читают и обновляют** этот файл. Lead держит приоритеты.  
> Ветка работы: `levels-premium-pass` (без новых worktrees, если можно).  
> Правила: `CLAUDE.md` · Style Lock · **не** Supabase write · **не** force-push.

## Sprint goal (меняет человек или lead)

```
До soft-launch: закрыть P0/P1 из docs/S1_REMAINING_SPEC.md
(deploy xi, hub RLS, ambient rigged, mobile QA, KK вычитка).
```

**Актуальное ТЗ остатка:** [`docs/S1_REMAINING_SPEC.md`](S1_REMAINING_SPEC.md) · **Готовность S1:** [`docs/S1_READINESS_STATUS.md`](S1_READINESS_STATUS.md) (2026-08-31).
Board = claim/Done; SPEC = полный перечень по дизайну / LD / тестам / ops / коду.

## How to claim (протокол)

1. Прочитай этот файл целиком.
2. Возьми **одну** задачу из `Todo` своей роли (или `Unassigned`, если подходит зона).
3. Перенеси в `In progress` со своим именем и timestamp.
4. Сделай small diff · `npx tsc --noEmit` если код.
5. В `Done` — 1–3 строки что изменил + пути файлов.
6. Если застрял >15 мин — в `Blocked` + тег `@barsik-lead` / `@barsik-review`.
7. **Не сиди idle:** после Done сразу бери следующую из Todo своей роли. Если Todo пуст — предложи 2 кандидата в секцию `Ideas` и жди kick / lead.

## Roles → зоны

| Role | Может трогать |
|------|----------------|
| lead | только `docs/S1_*.md`, этот board |
| levels-forest | Mission1/2/4/5/6/8/9, Level3, Level7 |
| levels-ice | Mission10–16 |
| hub-ui | `src/components/**` |
| qa | docs QA + точечные soft-lock фиксы |
| perf | `renderQuality.ts`, BaseLevelScene quality |
| audio-i18n | strings RU/KK, SFX wiring, notes |
| review | notes only (код — только микрофикс по согласованию lead) |

## Todo

Приоритет по `S1_COMPLETION_PLAN.md`: P0 везде закрыт (0/17 soft-lock,
подтверждено §32), длительность закрыта по всем 17 уровням (§29/§33). Весь
список ниже — P1/P2.

- [x] `ops` · P0 — Hub realtime **выкл по умолчанию** (`VITE_HUB_REALTIME`);
      включить только после `city_chat.sql` + RLS. См. `docs/S1_QA_A1.md`.
- [x] `levels-forest`+`levels-ice` · P1 — camera cinematic-intro guard
      (`hasTakenFirstStep`) был только на L1/L2/L8/L16 — распространил на
      оставшиеся 13 (`L0,L3–L7,L9–L15`). См. `Done` и `docs/S1_AUDIT_2026-08-25.md`.
- [x] `levels-forest` · P1 — L1/L2/L8 camera: cinematic intro только до
      `hasTakenFirstStep` (фикс `hero-off-frame`). L8 placement 5/3/4 + celebrate
      уже в коде.
- [x] `levels-ice` · P1 — L14 warmth bar в objective; L16 chest marker snapToGround.
- [x] `hub-ui` · SettingsModal contrast (`smodal-*`); map pin hover без scale-jitter;
      Welcome landing brand-first + flow + sticky CTA.
- [x] `qa` · A1: `?fps=1`, `?qa=1` → `__qaErrors()`, fixtures `docs/qa/save-fixtures.json`,
      гайд `docs/S1_QA_A1.md`; screenshot matrix, reload awards и 17-level audit
      подтверждены локально. Device/runtime evidence остаётся внешним gate.
- [x] `qa` · Screenshot matrix desktop/mobile × RU/KK (L0/L1/L8/L16) — done,
      found+fixed a real bug. Reload-awards — done, see `Done` below.
- [x] `perf` · P2 — tier-scale grass (`grassCountForTier`) + AvatarPreview → renderQuality.
- [x] `polish` · Brand canon `photos/` + outfit tubeteika; L0 quality yurt/dombra
      hooks; butterfly/cloud quality upgrade; cast remesh (hedgehog…bird); leaderboard
      nick filter on read. (felt panels / stepping stones stay procedural — gameplay sockets)
- [ ] `lead` · держать этот порядок актуальным после каждого нового `Done`
      (living task, не закрывается сама по себе).

## Remaining outside code (не блокируют «добить S1 в репо»)

Полный список + критерии → **`S1_REMAINING_SPEC.md`** §2 / §7 / §9.

| Что | Кто | ID в SPEC |
|-----|-----|-----------|
| CLI deploy xi = `main` (Welcome Hallmark) | owner + Vercel | ~~P0-OPS-1~~ ✅ 2026-08-31 |
| `city_chat.sql` + Realtime RLS → `VITE_HUB_REALTIME=1` | владелец Supabase | P0-OPS-2 |
| Leaderboard **write** (сейчас read-only) | confirm + edge function | P1-OPS-3 |
| Cloud save reconciliation | confirm | P1-OPS-4 |
| Ambient `squirrel/bird_rigged` over budget | 3D | P0-3D-1: static LOD + disposal в коде; visual/device confirm |
| Живой телефон matrix + L1 portrait bridge | QA / forest | P1-QA-2, P1-LD-1 |
| Rigged `barsik.glb` / проф. KK VO / реальный QR | бренд / vendor | EXT-1…3 |
| KK-вычитка носителем | носитель | P1-AUD-1 / EXT-4 |

## Blocked

- [x] `vercel.json` Cache-Control на `/assets/(.*)` —
      **accepted**: `max-age=86400, must-revalidate` (не immutable; фикс битых
      ассетов после деплоя). `/js`/`/css` headers сняты вместе с legacy.

## In progress

_(пусто — локальный A1 harness и regression закрыты; внешние device/ops gates остаются.)_

## Done

- [x] `perf`/`content` (claude, 2026-08-26) · Decimated the two long-standing
  oversized ambient critters flagged by `s1Place.ts`'s own comment
  (`placeAmbientCritters` skips anything over `AMBIENT_TRIANGLE_BUDGET` —
  12 000 tris — rather than pay for it; the comment cites the L10 rabbit as
  the motivating example). `squirrel.glb` was 19 882 tris (Blender count)/
  12 898 verts, `bird.glb` 13 446/9 444 — both silently excluded from every
  level that places them. Decimated via headless Blender
  (`bpy.ops.object.modifier_apply` on a `DECIMATE` modifier, ratio picked
  per-file to land under 9 000) and re-exported Draco-compressed:
  squirrel → 9 000 tris/7 323 verts, bird → 8 999/7 221. Rendered a fixed-
  camera before/after PNG for each in the same Blender pass before touching
  the real files — indistinguishable at this style's texture-carries-the-
  shading resolution, both saved to the scratchpad for the record. Verified
  the dev server serves the new bytes (direct `curl` + `probe-glb.mjs`
  vertex count) before calling it done, not just the file-on-disk change.
  Files: `public/assets/models/chars/{squirrel,bird}.glb`.

  **Follow-up fix (2026-08-30):** the rigged pair remains ~26k tris and is
  intentionally kept for interactive characters. `placeAmbientCritters` now
  requests the static LOD explicitly, so ambient squirrel/bird placements use
  the remeshed sub-9k assets; any future over-budget fallback is disposed
  immediately instead of retaining GPU resources. L0/L8 boot and full browser
  regression pass; visual/device confirmation remains open.

- [x] `qa`/`lead` (2026-08-31) · После последних race/lifecycle правок повторно
  прогнаны локальные проверки: Vitest 17/17, client/API TypeScript, lint без
  ошибок, voice manifest 712/712, clean temporary Vite build и Playwright
  полный suite 64/64 в одном worker (Chromium 63 + mobile 1): baseline 25/25,
  gameplay 17/17, device matrix 18/18 и perf 4/4. Добавлены локальные
  progression/admin integration tests с auth refresh/rejection/identity cases,
  внешний `PLAYWRIGHT_BASE_URL` harness, `?qa=1` assertion и dev-only FPS
  samples (`window.__fpsSamples()`). Файлы: `tests/net/`, `tests/api/`,
  `tests/fps-sampler.test.ts`, `playwright.config.ts`, `src/dev/fpsSampler.ts`.
  Staging Supabase fixtures, full gameplay golden path и real-device FPS/memory
  остаются открытыми и не подменены локальными/headless тестами.

- [x] `audio-i18n` (claude, 2026-08-25) · Rendered the one TTS line that lived
  outside `src/three/scenes/*.ts` and so was invisible to
  `extract-voice-lines.mjs`: `SettingsPanel.tsx:43`'s
  `AudioManager.tts(ru ? 'Озвучка включена' : 'Дауыс қосылды', lang)`. Took
  the small-diff option from the `Ideas` writeup rather than teaching the
  extractor a new pattern for one call site. Computed the manifest ids by
  hand with the exact `lineId`/`normalizeLine` algorithm the extractor and
  `AudioManager` both use (`75b53287` ru, `30896e17` kk — verified this
  call passes no `nick`, so the nick-stripping branch in
  `voiceLines.ts:normalizeLine` never engages for this text and the 2-arg
  hash is correct), added both entries to `manifest.json`, ran
  `node scripts/synth-voice.mjs` (rendered exactly these 2, kept the other
  712). No code change needed — `AudioManager.tts()` already checks the
  manifest before falling back to browser TTS, by id, so the existing call
  site picks up the new clips automatically. Traced the full runtime path
  (`tts()` → `lineId()` match → `new Audio('/assets/voice/ru/75b53287.mp3')`)
  against the file on disk rather than trusting it; did not additionally
  verify by ear. Files: `public/assets/voice/manifest.json`,
  `public/assets/voice/built.json`, `public/assets/voice/{ru,kk}/*.mp3`.

- [x] `qa` (claude, 2026-08-25) · Reload-after-reward for L0/L5/L9/L16.
  Rather than playing each level through by hand (slow, and mostly
  re-exercises the same shared `completeLevel` reducer four times), added a
  dev-only `window.__gameStore` exposure (`useGameStore.ts`, same pattern as
  `window.__level`) and drove the real reducer directly — this tests the
  actual double-award-prevention logic itself, not just whether a crafted
  `localStorage` blob reloads back unchanged. Sequence: clear save → fresh
  state (0/{}/[]) → `completeLevel(0,{stars:3,friendId:'gardener'})` →
  reload → state intact → replay same score (3) → **unchanged**, no
  duplicate friend → replay better (5) → **+2 only**, not +5 → replay worse
  (2) → **unchanged**, best-of-3 kept. Then `completeLevel(5,…)` and
  `completeLevel(9,…)`, reload, both intact alongside L0 with no cross-
  contamination between per-level entries. Then `completeLevel(16,…)` →
  `season1Complete` flips `true` (matches the `levelId >= 16` condition in
  the reducer) → reload → still `true`. Also read the call sites
  (`Mission0Screen.tsx:83`, `MissionScreen.tsx:87`) — both go through a
  `savedOutroRef` one-shot guard before ever calling `completeLevel`, so
  there are two independent layers against double-awarding, not one.
  Cleared the test save after. No bug found — mechanism is sound. File:
  `src/store/useGameStore.ts` (+7 lines, dev-only).

- [x] `qa` (claude, 2026-08-25) · Screenshot matrix desktop 1280×720 / mobile
  390×844 × RU/KK for L0/L1/L8/L16 (16 combinations, all reviewed visually).
  Found and fixed a real bug along the way: `.loading-overlay` (
  `LoadingOverlay.css`) had `pointer-events: none` on the full-viewport
  wrapper with only `.loading-overlay__card` re-enabling it for itself —
  nothing else in the tree needed the wrapper to be click-through, so a tap
  anywhere on the loading screen *outside* the centered card (most of a
  phone's screen — the card only covers roughly the middle third)
  fell straight through to the level's own HUD buttons already mounted
  underneath (dialogue nav arrows, etc.), invisibly to the child looking at
  what they think is an inert "loading" screen. Confirmed via
  `document.elementFromPoint()` before/after (the correct way to test
  `pointer-events`; a `computer`-tool click landing on the same coordinate
  proves nothing here since click-through is exactly the bug). Removed the
  blanket `pointer-events: none`; card behavior unaffected, hit-test now
  correctly returns the overlay div outside the card. File:
  `src/components/ui/LoadingOverlay.css`. `npx tsc --noEmit` + `npm run
  build` clean.

  Also confirms in passing that the earlier camera-guard fixes (13 levels,
  see below) hold visually, not just per `__audit()`: L8's lanterns/
  fireflies and L16's un-buried waiting-friend + trail arrows all frame
  correctly in these same screenshots.

  Two minor, **not acted on**, findings for whoever picks up polish next:
  (1) KK level-title pill truncates harder than RU on mobile (`.m0-title`,
  `Mission0Screen.css:28`) — e.g. "Қысқы QR-сандық · Сынақшы" clips to
  "...Сына..." at 390px. The `white-space: nowrap` + ellipsis there is a
  **deliberate** prior decision (see the comment on that rule — a wrapped
  pill "reads as a broken banner"), so I did not touch it; flagging only
  because KK strings run longer and eat into that budget faster than RU
  did when the tradeoff was made. (2) Portrait levels leave a large unused
  band at the bottom of a 390×844 frame below the playable action (most
  visible on L0/L1) — the game already nudges players toward landscape
  with an in-level hint ("Телефонды бұрсаң, көбірек көрінеді"), so this
  looks like a known, accepted tradeoff rather than an oversight; noting
  in case it's worth a second look.

  Environment note for whoever runs this next: the `computer`-tool click on
  the mobile-emulated Play button reliably timed out ("pane is hidden") in
  this session, even on a fresh tab with nothing else going on — the click
  itself always landed (confirmed via `window.__level` state), only the
  *subsequent* screenshot then hung on a stale pre-click frame. Calling
  `.click()` on the button element directly via the JS-eval tool sidesteps
  it cleanly and was used for all mobile shots in this pass. Might be
  specific to this session's tooling rather than the game.

- [x] `levels-forest`+`levels-ice` (claude, 2026-08-25) · Full-season live
  audit + systemic camera fix. `__audit()`'s own camera check was blind:
  `devTeleport()` (used by both the QA sweep and `?at=`) never set
  `hasTakenFirstStep`, so any level gating its intro cinematic on that flag
  read as permanently `hero-off-frame` regardless of the real follow
  camera. Fixed `devTeleport` first (`BaseLevelScene.ts`), which then
  exposed the real bug it had been masking: only L1/L2/L8/L16 had the
  `phase === 'intro' && !hasTakenFirstStep` guard — the other 13 levels
  (`L0,L3,L4,L5,L6,L7,L9,L10,L11,L12,L13,L14,L15`) had a bare
  `phase === 'intro'`, so a child moving immediately kept the camera
  locked to the fixed reveal shot for the whole intro timer. Severity
  varied wildly by level (`worst |x|` vs. the 1.0 frame edge: L4 850.4,
  L5 475.3, L3 68.7, down to L9 1.47) — same bug, different intro-camera
  geometry per level. Applied the identical one-line guard to all 13.
  Also fixed 2 unrelated real bugs the sweep surfaced: L9's chest lock +
  3 shrine seals rendered solid black (`metalness` 0.65–0.7 with no
  `envMap` in this engine — same class already fixed on L16 earlier this
  session); L4's 44 flagged "buried" props investigated and confirmed
  benign (canyon rocks under the rope bridge, not a bug). Full per-level
  before/after table, false-positive writeups, and untouched meta-game
  spot-checks (mute/TTS persistence, leaderboard XSS-safety, QR screen
  purchase-pressure) in `docs/S1_AUDIT_2026-08-25.md`. Files: `BaseLevelScene.ts`
  + 13 `Level*Scene.ts`. `npx tsc --noEmit` + `npm run build` clean; every
  one of the 17 levels re-verified live post-fix via `__audit()`. Landed in
  the tree via a later commit from another session (`f14d3cd` or nearby) —
  confirmed present and intact after the fact, not lost.

- [x] `hub-ui` · TravelMap portrait polish

- [x] `levels-forest`+`levels-ice` (claude, 2026-08-25) · Full-season live
  audit + systemic camera fix. `__audit()`'s own camera check was blind:
  `devTeleport()` (used by both the QA sweep and `?at=`) never set
  `hasTakenFirstStep`, so any level gating its intro cinematic on that flag
  read as permanently `hero-off-frame` regardless of the real follow
  camera. Fixed `devTeleport` first (`BaseLevelScene.ts`), which then
  exposed the real bug it had been masking: only L1/L2/L8/L16 had the
  `phase === 'intro' && !hasTakenFirstStep` guard — the other 13 levels
  (`L0,L3,L4,L5,L6,L7,L9,L10,L11,L12,L13,L14,L15`) had a bare
  `phase === 'intro'`, so a child moving immediately kept the camera
  locked to the fixed reveal shot for the whole intro timer. Severity
  varied wildly by level (`worst |x|` vs. the 1.0 frame edge: L4 850.4,
  L5 475.3, L3 68.7, down to L9 1.47) — same bug, different intro-camera
  geometry per level. Applied the identical one-line guard to all 13.
  Also fixed 2 unrelated real bugs the sweep surfaced: L9's chest lock +
  3 shrine seals rendered solid black (`metalness` 0.65–0.7 with no
  `envMap` in this engine — same class already fixed on L16 earlier this
  session); L4's 44 flagged "buried" props investigated and confirmed
  benign (canyon rocks under the rope bridge, not a bug). Full per-level
  before/after table, false-positive writeups, and untouched meta-game
  spot-checks (mute/TTS persistence, leaderboard XSS-safety, QR screen
  purchase-pressure) in `docs/S1_AUDIT_2026-08-25.md`. Files: `BaseLevelScene.ts`
  + 13 `Level*Scene.ts`. `npx tsc --noEmit` + `npm run build` clean; every
  one of the 17 levels re-verified live post-fix via `__audit()`. Landed via
  another session's commit (confirmed present in the tree afterward, not
  lost — see the entry above for how that was checked).

- [x] `hub-ui` · TravelMap portrait polish — visual-bug audit (Playwright
  screenshots at 390×844, `?tab=travel`) found a real clipping bug: the
  purple "here" paw badge floats 44px above the current pin, but
  `clampCenter` never scrolls the camera past the chapter art's own top
  edge. On level 1 — the very first pin, right at that edge — the badge's
  bubble crossed above the visible frame and rendered half off-screen on
  every load (first thing a new/returning player sees). Fixed by scaling
  the badge down, anchored at its tip (which already sits on the pin), only
  when its bubble would cross the same top bound the camera is clamped to
  — full size everywhere else (checked level 6 mid-map and level 17
  bottom-of-map, both unaffected). Also accounted for the `pin-here-float`
  CSS bob animation (6px amplitude) so it doesn't re-clip at the top of its
  bob, and moved the scale onto a wrapper `<g>` since a transform attribute
  on the same element as the CSS animation would've been overridden by it,
  not composed. Verified via cropped screenshot strip across the full 2s
  animation cycle — badge stays fully visible and never covers the pin's
  "1" label. Welcome screen (hero + world cards) checked at the same
  viewport, no analogous issues found. File:
  `src/components/screens/TravelMapScreen.tsx`. `npx tsc --noEmit` чисто.

- [x] `levels-ice` · L10 «Прощание с лесом» — visual-bug audit нашёл
  реальный класс багов: объекты ставились на мировой `y = 0`/константу
  вместо `groundHeightAt`, хотя терраса вокруг спавна и большинства мест
  прощания НЕ плоская (`flat`-feature в `LevelTerrain.ts` даёт 0%
  выравнивания на `dist == r` и растёт к центру — на `r = 20` ровно спавн
  (0,6) и место белочки (12,-30)). План уже мерил это для `spawnPad`
  (§«То же самое, но у платформы спавна» — «L10: +2.16 м, была под
  землёй»), но фикс в код не попал. Нашёл и починил: `spawnPad` и его
  `zoneDisc` на спавне, `giftPile` + его `zoneDisc`, все 5 `questMarker`
  мест прощания (создание **и** покадровая перезапись `position.y =
  sin(...)`, которая каждый кадр возвращала маркер на мировой ноль), NPC
  на местах прощания (`groundY()` без базы = мировой ноль), `exitMarker`
  у выхода из леса, glowing trail между местами (соединял точки на разной
  высоте по прямой на абсолютной `y = 0.04` — часть кружков плавала в
  воздухе/утопала в снегу), и `spot.pos.y` (было 0 — паразитный
  вертикальный оффсет в 3D `distanceTo` для интеракции на возвышенных
  местах). Файл: `src/three/scenes/Level10Scene.ts`. `npx tsc --noEmit`
  чисто; браузерная проверка скриншотом не выполнена — Playwright
  недоступен в этом окружении (нет прав поставить пакет), проверено
  только математикой рельефа и структурой кода. Стоит перепроверить
  визуально при следующей возможности.
- [x] `review` · прочитал `Done` за спринт (`5742de9` perf auto-low-tier,
  `shadowCasterMinHeight`+`setupFireflies` tier scaling, L11 snowman stages,
  lead's board reorg) против реального `git show`/`git diff` — все четыре
  **подтверждены дословно**, расхождений с описанием на борде нет. Заодно
  прогнал `npx tsc --noEmit` по текущему незакоммиченному дереву (чисто) и
  прочитал весь live-diff (41 файл): 4 параллельных WIP-зоны без конфликтов
  файлов друг с другом (levels-ice/Level14Scene.ts маркер-фикс, levels-forest/
  Mission1Scene.ts `placeMany→placeProps`, audio-i18n/manifest.json,
  hub-ui/WelcomeScreen+TravelMap cache-busting) — все консистентны с
  `CLAUDE.md`. Нашёл 1 неотфлаженный конфликт — `vercel.json` Cache-Control
  даунгрейд на весь `/assets/(.*)` (см. `Blocked` выше) — и подтвердил, что
  находка `arbatProps.ts` (facade styles) уже поймана lead'ом и не требует
  дублирования. Файл: `docs/S1_AGENT_REVIEW.md` (новый). Код не трогал.
- [x] `audio-i18n` · KK fallback audit + voice-pack sync (no silent RU VO) —
  прошлый проход (`worktree-audio-i18n-audit`, не влит в эту ветку) нашёл,
  что RU/KK текст и озвучка **не путаются местами** (гарантия по
  конструкции: `lang` в `MissionScreen`/`Mission0Screen` управляет и
  текстом, и `AudioManager.tts`, смена языка пересоздаёт сцену) — но
  голосовой пак отстал от сцен на 46 RU + 46 KK реплик (юрта/домбра/сад,
  хаб/город), которые до синтеза молча уходили в `speakWithBrowser` (для
  KK на Android — тишина или транслитерация русским голосом). В этом
  проходе: `node scripts/extract-voice-lines.mjs` (manifest 645→714
  клипов) + `node scripts/synth-voice.mjs` (дорендерил недостающее,
  включая 3 клипа, не покрытых первым прогоном) — теперь 714/714, 0
  missing. Удалил 85 осиротевших `.mp3` (43 ru + 42 kk). Добавил
  `voice:check` в `package.json` (не в `build` — нет CI, другие роли
  активно правят `copy()` в сценах прямо сейчас). Файлы:
  `public/assets/voice/manifest.json`, `public/assets/voice/{ru,kk}/*.mp3`,
  `package.json`, `docs/S1_AUDIO_I18N_NOTES.md`. Коммит `c0fabcd`.
  `npx tsc --noEmit` — 2 предсуществующих `TS6133` в `Level11Scene.ts`
  (`levels-ice` зона, не мои файлы, не трогал); все остальные файлы чисты.
  `Todo` для `audio-i18n` сейчас пуст — 2 кандидата добавлены в `Ideas`.
- [x] `lead` · сверил `Todo` с `S1_COMPLETION_PLAN.md` (P0 закрыт, длительность
  закрыта §29/§33) и с живым `git status`. Нашёл некоммиченный диф вне
  всех текущих claim'ов — `src/three/scenes/hub/arbatProps.ts` (три стиля
  фасада `classic/flat/attic`, +146 строк, выглядит завершённым) — добавил
  в `Todo` для `hub-ui` с пометкой «не откатывать, не терять». Забрал обе
  готовые `perf`-Ideas в `Todo` как kick. Добавил `qa` next-step: точечный
  claim закрывает только часть этапа A1 плана, систематическая
  QA-инфраструктура (console-error collector, FPS sampler, screenshot
  matrix, save fixtures) ещё не начата нигде. `npx tsc --noEmit` на срезе
  застал `Level11Scene.ts` с `TS6133` (unused `snowmanParts`/`snowmanStage`)
  — это было `levels-ice` в процессе правки L11, к моменту повторной
  проверки уже чисто (см. их `Done` ниже). Файл: `docs/S1_BOARD.md`.
- [x] `levels-ice` · L11 «Первые снежинки» — snowman grows in readable
  stages (план §6, D/L11). Было: непрерывный `scale.setScalar` от 0.4 до
  1.05 линейно по числу пойманных снежинок — для ребёнка это незаметный
  крип, а не рост. Стало: 3 читаемых шага (база → +торс → +голова для
  процедурного снеговика без GLB; для `snowman.glb` — те же 3 шага
  фиксированным scale 0.45/0.7/1.0, т.к. частей нет). На каждом переходе
  стадии — `spawnSparks` у снеговика + sfx `sparkle`, чтобы рост был
  заметен, а не только виден постфактум. Файл:
  `src/three/scenes/Level11Scene.ts` (`makeSnowman`, `updateSnowman`,
  новые поля `snowmanParts`/`snowmanStage`). Spawn-логика/доступность
  снежинок не трогал — уже закрыто §29. `npx tsc --noEmit` чисто.
- [x] `perf` · закрыл обе идеи из очереди — `shadowCasterMinHeight` и
  `setupFireflies` tier scaling. `RenderQualityProfile` получил
  `shadowCasterMinHeight` (`low: 1.0`, `medium`/`high: 0.5`);
  `demoteSmallShadowCasters` в `BaseLevelScene.ts` читает его вместо
  хардкод-константы `SHADOW_CASTER_MIN_HEIGHT` (удалена). `setupFireflies`
  default теперь `renderQuality.tier === 'low' ? 16 : isMobile ? 28 : 52`
  вместо `isMobile ? 28 : 52` — слабый телефон (уже детектится как `low`
  в `resolveRenderQualityTier`) получает меньше частиц вместо тех же 28,
  что и обычный mobile `medium`. Файлы: `renderQuality.ts`,
  `BaseLevelScene.ts`. Заметки: `docs/S1_PERF_NOTES.md`. `npx tsc --noEmit`
  чисто. `Ideas` для `perf` теперь пуст — see `Ideas` section, жду kick/lead.
- [x] `lead` · реорганизовал Todo по приоритетам из `S1_COMPLETION_PLAN.md`
  (P0 закрыт целиком — 0/17 soft-lock, §32 — весь список теперь P1/P2 с
  привязкой к конкретным пунктам плана). Забрал обе `perf`-идеи из очереди
  в Todo вместо ожидания. Добавил очередь на следующий заход для
  `levels-forest` (L8) и `levels-ice` (L11) — на момент правки оба уже
  разобрали свой P1-Todo (L2/L4/L5 и L14/L16). Файл: `docs/S1_BOARD.md`.
- [x] `perf` · mobile pixelRatio/shadows note + 1 safe cap — `renderQuality.ts`:
  `resolveRenderQualityTier` теперь детектит слабый телефон
  (`deviceMemory<=3GB` или `hardwareConcurrency<=4`, только mobile) и сразу
  роняет тир в `low`, без `?quality=low`. Профиль `low` получил `antialias:
  false` (composer и так выключен на low, MSAA — единственная лишняя GPU-
  стоимость) и `shadowSoft: false` → `PCFShadowMap` вместо
  `PCFSoftShadowMap` (single-tap вместо 5×5 poisson, тени остаются видимыми).
  `medium`/`high` не тронуты. `BaseLevelScene.ts` читает оба флага из
  профиля вместо хардкода. Заметки: `docs/S1_PERF_NOTES.md`. Коммит
  `5742de9` (cherry-pick с `worktree-perf-render-quality`, где работа была
  сделана раньше, но не влита в `levels-premium-pass`). `npx tsc --noEmit`
  чисто.
- [x] `qa` (claude, 2026-08-29) · Human-eye QA pass requested by the human:
  play through every level, fix what would look bad/buggy to a player. The
  Browser pane kept dropping frames mid-session ("not compositing frames"),
  so screenshots were unreliable; built a headless substitute instead —
  drives `devTeleport` + a manual `clock.getDelta` override across a grid of
  interior play-area points (not just `__audit()`'s 4 corners), converges
  the follow camera at each via ~150-220 forced `loop()` ticks, then tests
  whether the camera's own position falls inside any mesh's world-space
  AABB (excluding meshes parented under `L.camera` itself — first pass
  flagged L7/L8's camera-attached photo-flash mesh as a false positive,
  since anything rigidly attached to the camera trivially contains the
  camera's position everywhere). Caught two real bugs a corner-only sweep
  can't see, both verified fixed by re-running the same probe after the
  edit, not just by reasoning about the diff:
  - **L3** (`Level3Scene.ts`): the hand-placed `oldOak` landmark tree sat at
    `(0, -11.5)`, dead‑centre on the path's own x-axis. The follow camera's
    formula target for this level trails the hero by `+9` in z at roughly
    the same x, so with the hero around `z≈-18to-20` the camera converges
    to a position measured *inside* the oak's canopy mesh. Purely
    decorative (grepped — no mission/hint logic reads its position), so
    moved it to `x=-4.5` (off the path axis) and its collider with it.
    Confirmed clean across the whole corridor (`z=-6` to `-28` in steps of
    2) after the move; previously this exact range was untested by
    `__audit()`, which only walks the 4 play-area corners.
  - **L6** (`Level6Scene.ts`): the "red" magic tree (`TREES[0]`, one of
    exactly three riddle-answer trees — its `x/z` *and* `height` both
    encode riddle answers per the file's own doc comment, so neither could
    move) sits where the camera's trailing offset lands whenever the hero
    is anywhere near `x≈-13` and `z≈-17` — up to 10m short of the tree
    itself, well inside the area the hedgehog riddle sends the player to
    search. Added `avoidTreeCanopies(x,z)`, a small level-local helper that
    nudges only the camera's lateral target sideways when it would land
    inside a `TREES` canopy radius — hero position, tree position/height,
    and all riddle logic untouched.

  Both fixes are intentionally **level-local**, not changes to the shared
  `loadTrees()`/camera-follow code in `BaseLevelScene.ts`: the broader
  pattern (follow-camera trailing offset has no scenery-avoidance at all)
  showed up again as *non-deterministic* `Math.random()`-placed ambient
  trees clipping the camera at the edge of the play area on **L6**
  (`tree_fat`, corner, didn't reproduce on a second fresh load), **L7**
  (`tree_fat` at one of the four Putalo hide-spots — same random-placement
  class), **L9** (8 hits, all `tree_pineTallA_detailed`/`tree_detailed` at
  the exact map edges `x=±28`/`z=-51`), and **L16** (`tree-snow-a`, 2 of 3
  hits at the exact `x=-18` boundary). None of these are fixed — touching
  `loadTrees()`'s placement/exclusion logic is shared across ~10+ levels,
  each hit is either non-reproducing or at the map's outer edge rather than
  a spot the level's own objectives send the player to, and un-seeded
  randomness makes any single fix hard to verify by re-running. Recorded as
  an `Ideas` item below with the accumulated evidence — worth a dedicated
  pass extending `isReserved` (or an equivalent) to also exclude the
  camera's own trailing corridor, not just the walkable path.

  Also found and fixed a real, reproducible-every-load bug unrelated to
  cameras: **L16** (`Level16Scene.ts:742`), 2 of the 5 `WAITING_FRIENDS`
  (гardener at `(-9,-4)`, ground height 0.8; and the friend at `(10,-11)`,
  ground height 0.67) rendered visibly sunk into the snow slope — up to
  0.8m. Root cause took several wrong turns to isolate (first suspected an
  animation bind-pose vs idle-pose bounding-box mismatch on the skinned
  character — added, tested, and reverted a `mixer.update(0)` fix in
  `BaseLevelScene.ts` `attachClips()` when it measurably changed nothing).
  The actual cause: the per-frame idle "bob" at line 742,
  `f.position.y = Math.sin(now * 0.003 + f.position.x) * 0.05`, is an
  **absolute** assignment, not an offset — it overwrites whatever grounded
  y the creation-time `groundY()` call computed, every single frame,
  regardless of terrain height. Harmless at the flat photo-gathering spot
  (base≈0, so pinning to ±0.05 looks like a bob), but on the sloped waiting
  spots it yanks the character back down to ~0 on the very next frame after
  being placed correctly. Fixed by making the terrain height part of the
  formula: `this.groundHeightAt(f.position.x, f.position.z) + Math.sin(...)
  * 0.05`. Verified by driving 180 forced frames after the fix and
  confirming the gap to `groundHeightAt` stays within the intended
  ±0.05 bob range for all 5 waiting friends, not just at the instant of
  placement — the original bug was invisible to an instant-after-creation
  check for exactly this reason (it only shows up after ≥1 frame of the
  update loop runs).

  Structurally swept and confirmed clean (via `__audit()` + the occlusion
  probe, `npx tsc --noEmit` clean throughout): L0–L2, L4, L5, L8, L10–L15.
  Files touched: `src/three/scenes/Level3Scene.ts`,
  `src/three/scenes/Level6Scene.ts`, `src/three/scenes/Level16Scene.ts`.
- [x] `qa` (claude, 2026-08-29) · Follow-up: fixed the "ambient trees clip
  the camera near the map edge" pattern flagged below in `Ideas`, at the
  root (`loadTrees()` and its winter sibling), rather than per-instance.

  **Methodology correction first, before trusting any of this**: re-testing
  turned up that the occlusion probe itself had a false-positive class.
  `devTeleport(x,z)` sets the hero's position directly — it does **not**
  run it through `clampToPlayArea`, which is what real WASD movement uses
  to hold the hero inside the level's actual walkable area (`playPath` /
  `playArena` / `pathCorridor`, depending on the level). The probe's grid
  covers the *audit's* `playArea` (hero+interactables+6m pad — a box, used
  for reachability sweeps), not the real movement boundary, so several
  "map-edge" hits were the hero standing somewhere a real player's
  movement code would have held them back from. Confirmed directly: on
  L9, `clampToPlayArea(20,-51)` returns `(7.6,-51)` — nowhere near the
  probed point — and re-running the whole sweep through
  `clampToPlayArea` first dropped L9 from 8 hits to **0**, L7 and (after
  the fix below) L6 to **0**. L16 did *not* drop this way — its `playArena`
  (`r=35` from `(0,-18.5)`) is large enough that the audit box sits
  entirely inside it, so nothing there was ever a false positive; both of
  its remaining hits were real, reachable coincidences of the camera
  corridor. Any future occlusion probing should clamp through
  `clampToPlayArea` before teleporting, not test the raw audit grid.

  **The fix**: `loadTrees()` (`BaseLevelScene.ts`, used by L2/L3/L4×2/L5/
  L6/L7/L8/L9/L10/L0) already skipped candidates on the walkable path via
  `isReserved(x,z,1.6)` at the tree's *own* position — nothing checked the
  position the camera occupies once the hero is `~9m` further down the
  path. Added that as a second check per candidate, sized by the tree's own
  computed height (`height*0.4 + 2.0`). First pass reused `isReserved` at
  the shifted z, which fixed L3/L6/L7/L9 but did **nothing** for L16 —
  L16 walks the hero via `playArena` (a circle), not a `pathCorridor`, and
  `isReserved` only ever tests the corridor branch; its `reserved`/
  `noPlant` zone lists are both empty there, so the added check was silently
  a no-op for every arena-based level. Switched to `clampToPlayArea` itself
  (same function real movement calls, correct under all three of its
  branches) — `Math.hypot(clamped.x - x, clamped.z - camZ) < margin`, i.e.
  "is the shifted point reachable, or within canopy-margin of the boundary
  that would push it back". One check now covers path, arena, and the
  playPath branch alike.

  Then found `loadWinterDecor()` (`BaseLevelScene.ts:1585`, the winter
  sibling used by L11–L16 instead of `loadTrees()` — separate function,
  separate random placement, same gap) still placing L16's `tree-snow-a`
  hits after the `loadTrees()` fix, because L16 never calls `loadTrees()`
  at all. Applied the identical `clampToPlayArea`-based check there.

  Verified per-level, several fresh reloads each (placement is
  `Math.random()`, unseeded — one clean load doesn't mean fixed):
  **L3** clean (already fixed separately, re-confirmed under the corrected
  clamped methodology), **L6** 0/0 hits across 2 loads, **L7** 0 hits incl.
  a direct re-check of all 4 Putalo hide-spots, **L9** 0/0 (`skippedUnreachable`
  52/72 grid points — most of the original "hits" were never reachable to
  begin with), **L16** 2 real hits → 0/0 across 2 fresh loads after both
  fixes landed. Spot-checked **L13** (shares `loadWinterDecor`) unchanged
  from its pre-fix sweep — no regression. `npx tsc --noEmit` clean after
  each of the three edits. File: `src/three/scenes/BaseLevelScene.ts`
  (`loadTrees`, `loadWinterDecor`) — no level file changes needed this
  time, both fixes live entirely in the shared helpers.

## Blocked

_(пусто)_ · `vercel.json` Cache-Control **accepted** lead 2026-08-24:
`max-age=86400, must-revalidate` на `/assets` — осознанный трейд-офф против
битых кэшей после деплоя; legacy `/js`/`/css` headers сняты.

## Ideas

- ~~`levels-forest`/`levels-ice`/`qa` · Follow-camera has no scenery-avoidance
  against ambient trees~~ — **done** (claude, 2026-08-29), see `Done`.
  `loadTrees()` and `loadWinterDecor()` both now exclude the camera's
  trailing position, not just the walkable path, via `clampToPlayArea`.
- ~~`perf` · `setupWindGrass({ count })` tier-awareness~~ — **stale, already
  done** (claude, 2026-08-25 verified). Checked both open questions in this
  item directly against current code rather than assuming: `Level4Scene.ts`
  (now lines 934/941) already reads `this.grassCountForTier(this.isMobile ?
  2600 : 7000)` / `(... 2000 : 5200)`, not a bare `isMobile` branch; and
  `setupWindGrass`'s own default (`BaseLevelScene.ts:1400`) already is
  `this.grassCountForTier(this.isMobile ? 8000 : 22000)`, so
  `Mission1Scene.ts`/`hub/HubScene.ts` not passing `count` was always fine.
  Landed in `81a2ec6 Scale grass and AvatarPreview by render quality tier.`
  — from the commit message, before this Ideas entry was even written.
- ~~`perf` · `AvatarPreview.ts` WebGLRenderer bypassing `renderQuality`~~ —
  **stale, already done**, same commit (`81a2ec6`) and same verification
  pass: `AvatarPreview.ts:35-39` already calls `getRenderQualityProfile(
  resolveRenderQualityTier(isMobile), isMobile)` and reads `antialias` off
  the result.

- ~~`audio-i18n` · `SettingsPanel.tsx:43` missing TTS clip~~ — **done**, see
  `Done`.
- `audio-i18n` · нет автоматической проверки в CI/pre-commit, что
  `manifest.json` синхронен со сценами — `voice:check` (добавлен этой
  сессией) существует, но никто его не зовёт. Дрейф в 46+46 реплик (см.
  `Done` выше) мог копиться много коммитов подряд незаметно. Пока нет
  `.github/workflows`, разумный минимум — pre-commit git hook или ручной
  шаг в чеклисте релиза, который гоняет `npm run voice:check` и
  предупреждает (не блокирует — рендер требует `say`/ffmpeg, которых нет
  у каждого агента) при дрейфе.

- `review` · Todo для `review` сейчас пуст (сама забрала последний пункт).
  2 кандидата на следующий заход:
  1) зона `src/three/scenes/hub/**` (arbatProps.ts, places.ts, HubScene.ts)
  не закреплена ни за одной ролью в таблице `Roles → зоны` — `hub-ui`
  формально ограничен `src/components/**`, но 3 последних коммита
  («Хаб стал городом», «Аттракционы», «Хаб покрасивее») и текущий
  некоммиченный WIP правят именно 3D-сцену хаба. Предложить lead явную
  строку в таблице, чтобы будущие claim'ы не гадали, можно ли трогать эти
  файлы; 2) точечная сверка «Нет проигрыша» (`CLAUDE.md`) — прогнать 2-3
  уровня руками (dev-сервер, `?mission=N`) и проверить, что нет ни одного
  пути к софт-локу/дедэнду без подсказки, раз §32 плана заявляет 0/17, но
  сам план не проверялся именно с ролью `review` независимо.

## Handoffs (короткие записки между ролями)

Формат:
```
@from → @to | files | need
```

@lead → @hub-ui | `src/three/scenes/hub/arbatProps.ts` | некоммиченный
диф вне claim'ов, похож на готовую фичу (facade styles) — заклейми/добери/
`Done`, не теряй молча (см. `Todo`).

@review → @lead | `vercel.json` | некоммиченный Cache-Control даунгрейд на
весь `/assets/(.*)`, без claim'а — решение нужно от тебя (откат или
подтверждение трейд-оффа), см. `Blocked` выше и `docs/S1_AGENT_REVIEW.md`.
