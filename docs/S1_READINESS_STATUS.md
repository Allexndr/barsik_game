# Season 1 — статус готовности (закрепление)

> **Дата среза:** 2026-09-12 (локальная перепроверка после правок сложности)
> **Вердикт:** **локальная демонстрация — ДА** · **полный release-ready — нет** (prod smoke, device QA, KK, cloud gates)
> **Prod xi:** https://barsik-game-xi.vercel.app · bundle `index-DtRe_WMh.js` (2026-08-31)  
> **Источники DoD:** `S1_COMPLETION_PLAN.md` §0, `SEASON_1_FULL_SPEC.md` §15–16, `S1_REMAINING_SPEC.md`

---

## Вердикт одной строкой

**17 уровней и мета в коде собраны и локально зелёные; до «Season 1 готов» не хватает актуального prod-deploy, живого device QA, KK-вычитки, server/cloud gates и sign-off — не подтверждённой непроходимости уровней.**

### Перепроверка 2026-09-12

- `npm run build` — PASS.
- `npm run test:perf` — 4/4 PASS; headless-замеры не считаются доказательством FPS на телефоне.
- Gameplay smoke по четырём чистым блокам — **17/17 PASS**: L0–4 (5/5), L5–9 (5/5), L10–13 (4/4), L14–16 (3/3).
- `npm run test:device` — **18/18 PASS**; `npm test -- --run` — **25/25 PASS**; `npm run voice:check` — 716/716.
- Последние UX/сложностные правки: маяк цели L0, фактический счётчик пяти секторов L3, более длинные безопасные окна L4, выделение правильной корзины L2.
- Полный human golden path, настоящий телефон, актуальный production smoke и native KK review остаются открытыми.

---

## ⚠️ Независимая перепроверка (claude, 2026-08-31) — найден блокер выше P0-OPS-1

Всё ниже перепроверено запуском, а не чтением документов.

### Подтверждено фактами

| Утверждение | Проверка | Итог |
|---|---|---|
| Vitest 17/17 | `npm test -- --run` | ✅ **17/17 в 9 файлах**, exit 0 |
| Voice pack 712+712 | подсчёт файлов | ✅ manifest 712; `ru` 358 + `kk` 354 = 712 (f), `m/` 712 |
| Build зелёный | `npm run build` | ✅ `✓ built in 17.09s` |
| xi ≠ reference | `curl` обоих URL | ✅ xi `index-Ba5irtla.js` · ref `index-BJAhSdaH.js` |
| 17 уровней, лес/лёд | парсинг `levels.ts` | ✅ chapter1 = 0–9, chapter2 = 10–16 **ровно** |
| Realtime OFF by default | `src/net/hub.ts:36` | ✅ P0-SAFE-1 закрыт честно |
| FPS sampler / `__qaErrors` | `fpsSampler.ts`, `qaConsole.ts` | ✅ инструменты на месте |

### 🟥 P0-OPS-0 — НОВЫЙ блокер, выше по приоритету, чем deploy

**Вся работа последних сессий не закоммичена. `main` HEAD ≠ рабочее дерево.**

- `main` HEAD = `db9ceb1`; в рабочем дереве **66 изменённых tracked-файлов** (46 в `src/`) +
  22 untracked, включая **всю тест-инфраструктуру** (`tests/`, `playwright.config.ts`,
  `vitest.config.ts`) и новые модули (`src/net/progression*.ts`, `AppErrorBoundary.tsx`).
- Локальный build даёт `index-DtRe_WMh.js` — **третий** бандл, отличный и от xi, и от reference.
  То есть расхождение не «prod ≠ main», а **prod ≠ main ≠ то, что реально протестировано**.
- Следствие: доказательства «Vitest 17/17 / Playwright 64/64» получены на состоянии, которого
  **нет ни в одном коммите**. Любой deploy из `main` не содержит ни этих тестов, ни фиксов
  (L1 недостижимый плод, L0 переправа, лёд L12, родительский гейт, 12× move-hint и т.д.).
- **P0-OPS-1 (deploy) физически невозможен корректно, пока это не закоммичено** — деплоить
  нечего, кроме старого `db9ceb1`.

**Что сделать:** review границ по потокам → коммит(ы) → только потом `vercel deploy --prod`.

### Уточнения к таблице DoD (документ был неточен)

- **DoD #4 (feedback)** — footsteps **закрыты**, не «не закрыто»: `BaseLevelScene.ts:2966-2979`
  даёт surface-aware шаги (`stepGrass`/`stepSnow`/`stepStone`) с разной каденцией шаг/бег;
  ключи реально реализованы в `AudioManager.ts:288-294`, не no-op. Открытым в §15D остаётся
  fanfare-everywhere / no pop-in, но не звук шагов.
- **Playwright «64/64 за 38.7 s»** — цифра прогона не воспроизводится: конфиг стоит на
  `workers: 1, fullyParallel: false`, суита идёт **минутами**, а не 38 c (первый прогон был
  прерван на 9-й минуте). Результат текущего чистого прогона — ниже.

### ✅ Закрыто этой проверкой

- **P2-OPS-5 (git hygiene)** — `.gitignore` дополнен: `test-results/` (**138 МБ** артефактов
  Playwright), `playwright-report/`, `.hive-mind/`, `.claude/proven-config.json`,
  `public/voxel-prototype/`, `book-1-guidebook`, `book-2-ai-team`, `scripts/__pycache__/`.
  Было 30 untracked-записей с мусором → стало 22, все настоящие файлы проекта.
  `.env` проверен — уже в ignore, секреты в git не утекают.

---

## DoD Season 1 (10 обязательных условий)

| # | Критерий (из ТЗ) | Статус | Доказательство / пробел |
|---|------------------|--------|-------------------------|
| 1 | 17 уровней без soft-lock | ✅ **В коде** | §32 `S1_COMPLETION_PLAN`; ключи L5/L9/L13/L16 через `inventory.ts`; Playwright 17/17 level boot |
| 2 | L0–9 лес, L10–16 лёд | ✅ | `levels.ts`, TravelMap chapters |
| 3 | 1 механика + правило трёх + 3–5 beats | ✅ в основном | GDD + per-level configs; L9 переработан (§18 плана) |
| 4 | Визуальный + звуковой feedback на действия | 🟡 **Частично** | SFX/TTS/confetti есть; §15D FULL_SPEC (footsteps, fanfare everywhere, no pop-in) — не закрыто |
| 5 | Hero: rigged → static → procedural | 🟡 **Fallback OK** | Loader цепочка есть; **0 костей** у prod-героя — финальный brand rig **EXT-1**, не блокер demo |
| 6 | RU/KK: HUD, диалоги, награды, meta | 🟡 **Технически да** | Edge TTS f/m **712+712** клипов; **KK не вычитан носителем** (P1-AUD-1) |
| 7 | Desktop ~60 fps / mobile ≥30 fps | 🟡 **Не доказано** | Quality tiers + `?fps=1`; **нет** замеров на живом телефоне (P1-QA-2) |
| 8 | Replay не дублирует награды | ✅ | `levelStars` + reload QA (L0/L5/L9/L16) |
| 9 | Прогресс/друзья/город/shop/финал после reload | ✅ **локально** | Zustand + localStorage; **cloud merge / leaderboard write** — OPEN |
| 10 | tsc / lint / build / browser regression | ✅ **локально + prod build** | xi deploy OK; device matrix — OPEN |

**Итого DoD:** **4/10 закрыто полностью · 6/10 частично или не на prod**

---

## P0 — блокеры релиза (из `S1_REMAINING_SPEC`)

| ID | Задача | Статус | Что сделать |
|----|--------|--------|-------------|
| **P0-OPS-1** | Prod xi = код в `main` | ✅ **2026-08-31** | Deploy `dpl_G1BzruSVuwBMnGicukHxZru1LtuY`; xi = `index-DtRe_WMh.js`; Welcome Hallmark + voice f/m в бандле |
| **P0-OPS-2** | Hub Realtime + RLS | ⏸️ OFF (правильно) | Применить `supabase/city_chat.sql`, confirm RLS → только потом `VITE_HUB_REALTIME=1` |
| **P0-QA-1** | Prod smoke после deploy | ❌ | Welcome Hallmark + Play → L0 + RU/KK switch |
| **P0-3D-1** | Ambient critters (squirrel/bird) | 🟡 код ✅ | Static LOD в `placeAmbientCritters`; **visual confirm на device** открыт |
| **P0-SAFE-1** | Realtime OFF until RLS | ✅ | Дефолт без `VITE_HUB_REALTIME` |

---

## P1 — premium-bar (не блокируют «играется в репо», блокируют «идеал S1»)

| Зона | Не выполнено |
|------|----------------|
| **LD** | L1 мост в portrait 390×844 — ручной QA; L2 worldScale визуально «кубёнок в саду»; L0 off-ground декор (4 объекта, non-blocker) |
| **Meta UI** | KK title truncate mobile; Hub/Shop polish; motion Welcome |
| **3D / perf** | Forest/winter shared lighting presets; color space GLB; WebGL lifecycle 10 hops; music fade forest↔ice↔hub |
| **Audio** | KK native proofread → правки strings + re-synth; TTS debounce на HUD spam |
| **Ops** | Leaderboard **write** (P1-OPS-3); cloud save reconciliation (P1-OPS-4) |
| **QA** | Golden path **L0→L16** человеком с наградами; живой телефон matrix RU/KK × L0/L1/L8/L16 |

---

## External (вне кода)

| ID | Что | Блокирует soft-launch? |
|----|-----|------------------------|
| EXT-1 | Финальный rigged `barsik.glb` | Нет (procedural/static fallback) |
| EXT-2 | Проф. KK VO | Нет (Edge neural f/m есть) |
| EXT-3 | Реальный QR pool / упаковка | Да только для **физических** наград |
| EXT-4 | KK вычитка носителем | **Желательно до soft-launch** |
| EXT-5 | Vercel murdasoft auth | **Да для обновления xi** |

---

## Что уже можно считать «Season 1 в репо»

- ✅ 17 Mission screens + BaseLevelScene + QualityPipeline на всех уровнях  
- ✅ Meta: TravelMap, Hub, Friends, Shop, QR demo, Settings (RU/KK, голос f/m)  
- ✅ Child-safety: soft-fail, parent chat toggle, QR demo ≠ real stars  
- ✅ Автотесты: Vitest 17/17, Playwright 64/64 (headless)  
- ✅ Voice pack Edge: 712 female + 712 male, manifest sync  
- ✅ Welcome Hallmark в **коде** (карточки миров, features, parents, CTA)

---

## Что явно НЕ выполнено по полному ТЗ (`SEASON_1_FULL_SPEC`)

Секции §15–17 (выборочно):

- [ ] §15D Game feel — feedback на **каждое** действие, no pop-in, NPC react everywhere  
- [ ] §15E Audio full — dedicated music files в `public/assets/audio` (сейчас procedural + voice pack)  
- [ ] §15F Adaptive — **доказанные** 60/30 fps на target devices  
- [ ] §15G Localization — **native KK review**  
- [ ] §17.2 Cloud save между устройствами — local-first, reconciliation OPEN  
- [ ] §17 Hub Realtime chat UI — код частично, **prod gate** OPEN  
- [ ] Admin panel на prod — env + `admin_schema.sql` (код готов, не включено)

---

## Рабочий порядок до «S1 готов»

```
1. P0-OPS-1  Deploy xi + P0-QA-1 smoke Welcome/L0
2. P1-QA-2   Живой телефон matrix (RU/KK × L0/L1/L8/L16)
3. P1-AUD-1  KK вычитка → strings + voice re-synth
4. P0-OPS-2  Supabase RLS confirm (или зафиксировать realtime OFF навсегда для S1)
5. P1-OPS-3/4 Leaderboard write + cloud policy (или явно «local-only до S2»)
6. Sign-off    QA + product + release checklist (`docs/audits/RELEASE-READINESS.md`)
```

---

## Связанные файлы

| Файл | Роль |
|------|------|
| **`S1_READINESS_STATUS.md`** | **этот документ — канон готовности** |
| `S1_REMAINING_SPEC.md` | детальное ТЗ остатка по зонам |
| `S1_BOARD.md` | living claims / Done |
| `S1_COMPLETION_PLAN.md` | исторический аудит + §32 soft-lock |
| `SEASON_1_FULL_SPEC.md` | полное продуктовое ТЗ S1 |
| `docs/audits/RELEASE-READINESS.md` | NO-GO вердикт 2026-08-31 |

**При конфликте:** этот файл (срез готовности) + `S1_REMAINING_SPEC` > board Todo > completion plan чекбоксы §3–4.
