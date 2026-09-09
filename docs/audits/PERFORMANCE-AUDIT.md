# Performance audit

Дата: 2026-08-31. Кодовые улучшения из этого аудита проверены; runtime/device profiling не
подменялся статическим анализом.

## Измеренная база

- Temporary clean production build: 230 modules; route shell — `124.75 kB` min / `41.01 kB` gzip;
  `react-vendor` — `140.91 kB` / `45.28 kB`; `three-vendor` — `554.23 kB` / `140.46 kB`.
  Three.js больше не module-preload-ится из `index.html`, но Vite всё ещё предупреждает о чанке
  больше 500 kB. CSS: `40.78 kB` min / `9.12 kB` gzip.
- `public/` — `494 MB`, из них примерно `453 MB` — GLB-модели. В production output копируются также gallery/quarantine/brand assets.
- `public/` содержит 61 изображение и 0 видео. Самые крупные растровые файлы — `725 kB` и `286 kB`; явного video budget в проекте нет.
- Цели из спецификации: desktop 60 FPS, mobile average ≥30 FPS / p5 ≥24 FPS.
- Локальный Chromium perf harness (`npm run test:perf`) теперь снимает avg/p5 и доступный
  JS heap на L0/L1/L8/L16. Последний полный headless-срез: L0 `1.8/0.7 FPS` (heap 44.7 MB),
  L1 `1.8/0.6` (64.0 MB), L8 `1.5/0.6` (68.0 MB), L16 `2.9/1.0` (72.2 MB);
  QA errors — 0. Headless WebGL не репрезентативен для
  целевых телефонов, поэтому это evidence для диагностики, а не закрытие device budget.

## Findings

### 1. Большой initial JavaScript из-за Three.js — исправлено частично

**Проблема →** initial JS тяжёлый для мобильного первого запуска.

**Доказательство →** `vite.config.ts:36-42` вручную выделяет весь `three` в один chunk; build
даёт `three-vendor` 554.23 kB min / 140.46 kB gzip и warning Vite. `GamePage` теперь lazy-loads
тяжёлые meta routes, а `LoadingOverlay` вынесен из Three.js runtime; initial shell — 124.75 kB
min / 41.01 kB gzip, без Three module preload.

**Влияние →** дольше download/parse/compile, выше TTI и вероятность пропуска кадров на слабых телефонах.

**Конкретный следующий фикс →** установить budget для initial JS и CI-проверку; дальнейшее
дробление Three/`BaseLevelScene` выбирать после device/network measurements.

**Сложность →** M.

### 2. Production deploy содержит слишком много ассетов

**Проблема →** runtime package несёт около 494 MB, хотя большая часть не нужна стартовому экрану.

**Доказательство →** `du -sh public` = `494M`; GLB-модели занимают около `453M`; в `public/model-gallery`, `public/assets/.../quarantine` и brand/reference directories лежат ресурсы, которые Vite копирует в output независимо от фактических импортов.

**Влияние →** долгие deploy/upload, большой CDN/storage footprint, медленное прогревание кеша и риск случайно использовать тяжёлый reference asset в runtime. На initial page byte size влияет только при запросе конкретного ассета.

**Конкретный фикс →** разделить gameplay assets, gallery и reference assets на разные артефакты/пути; удалить из production publish non-runtime files только после проверки gallery и QA flows; добавить asset manifest и общий budget.

**Сложность →** M.

### 3. Cache-Control для ассетов слишком короткий

**Проблема →** повторные загрузки ассетов после суток требуют revalidation.

**Доказательство →** `vercel.json:8-16`: для `/assets/(.*)` задано `public, max-age=86400, must-revalidate`. Имена GLB/audio не являются явно content-hashed.

**Влияние →** лишние CDN/origin проверки и задержки при возвращении пользователя; особенно заметно для больших GLB.

**Конкретный фикс →** для versioned/content-addressed assets использовать `max-age=31536000, immutable`; для изменяемых manifest-файлов оставить короткий TTL и версионировать ссылки на них.

**Сложность →** S.

### 4. Per-frame аллокации в Hub render loop — исправлено частично

**Статус →** исходная проблема с `clone()`, `toFixed()` и scratch-векторами исправлена в
рабочем дереве; оставшийся per-remote `THREE.Vector3` создаётся только при появлении нового
peer, не каждый кадр.

**Доказательство →** текущий `HubScene.loop()` переиспользует `beforePos`, `seatPos` и
`cameraTarget`; `syncRemotes()` обновляет существующий target через `.set()`. Остаток виден
в `src/three/scenes/hub/HubScene.ts` при создании нового remote.

**Влияние →** runtime профилирование всё ещё нужно, но подтверждения постоянной аллокации в
основном кадре нет.

**Конкретный следующий шаг →** снять Chrome Performance/Memory profile в hub с несколькими
peer; не менять код без измерения.

**Сложность →** S.

### 5. Desktop post-processing выполняется каждый кадр

**Проблема →** desktop path всегда использует несколько full-screen passes.

**Доказательство →** `src/three/QualityPipeline.ts:42-66` создаёт `EffectComposer`, `RenderPass`, `UnrealBloomPass`, FXAA и `OutputPass`; `:84-86` composer render вызывается на каждом кадре. Mobile path отключает composer, но desktop budget отдельно не адаптируется к GPU tier.

**Влияние →** дополнительные render targets, bandwidth памяти и full-screen passes; возможный FPS drop при высоком DPR/слабом desktop GPU.

**Конкретный фикс →** добавить quality tier по GPU/frame-time, отключать bloom/FXAA при превышении бюджета; измерить draw calls, GPU time и p95 frame time на целевых устройствах перед выбором default.

**Сложность →** M.

### 6. Admin overview делает bounded full-table read и JS-агрегацию

**Проблема →** endpoint читает до 10 000 save rows и многократно проходит массив в JS.

**Доказательство →** `api/admin/overview.ts:36-38` запрашивает `barsik_saves?...&limit=10000`; `:50-62` выполняет 17 фильтраций для funnel и ещё 10 для friends histogram; `:69` сортирует весь список для median.

**Влияние →** latency, память и CPU serverless function растут с числом игроков; лимит 10 000 даёт неполную/неточную аналитику после роста таблицы.

**Конкретный фикс →** перенести count/filter/histogram/median в SQL view или RPC с агрегатами; добавить нужные индексы по `updated_at`, `levels`, `friends`, `hidden`; возвращать только агрегаты и небольшой integrity sample.

**Сложность →** L.

### 7. Admin players PATCH/DELETE выполняет последовательные запросы

**Проблема →** административная операция делает read-before-write и затем отдельный audit write.

**Доказательство →** `api/admin/players.ts:85-104` выполняет `SELECT *`, затем `PATCH`, затем `audit()`; DELETE повторяет read + delete + audit в `:107-121`. `api/admin/_lib.ts:135-150` отправляет audit отдельным HTTP-запросом.

**Влияние →** лишняя latency и окно частичного успеха: сейв изменён, а журнал может не записаться; при конкурентной правке snapshot может быть устаревшим.

**Конкретный фикс →** атомарная SQL/RPC-транзакция с audit insert и optimistic concurrency по `updated_at`/version; вернуть конфликт вместо перезаписи.

**Сложность →** L.

### 8. Нет подтверждённого N+1 в игровом и API-пути

**Проблема →** не подтверждена. Это результат проверки, а не рекомендация.

**Доказательство →** `AssetKit` кэширует pending loads по URL в `src/three/AssetKit.ts:70-103`; leaderboard делает один REST-запрос в `src/utils/leaderboard.ts:113-122`; найденные admin endpoints используют фиксированное число запросов на операцию.

**Влияние →** текущий static evidence не показывает N+1. Риск остаётся для runtime scene loading и Supabase latency, потому что SQL query plan/trace отсутствуют.

**Конкретный фикс →** не менять до профилирования; снять network trace и `EXPLAIN (ANALYZE, BUFFERS)` для production-sized данных. Если появятся повторные запросы, заменить их batch/RPC.

**Сложность →** S для измерения, M/L для исправления.

### 9. Нет подтверждённой утечки памяти после dispose

**Проблема →** не подтверждена; lifecycle выглядит в основном закрытым.

**Доказательство →** `src/components/MissionScreen.tsx:113-139` и `src/components/screens/HubScreen.tsx:96-99` вызывают `scene.dispose()`; `BaseLevelScene.dispose()` отменяет RAF, снимает listeners, очищает resources и вызывает `renderer.dispose()` в `:3698-3715`; Hub вызывает `hub.leave()` в `HubScene.ts:668`.

**Влияние →** без heap/GPU capture нельзя исключить retained WebGL resources, особенно после многократных переходов между уровнями.

**Конкретный фикс →** добавить automated soak test: 20–50 переходов level↔hub, heap snapshots и `renderer.info.memory` до/после; исправлять только подтверждённые retained references.

**Сложность →** M.

### 10. CSR-only старт ухудшает first render на медленной сети

**Проблема →** SSR/prerender отсутствует; первый экран зависит от загрузки и выполнения JS.

**Доказательство →** `src/main.tsx` монтирует React app, а `vite.config.ts` — Vite SPA без SSR entry. Основные screens используют lazy imports в `src/App.tsx`.

**Влияние →** на cold mobile запуск пользователь получает задержку до интерактивной оболочки; SEO/preview-контент также не участвует в initial HTML.

**Конкретный фикс →** не внедрять SSR автоматически: сначала измерить LCP/TTI на throttled mobile. Если budget не выполняется, добавить prerender статического Welcome shell или SSR только для landing, оставив Three.js CSR.

**Сложность →** M/L.

## Что не подтверждено этим аудитом

- Реальные лишние React rerenders: `setHud` вызывается событийно, runaway render loop по исходникам не доказан; нужен React Profiler.
- API waterfall в браузере: статический код показывает lazy route boundaries и отдельный voice manifest fetch, но порядок фактических запросов не измерен.
- Медленные SQL query plans: в репозитории нет production statistics/`EXPLAIN`; наиболее рискованный запрос — admin overview.
- Утечки GPU/heap: dispose paths присутствуют, но runtime soak test не запускался.
- Тяжёлые npm-зависимости кроме `three`: прямых лишних dependencies не найдено; `three` — единственный подтверждённый крупный vendor chunk.
- Видео отсутствуют; image audit не выявил видео pipeline, но responsive image loading следует проверить на реальных viewport/network profiles.

## Приоритет проверки

1. Initial JS + asset payload.
2. Admin overview aggregation.
3. Hub per-frame allocation и desktop post-processing.
4. Cache policy.
5. Runtime profiling: FPS, network waterfall, heap/GPU soak и SQL `EXPLAIN`.
