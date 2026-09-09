# PROJECT OVERVIEW — barsik-game

Краткий onboarding технического лида. Состояние проверено 2026-08-29.

## 1. Запуск

```bash
cd /Users/aleksandr/Project/other/job/barsik-game
npm install
cp .env.example .env       # заполнить только нужные значения
npm run dev                # http://localhost:8765
```

Команды:

- `npm run build` — `tsc && vite build`, результат в `dist/`.
- `npm run preview` — просмотр production-сборки.
- `npm run type-check` — проходит.
- `npm run lint` — сейчас падает на двух ошибках `no-useless-assignment` в `src/components/screens/TravelMapScreen.tsx`; есть предупреждение в `src/main.tsx`.
- `npm run voice:check` — проверка voice manifest.
- Тестового runner-а и автоматических тестов в репозитории не обнаружено.
- Для локальной проверки `/api/admin/*` нужен `vercel dev` или preview deploy: обычный Vite API-функции не запускает.

## 2. Архитектурная схема

```text
index.html → src/main.tsx → src/App.tsx
                         ├─ Welcome / QuickStart
                         ├─ 17 lazy Mission*Screen + Three.js scenes
                         ├─ HubScreen (опциональный Supabase Realtime)
                         └─ GamePage → map / friends / hub / shop / leaderboard / QR

React UI ── Zustand (useGameStore, useUIStore)
              ├─ localStorage: barsik_player, barsik_progress, UI flags
              ├─ Supabase REST: read-only barsik_leaderboard
              └─ Supabase Realtime: presence/movement/chat, opt-in

Admin UI (?admin=1 or /admin) → /api/admin/* (Vercel Functions)
                              → Supabase PostgREST via service-role key

Chat: browser → city-say Edge Function → moderation + DB → Realtime broadcast
```

Стек: React 18, TypeScript strict, Vite 7, Three.js, Zustand, Supabase, Vercel.
Игровая графика и сцены находятся в `src/three/`; контент и голоса — в коде и `public/assets/`.

## 3. Сущности и потоки данных

- `Player`: локальный профиль/идентификатор, ник, язык RU/KK, возрастная категория, контакты.
- Игровой прогресс: `unlockedLevels`, `currentLevel`, `levelStars`, `stars`, `friends`, `cityObjects`, `outfit`, `season1Complete`; версия сохранения `GAME_SAVE_VERSION = 2`.
- Уровни: `LEVEL_CONFIGS` и `src/three/scenes/Level*Scene.ts`; завершение → reward → Zustand → localStorage.
- Рейтинг: клиент читает Supabase view `barsik_leaderboard`, фильтрует невозможные/небезопасные строки и дедуплицирует по имени.
- Админка читает/изменяет `barsik_saves`, `barsik_admin_audit` через серверные `/api/admin` endpoints.
- Hub: presence и realtime-позиции; свободный чат должен идти через `supabase/functions/city-say`.

## 4. Критичные файлы

- `src/main.tsx`, `src/App.tsx` — вход, режим admin, маршрутизация экранов.
- `src/store/useGameStore.ts`, `src/store/useUIStore.ts` — состояние и миграция/персистентность.
- `src/types/index.ts`, `src/utils/levels.ts`, `src/utils/score.ts` — контракт данных, уровни, рейтинг.
- `src/three/scenes/BaseLevelScene.ts`, `src/three/scenes/Level*Scene.ts` — игровой runtime и 3D-уровни.
- `src/three/AssetKit.ts`, `src/three/createGameGltfLoader.ts`, `public/assets/` — загрузка и имена ассетов.
- `src/utils/leaderboard.ts`, `src/net/hub.ts`, `src/utils/moderation.ts` — внешние сетевые потоки и safety.
- `api/admin/_lib.ts`, `api/admin/*.ts`, `src/admin/*` — админская авторизация/API/UI.
- `supabase/fix_leaderboard_rls.sql`, `supabase/admin_schema.sql`, `supabase/city_chat.sql` — границы доступа БД.
- `vite.config.ts`, `package.json`, `.env.example`, `vercel.json`, `netlify.toml` — сборка/деплой/окружение.

## 5. Риски

- Прогресс игрока фактически local-first и не синхронизируется в облако; очистка браузера/смена устройства теряет сейв.
- В `src/utils/leaderboard.ts` и `src/net/hub.ts` есть fallback URL и публичный anon key; это допустимо только при корректном RLS.
- Service-role ключ админки критичен: он не должен попадать в `VITE_*` или browser bundle. `ADMIN_TOKEN` хранится в окружении, проверка — shared-secret.
- Realtime hub выключен по умолчанию; включение без применённого `city_chat.sql` позволяет обходить browser-фильтр.
- Rate limit `city-say` хранится в памяти edge-инстанса и не является глобальной защитой от flood.
- Нет unit/e2e/regression suite; lint уже красный. 3D-регрессии и мобильный RU/KK matrix требуют ручной проверки.
- В рабочем дереве много незакоммиченных изменений и новых файлов; нельзя принимать результаты git diff за чистый baseline.
- Индекс codebase-memory содержит legacy `js/` узлы и может быть не полностью синхронен с текущим checkout.

## 6. Quick wins

1. Убрать две lint-ошибки и добавить `npm run check` (`type-check` + `lint`) в CI.
2. Добавить минимальные тесты для `migrateProgress`, `completeLevel`, `scoreOf` и moderation.
3. Вынести повторяющиеся Supabase URL/headers в единый клиент и убрать hardcoded fallback после гарантированного env на deploy.
4. Зафиксировать smoke matrix: welcome → mission 0 → reward → reload, уровни 0/1/8/16, desktop/mobile, RU/KK.
5. Проверить и документировать применённые SQL-миграции и RLS в отдельном deploy checklist.
6. Спланировать cloud-save через серверную/edge-функцию; не возвращать browser write-доступ к `barsik_saves`.

## 7. Нельзя менять без проверки

- RLS/grants/views в Supabase и порядок применения `supabase/*.sql`.
- Формат `barsik_progress`, `GAME_SAVE_VERSION`, `migrateProgress` и localStorage keys.
- Ограничения сезона (17 уровней, 9 друзей), `score.ts` и клиентскую проверку leaderboard.
- `ADMIN_TOKEN`, service-role handling, заголовки `x-admin-token`/`x-admin-actor` и API mutations.
- Lifecycle Three.js: `init`, resize, animation loop, dispose, загрузку GLB и публичные пути ассетов.
- Moderation/chat flow, `VITE_HUB_REALTIME` и CORS без end-to-end проверки Realtime authorization.
- Имена/структуру файлов в `public/assets`, voice manifest и fallback-моделей.
- Любые изменения поверх текущих незакоммиченных файлов — сначала определить владельца и baseline.
