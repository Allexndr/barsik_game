# S1 Board — общая доска отдела

> Агенты **читают и обновляют** этот файл. Lead держит приоритеты.  
> Ветка работы: `levels-premium-pass` (без новых worktrees, если можно).  
> Правила: `CLAUDE.md` · Style Lock · **не** Supabase write · **не** force-push.

## Sprint goal (меняет человек или lead)

```
До 31.08: premium-bar + демо-ready UX + QA notes. Кооп через эту доску.
```

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
- [x] `levels-forest` · P1 — L1/L2/L8 camera: cinematic intro только до
      `hasTakenFirstStep` (фикс `hero-off-frame`). L8 placement 5/3/4 + celebrate
      уже в коде.
- [x] `levels-ice` · P1 — L14 warmth bar в objective; L16 chest marker snapToGround.
- [x] `hub-ui` · SettingsModal contrast (`smodal-*`); map pin hover без scale-jitter;
      Welcome landing brand-first + flow + sticky CTA.
- [x] `qa` · A1: `?fps=1`, `?qa=1` → `__qaErrors()`, fixtures `docs/qa/save-fixtures.json`,
      гайд `docs/S1_QA_A1.md`. Screenshot matrix / reload awards — ещё руками.
- [ ] `qa` · Screenshot matrix desktop/mobile × RU/KK (L0/L1/L8/L16) + reload awards.
- [ ] `perf` · P2 — tier-scale grass count; AvatarPreview → renderQuality
      (CityScene удалён).
- [ ] `lead` · держать этот порядок актуальным после каждого нового `Done`
      (living task, не закрывается сама по себе).

## Blocked

- [x] `vercel.json` Cache-Control на `/assets/(.*)` —
      **accepted**: `max-age=86400, must-revalidate` (не immutable; фикс битых
      ассетов после деплоя). `/js`/`/css` headers сняты вместе с legacy.

## In progress

- [ ] `levels-forest` (Allexndr agent) · audit L1–L9 (Mission1Scene, Level2–9Scene)
  via `window.__audit()` dev tool (`src/dev/levelAudit.ts`, `?mission=N`) —
  claimed 2026-08-24. Confirmed `placeMany` already fully gone from all 9
  forest scene files (only Mission1Scene had 1 leftover call, now
  `this.placeProps`, uncommitted). Partial audit results so far (dev server
  on :8765 is shared/unstable across agents — kept restarting mid-run):
  - **L1** (`Mission1Scene`, intro phase): `hero-off-frame` **block** —
    worst `|x| 10.09` of 1.0 at play-area corners. Camera loses the hero
    far outside frame at the edges of the ~2272 m² play area. Needs
    `cameraFraming()`/follow-lerp check for this level specifically.
  - **L2** (`Level2Scene`, intro phase): `off-ground` high (9 props, e.g.
    `(-46,-66) ground 1.9`, `(44,-62) ground 0.9` — likely backdrop-range
    false positives >|60|/|70|, need to re-check against the audit's own
    backdrop cutoff) + same `hero-off-frame` **block**, worst `|x| 10.84`.
  - **L3–L9**: not yet captured — dev server connection kept dropping
    (`ERR_CONNECTION_REFUSED`) under concurrent load from other role
    agents; rerun in progress when this claim paused.
  - Raw JSON: `/Users/aleksandr/.claude/jobs/9e9c5802/tmp/audit_result.json`
    (local, not in repo — re-run script at
    `/Users/aleksandr/.claude/jobs/9e9c5802/tmp/audit_levels.mjs` against
    `http://localhost:8765/?mission=N` once server is stable).
  - **Next for whoever picks this up:** (1) finish L3–L9 sweep, (2) fix the
    L1/L2 `hero-off-frame` block findings — these are exactly the
    "camera loses character at map edge" bug class from the sprint brief,
    (3) only then move to L8 placement-points Todo item and level-length /
    sub-location work per `BARSIK_SEASON_1_FULL_SPEC.docx`.
- [ ] `qa` (Allexndr agent) · пройти/зафиксировать L0,L1,L8,L16 blockers в S1_QA_SESSION.md — claimed 2026-08-24 — **частично**: L0 снят `__audit()` (1 low off-ground находка, reachability не финализирован), L1/L8/L16 не сняты, сессия уперлась в usage-limit. Детали и handoff: `docs/S1_QA_SESSION.md`.
- [ ] `levels-ice` (Allexndr agent) · L14 warmth readable + L16 finale markers — claimed 2026-08-24
- [ ] `levels-ice` (Allexndr agent bg) · Mission10–16 visual-bug audit (out-of-bounds, camera clipping, marker readability) + sub-location depth pass — claimed 2026-08-24
## Done

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

## Blocked

_(пусто)_ · `vercel.json` Cache-Control **accepted** lead 2026-08-24:
`max-age=86400, must-revalidate` на `/assets` — осознанный трейд-офф против
битых кэшей после деплоя; legacy `/js`/`/css` headers сняты.

## Ideas

- `perf` · per-level `setupWindGrass({ count })` still branches only on
  `isMobile`, not tier: `Level4Scene.ts:933` (`2600` mobile / `7000`
  desktop) and `:940` (`2000` / `5200`) hand thousands of instanced blades
  to a `low`-tier weak phone same as any other mobile. `Mission1Scene.ts:824`
  and `hub/HubScene.ts:216` don't pass `count` at all, so they already ride
  whatever `setupWindGrass`'s own default does — worth checking that
  default is tier-aware too before touching call sites. Fix shape: read
  `this.renderQuality.tier` at each call site, same pattern as the
  `setupFireflies` change in `5742de9`+this session (see
  `S1_PERF_NOTES.md`). Level content zone overlaps `levels-forest`/`hub-ui`
  — coordinate before editing those files, or scope the change to only the
  `count` numbers, not layout/`area`.
- `perf` · `AvatarPreview.ts` строит свой `WebGLRenderer` в обход
  `renderQuality` (CityScene удалён 2026-08-24). Протянуть профиль tier.

Обе — small diff each, но вторая трогает файлы вне текущей `perf`-зоны
формально в списке (`renderQuality.ts`, `BaseLevelScene.ts`) лишь
косвенно — оба потребителя `renderQuality`, не новые файлы в самом
модуле. Жду kick / lead на приоритет.

- `audio-i18n` · `SettingsPanel.tsx:43` — единственная строка озвучки, что
  живёт вне `src/three/scenes/*.ts` (`AudioManager.tts(ru ? 'Озвучка
  включена' : 'Дауыс қосылды', lang)`), поэтому `extract-voice-lines.mjs`
  её не видит и она всегда идёт через браузерный TTS, даже когда для
  остального в игре есть готовый пак (§2 `S1_AUDIO_I18N_NOTES.md`). RU/KK
  не путаются (оба берутся из одного `useUIStore`), просто KK на Android
  без `kk-KZ`-голоса будет либо тишина, либо акцент. Fix shape: либо
  добавить ручную запись в `manifest.json`/рендер парой clip'ов, либо
  научить экстрактор видеть простые `AudioManager.tts(a ? x : y, lang)`
  паттерны вне `scenes/` — второе масштабнее, первое — small diff.
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
