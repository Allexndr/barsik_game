# ТЗ: что осталось доработать Season 1

> **Версия:** 1.0 · **Дата:** 2026-08-30  
> **Статус:** рабочее ТЗ (актуальный срез)  
> **Prod:** https://barsik-game-xi.vercel.app · **Reference UI:** https://barsik-game.vercel.app  
> **Источники:** `product-state.md`, `S1_BOARD.md`, `S1_COMPLETION_PLAN.md` §0/§4/§10, `S1_DEPT_STATUS.md`, `PROJECT_MEMORY.md`

---

## 0. Цель и DoD

**Цель:** довести Season 1 (L0–L16 + мета) до честного **release-ready**, а не «играбельно в репо».

Сезон считается законченным, когда одновременно:

| # | Критерий | Сейчас |
|---|----------|--------|
| 1 | 17 уровней без soft-lock | ✅ код (§32) |
| 2 | Карта: лес 0–9 + лёд 10–16 | ✅ |
| 3 | Одна механика / правило трёх / 3–5 beats | ✅ в основном |
| 4 | Визуальный + звуковой feedback на действия | 🟡 частично |
| 5 | Hero pipeline: rigged → static → procedural | 🟡 cool-rigged в проде; финальный бренд-rig — External |
| 6 | RU/KK HUD / диалоги / награды / meta | 🟡 Edge TTS есть; носитель не вычитал |
| 7 | Desktop ~60 fps / mobile ≥30 fps | 🟡 tiers есть; живой device matrix неполная |
| 8 | Replay не дублирует награды | ✅ |
| 9 | Прогресс / друзья / город / shop / финал после reload | ✅ локально; cloud — open |
| 10 | tsc / lint / build / browser regression | 🟡 tsc/build ок; полный regression на живом телефоне — нет |
| 11 | Prod = то, что в `main` (xi) | ❌ CLI deploy + auth |

**Out of scope этого ТЗ:** Season 2+, voxel pivot, CityScreen-поляна, фиктивные QR до реальной упаковки.

---

## 1. Приоритеты

| P | Значение | Правило |
|---|----------|---------|
| **P0** | Блокер релиза / безопасность детей / prod ≠ код | Сначала |
| **P1** | Premium-bar / читаемость / мобилка / хаб | После P0 |
| **P2** | Полировка, VFX, docs hygiene | Не блокирует демо |
| **Ext** | Нужен бренд / vendor / живой человек | Параллельно, не ждём в коде |

---

## 2. Ops / деплой / инфраструктура

### P0-OPS-1 — Prod deploy xi = `main`
- **Проблема:** murdasoft **не** auto-deploy с GitHub; `VERCEL_TOKEN` в среде часто битый.
- **Сделать:**
  1. `unset VERCEL_TOKEN && npx vercel login` (аккаунт murdasoft).
  2. `cd barsik-game && npm run build && npx vercel deploy --prod --archive=tgz`.
  3. Hard refresh xi; сверить Welcome с reference (карточки миров, features, parents, CTA).
- **Критерий:** xi отдаёт бандл с Hallmark Welcome (`Каждый шаг — новая история`, feature-grid, parent-shield).
- **Владелец:** человек + CLI.

### P0-OPS-2 — Hub realtime auth
- **Проблема:** канал без `private: true`; без `city_chat.sql` + Realtime RLS любой с anon-ключом пишет в `hub:*`.
- **Сделать:**
  1. Подтвердить в Supabase: применён `supabase/city_chat.sql`, broadcast/presence auth для `hub:*`.
  2. Только после этого `VITE_HUB_REALTIME=1` на prod.
  3. До confirm — realtime **OFF** (текущий дефолт).
- **Критерий:** без auth — realtime не включён на prod; после auth — smoke presence + catalog phrases.
- **Владелец:** владелец Supabase.

### P1-OPS-3 — Leaderboard write
- **Сейчас:** read-only + nick filter на read.
- **Сделать:** design + edge function (или RLS-safe write) по confirm человека; не писать с клиента напрямую service role.
- **Критерий:** успешная запись только после прохождения уровня / сезона по правилам; нет farm с клиента.

### P1-OPS-4 — Cloud save reconciliation
- **Сделать:** политика merge local ↔ `barsik_saves` (кто побеждает, конфликт, дети без аккаунта).
- **Критерий:** документ решения + реализация или явное «local-only до S2».

### P2-OPS-5 — Git hygiene
- Не коммитить `dist/` руками; `.hive-mind/`, proven-config — в ignore.
- Свести устаревшие чекбоксы `S1_COMPLETION_PLAN.md` §3–§4 с реальностью (или пометить superseded → этот файл).
- Почистить мёртвые `codex/level*` ветки (по confirm).

---

## 3. Дизайн / UI / бренд

Style Lock: soft-3D plush · Barsik Hum · `design.md` / ART_DIRECTION. Welcome reference = vercel.app Hallmark.

### P0-DES-1 — Welcome на prod = reference
- Карточки миров (не «торчащие» фото).
- Features: «Что ждёт в игре» + 3 glass cards.
- Parents: белая карточка + purple shield.
- Final CTA: sky + green hill + «Играть».
- Nav: Об игре / Миры / Возможности / Родителям.
- **Критерий:** визуальный 1:1 desktop + mobile vs reference screenshots.
- **Код:** уже в `main` (`WelcomeScreen.tsx/css`); осталось **задеплоить** (P0-OPS-1).

### P1-DES-2 — Meta UI polish
| Экран | Задача | Критерий |
|-------|--------|----------|
| TravelMap | pin hover без jitter; portrait frame на desktop | как канон карты |
| Settings / smodal | contrast WCAG-ish на cream | читаемо детям/родителям |
| LoadingOverlay | не click-through на HUD | ✅ уже фикс; regression |
| Mission title pill | KK truncate на 390px | не критично; либо wrap-policy, либо shorter KK titles |
| Hub / Арбат | soft-3D cards, без procedural cathedral shells | GLB + style lock |
| Shop / Friends | cool-only hero; 3D inspect unlocked | без quarantine looks |

### P1-DES-3 — Motion / presence
- Welcome: 2–3 осознанных motion (reveal, CTA press, scroll cue) — без noise.
- Hub day-cycle читаемость без «мигания».

### P2-DES-4 — Art / props backlog
- Meshy S1 quality props: визуальный QA перед релизом (`s1_quality_*`).
- Butterfly quality: не синяя плоскость.
- Felt panels / stepping stones — остаются procedural (gameplay sockets) — **не** менять без LD confirm.

---

## 4. Level design / геймплей

Канон: soft-fail only · без compass directions для детей · guide arrow = «куда идти».

### P1-LD-1 — Forest (выборочно)
| Level | Задача | Критерий |
|-------|--------|----------|
| L0 | Regression anchor: intro → pick → bird → gardener → outro | 10★ один раз; terrain snap |
| L1 | Читаемость **моста в портрете** (явно открыто в плане) | на 390×844 мост/ручей понятны |
| L2 | Пропорции сад/яблоки/ворота (worldScale) | Barsik не «гигант»; яблоки не мячи |
| L6 | Загадки не выдают ответ | regression |
| L8 | Placement 5/3/4 + celebrate + camera guard | ✅; visual QA |
| L9 | QR demo без farm реальных ★ | ✅; UI ясность |

### P1-LD-2 — Ice
| Level | Задача | Критерий |
|-------|--------|----------|
| L14 | Warmth bar в objective читается | ✅ код; mobile QA |
| L16 | Chest marker на земле; trail arrows | ✅ код; visual QA |
| L10–L16 | Ice visual claims vs код (sparkle/snow) | нет ложных обещаний в copy |

### P1-LD-3 — Shared LD rules
- Objective text: без «запад/север»; детский язык RU/KK.
- Guide arrow скрывается ~1.35 м до цели.
- Cinematic intro только до `hasTakenFirstStep` на **всех** 17 (уже в коде) — regression после правок камеры.
- Междууровневые ключи / флаги: не дублировать soft-lock классов (§17).

### P2-LD-4 — Content density
- 3–5 beats на уровень; короткие сессии (существующие duration notes §29/§33).
- Ambient critters: если модель > budget — не «пустой мир», а fallback / decimate.

---

## 5. 3D / код сцен / performance

### P0-3D-1 — Ambient `*_rigged` over budget
- **Проблема:** `squirrel_rigged.glb` / `bird_rigged.glb` ~26k tris → `placeAmbientCritters` skip → мир без белки/птицы.
- **Кодовый фикс:** `placeAmbientCritters` использует static `squirrel.glb` / `bird.glb` LOD;
  превышенный budget освобождается через `disposeObject3DResources`. Rigged-вариант сохранён
  для интерактивных персонажей.
- **Осталось:** visual/device confirmation на L0 и других уровнях с ambient.
- **Критерий:** L0+ уровни с ambient снова показывают critters; Idle/Walk интерактивных NPC не ломаются.
- **Файлы:** `public/assets/models/chars/{squirrel,bird}_rigged.glb`, `s1Place.ts`, `BaseLevelScene.loadCharModel`.

### P1-3D-2 — World scale canon
- Держать `src/three/worldScale.ts` как источник правды (HERO 1.1, trees, gate, apple).
- Прогнать L0–L2 + hub preview после любых Meshy swaps.
- **Критерий:** screenshot L2 orchard — пропорции «кубёнок в саду», не «взрослый среди кустов».

### P1-3D-3 — Camera / portrait
- Collision / anti-clip на узких экранах (план §4 B3).
- Portrait camera offsets.
- `visibilitychange` → auto-pause.

### P1-3D-4 — Quality / env (свести с кодом)
Уже есть `?quality=` tiers / grass by tier — отметить в плане. Осталось явно закрыть:
- [ ] Общие Forest/Winter lighting presets (или document «per-level ok»).
- [ ] Color space audit GLB textures.
- [ ] Lifecycle: dispose listeners; WebGL context после 10 map↔level hops.
- [ ] Music fade forest/ice/hub; SFX от gameplay events.

### P2-3D-5 — Hero art pipeline
- Текущий: cool-only Meshy / procedural fallback.
- External: финальный brand-rigged Barsik от артиста → slot в loader без ломки cool wardrobe.

---

## 6. Аудио / i18n

### P1-AUD-1 — KK вычитка носителем
- Пройти HUD + objectives + диалоги L0/L1/L8/L16 + Welcome/Settings.
- Список правок → `src` strings + `manifest.json` + `synth-voice.mjs` для изменённых lineId.

### P1-AUD-2 — Voice hygiene
- `voice:check` = 0 missing / 0 orphans (после правок).
- Settings TTS «Озвучка включена» — уже в manifest; regression.

### P2-AUD-3 — External pro VO
- Проф. KK (и опц. RU) вместо Edge neural — vendor; fallback субтитры всегда.

### P2-AUD-4 — Mix
- Forest/ice/hub music transitions с fade.
- TTS debounce: не перебивать каждое HUD обновление.

---

## 7. Тесты / QA

### P0-QA-1 — Prod smoke после deploy
- Welcome sections (worlds / features / parents / CTA).
- Play → QuickStart → L0 load.
- Continue returning player.
- RU/KK switch на Welcome + L0 title.

### P1-QA-2 — Device matrix (живой телефон)
| Viewport | Lang | Levels |
|----------|------|--------|
| 1280×720 | RU, KK | L0, L1, L8, L16 |
| 390×844 portrait | RU, KK | L0, L1, L8, L16 |
| Landscape phone | RU | L0, L1 (мост!) |

Запись: FPS avg/p5, soft-lock, overflow, camera, SFX.

### P1-QA-3 — Meta regression
- Reload after reward L0/L5/L9/L16 (механика ✅; повторить на prod save).
- Map pin routes; season complete CTA.
- Shop buy → hub prop appears.
- Friends 3D inspect.
- Pause freezes clock; visibility pause.

### P1-QA-4 — A1 tooling (поддержать зелёным)
- `?fps=1`, `?qa=1` → `__qaErrors()`.
- Fixtures `docs/qa/save-fixtures.json`.
- Console-error collector / FPS sampler — довести чекбоксы плана §3 или вычеркнуть как covered.

### P2-QA-5 — Perf budgets
- Desktop 60 / mobile 30 на L0/L1/L8/L16 medium tier.
- Draw calls / tris snapshot в `S1_PERF_NOTES.md`.

---

## 8. Безопасность / детский продукт

| ID | Задача | Критерий |
|----|--------|----------|
| P0-SAFE-1 | Hub realtime OFF until RLS | см. P0-OPS-2 |
| P1-SAFE-2 | Free chat только с parent toggle + receive-side filter | ✅ код; confirm на prod |
| P1-SAFE-3 | Nick filter / checkText на leaderboard read | ✅; write — отдельно |
| P1-SAFE-4 | Нет purchase pressure на child screens | shop UX audit |
| P2-SAFE-5 | QR demo ≠ реальные награды | ✅; реальный QR — Ext |

---

## 9. External (не код)

| ID | Что | Кто | Блокирует релиз? |
|----|-----|-----|------------------|
| EXT-1 | Финальный rigged `barsik.glb` | бренд / артист | Нет (есть fallback) |
| EXT-2 | Проф. KK VO | vendor | Нет |
| EXT-3 | Реальный QR pool / упаковка | бренд | Да для «физических наград»; нет для soft-launch |
| EXT-4 | KK native proofread | носитель | Желательно до soft-launch |
| EXT-5 | Billing / Vercel auth murdasoft | владелец | Да для обновления xi |

---

## 10. Рабочий порядок (срезы)

Каждый срез: **одна зона · критерий · small diff · tsc**. Prod deploy — только с **confirm** человека.

```
Срез 1 (P0):  OPS-1 deploy xi + QA-1 smoke Welcome/L0
Срез 2 (P0):  OPS-2 hub realtime confirm (или оставить OFF + зафиксировать)
Срез 3 (P1):  3D-1 ambient rigged budget + LD-1 L1 portrait bridge
Срез 4 (P1):  QA-2 живой телефон matrix
Срез 5 (P1):  OPS-3/4 leaderboard write + cloud save decision
Срез 6 (P1):  AUD-1 KK вычитка + DES-2 meta polish
Срез 7 (P2):  3D-4 env/lifecycle/audio fade + docs hygiene
Срез 8 (Ext): параллельно rig / VO / QR
```

---

## 11. Роли → задачи

| Роль | Берёт из этого ТЗ |
|------|-------------------|
| lead | приоритеты, confirm ops, обновление board |
| hub-ui | DES-*, Welcome regression |
| levels-forest | LD-1, L1 bridge, L2 scale QA |
| levels-ice | LD-2 |
| perf / 3D | 3D-* |
| audio-i18n | AUD-* |
| qa | QA-* |
| ops / owner | OPS-*, EXT-5, SAFE realtime |

Протокол claim — как в `S1_BOARD.md`.

---

## 12. Явно НЕ делать

- Огромный diff без среза/критерия.
- Включать hub realtime на prod без RLS confirm.
- Force-push main / `--no-verify`.
- Секреты в git/чат.
- Подменять KK voice RU незаметно.
- Landscape stretch карты на desktop.
- Возвращать anti-slop Welcome split-hero.

---

## 13. Связанные документы

| Док | Роль |
|-----|------|
| `product-state.md` | stage + open_questions |
| `S1_BOARD.md` | living claims |
| `S1_COMPLETION_PLAN.md` | исторический аудит (часть чекбоксов устарела) |
| `S1_DEPT_STATUS.md` | dept overview 2026-08-24 |
| `S1_QA_A1.md` | QA tooling |
| `BARSIK_UI_CANON.md` / `design.md` | UI / brand |
| `docs/PROJECT_MEMORY.md` | факты/решения workspace |

**При конфликте цифр:** этот файл (срез 2026-08-30) > board Todo > completion plan чекбоксы §3–§4.
