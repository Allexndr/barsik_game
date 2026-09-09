# DEAD-CODE AUDIT

Read-only аудит репозитория `/Users/aleksandr/Project/other/job/barsik-game`, 2026-08-29.
Ничего не удалялось. «Нет ссылки» означает отсутствие найденной статической ссылки в checkout; runtime URL, deploy-конфиг и ручные инструменты требуют отдельной проверки.

## Краткий итог

- Сильные кандидаты в исходниках: 5 модулей/функций.
- Неиспользуемый CSS-файл: не найден. Все `src/**/*.css` импортируются из активного кода; отдельные мёртвые селекторы статически надёжно не определить из-за динамических className.
- Неиспользуемая npm-зависимость: не подтверждена. Все direct dependencies имеют импорт/конфигурационное использование.
- API endpoints: не подтверждены как мёртвые; все 4 endpoint-а — внешние Vercel entry points, вызываются через динамический `/api/admin/${path}`.
- Есть 3 env-переменные только в `.env.example` и write-only очередь `barsik_cloud_pending`.
- Старый vanilla-слой `js/`/`css/` в текущем checkout отсутствует; старые ссылки на него остались в документации и должны быть вычищены отдельно.

## 1. Неиспользуемые файлы и модули

### `src/utils/cityStages.ts`

- Почему выглядит мёртвым: нет ни одного импорта файла или использования `CITY_STAGES`, `cityProgress`, `hasFeature`, `cityTitle` вне самого файла.
- Все найденные ссылки: только определения и внутренние ссылки в `src/utils/cityStages.ts:1-125`; внешних ссылок нет.
- Риск удаления: medium — файл описывает прежнюю модель роста города; будущая фича или незавершённый merge может ожидать этот контракт.
- Уверенность: **high**.

### `src/three/Terrain.ts`

- Почему выглядит мёртвым: `createValleyTerrain`, `sampleTerrainHeight`, `pathCenterX`, `snapToTerrain` не импортируются текущим `src`-кодом. `LevelTerrain.ts` явно описывает себя как замену/новую инфраструктуру для старого terrain.
- Все найденные ссылки: внутренние вызовы внутри `src/three/Terrain.ts`; упоминание `Terrain.ts` в комментарии `src/three/LevelTerrain.ts:6` и документах — не runtime import.
- Риск удаления: medium — это процедурная сцена/эксперимент, потенциально используемый ручными скриптами или старой веткой.
- Уверенность: **high** для текущего приложения, **medium** для всего репозитория.

### `src/three/WaterSurface.ts`

- Почему выглядит мёртвым: тип `WaterSurface` и `createWaterSurface` не импортируются текущим кодом; активные водные реализации используют `RiverWater`/другие scene helpers.
- Все найденные ссылки: только определения внутри `src/three/WaterSurface.ts`; внешних ссылок не найдено.
- Риск удаления: low/medium — возможно сохранённый прототип для будущего уровня; удаление не должно влиять на текущий bundle.
- Уверенность: **high**.

### `src/three/avatar/heroLooks.ts`

- Почему выглядит мёртвым: `HERO_LOOK_GLB`, `HeroLookId`, `HERO_LOOK_LABEL` не импортируются; текущий выбор героя реализован через `BaseLevelScene`, `BarsikAvatar` и `castModels`.
- Все найденные ссылки: только определения внутри файла; документационные упоминания отдельных GLB не являются ссылками на этот модуль.
- Риск удаления: medium — модуль может быть частью вырезанного `?look=`/shop-прототипа и понадобиться при возврате этой функции.
- Уверенность: **high** для текущего runtime.

### `src/audio/narration.ts`: `shouldNarrateHudLine`

- Почему выглядит мёртвой: функция экспортируется, но не импортируется и не вызывается в `src`, `api`, `supabase` или scripts.
- Все найденные ссылки: определение `src/audio/narration.ts:2`; внешних ссылок не найдено.
- Риск удаления: low — может быть ручной/будущий фильтр для TTS; перед удалением проверить намерение voice-пайплайна.
- Уверенность: **high**.

### `src/vite-env.d.ts`

- Почему выглядит мёртвым: не имеет обычных импортов.
- Все найденные ссылки: `tsconfig` включает весь `src`; файл содержит reference-директиву `vite/client`.
- Риск удаления: high — TypeScript/Vite-типы `import.meta.env` могут перестать типизироваться.
- Уверенность мёртвого статуса: **low**; это compile-time entry point, не кандидат на удаление.

## 2. Компоненты

Явно мёртвых React-компонентов не подтверждено.

- `MissionScreen`, `EpisodeScreen`, `QuickStartScreen`, `SoftGateController`, `SettingsPanel` и все `Mission0..16Screen` имеют активные импорты/маршруты.
- `HubScreen` — текущая реализация вкладки «Город»; старый `CityScreen` в текущем `src` отсутствует.
- Старые упоминания `LoginScreen`, `BottomActionBar`, `CityScreen` находятся в `README.md`, `ARCHITECTURE.md`, `QUICKSTART.md` и `docs/*`, но соответствующих текущих файлов нет. Это stale documentation, не живой компонент.

## 3. Функции

Подтверждённый кандидат — `shouldNarrateHudLine` выше.

Отдельно обнаружен `src/utils/cityStages.ts` с четырьмя внешне неиспользуемыми функциями: `cityProgress`, `hasFeature`, `cityTitle` и экспортируемая через типовая модель `CITY_STAGES`. Они рассматриваются как один модуль-кандидат, поскольку удаление любой части оставляет мёртвый остаток.

Остальные подозрения по функциям нельзя считать безопасными: Three.js helpers часто вызываются через scene lifecycle, side-effect imports или dynamic imports. TypeScript `noUnusedLocals` уже ловит локальные неиспользуемые символы, но не ловит публичные экспортируемые функции без callers.

## 4. API endpoints

| Endpoint | Почему не считаю мёртвым | Все найденные ссылки | Риск удаления | Уверенность |
|---|---|---|---|---|
| `api/admin/overview.ts` → `/api/admin/overview` | Admin UI вызывает `adminApi.overview()`; URL строится динамически | `src/admin/api.ts:158`, `src/admin/panels/OverviewPanel.tsx:20`, `docs/ADMIN.md:84` | Сломается обзор админки | high |
| `api/admin/players.ts` → `/api/admin/players` | Admin UI использует list/read/patch/delete | `src/admin/api.ts:160-172`, `src/admin/panels/PlayersPanel.tsx:26`, `docs/ADMIN.md:85` | Сломаются support-операции и восстановление сейвов | high |
| `api/admin/leaderboard.ts` → `/api/admin/leaderboard` | Admin UI читает board и меняет hidden | `src/admin/api.ts:174-180`, `src/admin/panels/BoardPanel.tsx`, `docs/ADMIN.md:86` | Потеря модерации рейтинга | high |
| `api/admin/audit.ts` → `/api/admin/audit` | Admin UI читает журнал | `src/admin/api.ts:182-183`, `src/admin/panels/AuditPanel.tsx:27`, `docs/ADMIN.md:87` | Потеря audit trail | high |
| `supabase/functions/city-say/index.ts` | Внешний Supabase Edge entry point; вызов может быть из deployed client/config | `supabase/city_chat.sql:14`, `docs/ADMIN.md`/`docs/S1_COMPLETION_PLAN.md`, runtime contract в `src/net/hub.ts` | Обход/поломка child-safety chat flow | high |

## 5. npm-зависимости

Мёртвых direct dependencies не подтверждено:

- `react`, `react-dom`, `three`, `zustand` используются в runtime;
- `@supabase/realtime-js` используется в `src/net/hub.ts`;
- `vite`, `@vitejs/plugin-react`, `typescript`, `typescript-eslint`, `eslint`, `@eslint/js`, `globals` и ESLint plugins используются конфигурацией/скриптами;
- `@types/*` используются TypeScript-конфигурацией и импортами типов.

Риск удаления любой dev dependency: build/lint/type-check или Vite config может сломаться. Для окончательной проверки нужен dependency graph в CI после удаления, поэтому кандидатов на удаление не предлагаю.

## 6. Env-переменные

### `OPENAI_API_KEY`

- Почему выглядит мёртвой: встречается только в `.env.example:2`.
- Все найденные ссылки: `.env.example:2`.
- Риск удаления: medium — может требоваться внешним ручным voice/content tooling вне runtime.
- Уверенность: **medium**.

### `TRIPO_API_KEY`

- Почему выглядит мёртвой: встречается только в `.env.example:4`; текущий код Tripo API не вызывает.
- Все найденные ссылки: `.env.example:4`.
- Риск удаления: low/medium — ручной asset workflow может читать её вне `src`.
- Уверенность: **medium**.

### `TOGETHER_API_KEY`

- Почему выглядит мёртвой: встречается только в `.env.example:18`.
- Все найденные ссылки: `.env.example:18`.
- Риск удаления: low — runtime и scripts её не читают.
- Уверенность: **high**.

### Не orphan, но не отражена в `.env.example`: `BLOB_READ_WRITE_TOKEN`

- Используется `scripts/upload-blob.mjs:5-22`.
- Это не мёртвый env, а неполная документация окружения; добавлять или удалять переменную без решения по blob workflow не следует.

## 7. Feature flags и write-only состояние

### `barsik_cloud_pending`

- Почему выглядит мёртвым: записывается в `src/components/SoftGateModal.tsx:68-76`, но чтений/обработчика очереди в коде нет.
- Все найденные ссылки: `src/components/SoftGateModal.tsx:68`, `docs/SEASON_1_FULL_SPEC.md:504`, `docs/ONBOARDING_PROGRESSIVE.md:37`.
- Риск удаления записи: medium — сейчас это только несрабатывающая заготовка cloud sync, но её могут использовать ручные инструменты/будущая миграция.
- Уверенность: **high** для отсутствующего consumer-а; **medium** для решения удалить саму запись.

Активные flags/QA query-параметры, ошибочно похожие на мёртвые:

- `VITE_HUB_REALTIME` → читается в `src/net/hub.ts:33-37`;
- `?admin=1`, `?mission=N`, `?hub=1`, `?tab=...`, `?lang=kk` → читаются в `src/main.tsx`/`src/App.tsx`;
- `?qa=1` → читается в `src/dev/qaConsole.ts`, подключение через `src/main.tsx`;
- `?fps=1` → читается `src/dev/fpsSampler.ts`, sampler подключён в `BaseLevelScene`.

## 8. CSS

Файлов-кандидатов не найдено: каждый CSS-файл из `src` имеет импорт из компонента/страницы или глобальный импорт.

Низкоуверенные зоны для будущего CSS-cleanup:

- динамические классы в `TravelMapScreen`, `HubScreen`, Three.js overlays;
- legacy selectors, которые могут быть нужны публичным `model-gallery`/ручным HTML;
- `src/index.css` и `src/components/ui/ui.css` — глобальные стили, где поиск по импортам недостаточен.

Удаление отдельных селекторов требует browser coverage/screenshot regression.

## 9. Старые миграции и дубли

### Устаревшие документы с дублирующей архитектурой

- `ARCHITECTURE.md`, `README.md`, `QUICKSTART.md`, `MIGRATION_PLAN.md` описывают раннюю структуру с `LoginScreen`, `BottomActionBar`, `CityScreen`, `src/utils/api.ts` и JSON-level configs, которых нет в текущем runtime.
- Все найденные ссылки: `README.md:109,111,131,213,274`; `ARCHITECTURE.md:27-37,70-83,143-185`; `QUICKSTART.md:36-63,106,134-149`; `MIGRATION_PLAN.md:15-22`; актуальные исключения и решение по `HubScreen` — `product-state.md`, `docs/code-map.md`, `docs/CLEANUP_AUDIT.md`.
- Риск удаления/архивации: low для runtime, medium для onboarding и исторического контекста.
- Уверенность stale: **high**.

### `docs/CLEANUP_AUDIT.md` как предыдущий аудит

- Это не dead code, но дублирует часть настоящего отчёта и уже фиксирует кандидатов `CityScreen/CityScene`, vanilla `js/css`, voxel prototype и legacy assets.
- Риск удаления: medium — может быть ссылкой процесса/историей решений.
- Уверенность duplicate report: **high**.

### SQL

- `supabase/fix_leaderboard_rls.sql`, `supabase/admin_schema.sql`, `supabase/city_chat.sql` не являются мёртвыми дубликатами: они покрывают разные границы доступа, admin audit/hidden и Realtime chat.
- Они идемпотентны и выглядят как ручные deploy migrations без migration runner-а. Удаление любой может оставить production schema в небезопасном/неполном состоянии.
- Риск удаления: high. Уверенность «не удалять как duplicate»: high.

### Asset duplicates

- `*_meshy_legacy.glb`, `*_rigged.glb`, `*_rigged.prev.glb`, `_quarantine_*`, gallery manifest и `public/model-gallery/*` выглядят как legacy/rollback/quarantine, но некоторые явно доступны через gallery или fallback loader.
- Все найденные ссылки: `public/model-gallery/manifest.json`, `public/model-gallery/index.html`, `src/three/castModels.ts`, `src/three/scenes/BaseLevelScene.ts`, `docs/S1_MODEL_REPLACEMENT_AUDIT.md`.
- Риск удаления: medium/high — поломка ручной gallery, fallback-модели или rollback.
- Уверенность мёртвого статуса отдельных файлов: **low** без проверки URL и загрузки каждой модели.

## Рекомендация перед удалением

1. Сначала подтвердить судьбу `cityStages`, `Terrain`, `WaterSurface`, `heroLooks`, `narration.ts` и `barsik_cloud_pending`.
2. Для каждого подтверждённого кандидата сделать отдельный небольшой commit с type-check/build и smoke-проверкой затронутых экранов.
3. Отдельным изменением обновить stale docs; не смешивать это с удалением runtime-кода.
4. SQL и asset-legacy удалять только после проверки Supabase deployment history, Vercel routes и public model-gallery.
