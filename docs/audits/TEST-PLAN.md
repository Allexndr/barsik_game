# Test plan

Дата: 2026-08-30. План покрытия и текущий статус реализации.

## Состояние покрытия

- В `package.json` настроены Vitest и Playwright scripts.
- Реализованы unit tests для migration, moderation, score, progression contract и UI restart;
  integration contract tests для progression network и admin identity лежат в
  `tests/net/progression.integration.test.ts` и `tests/api/admin.integration.test.ts`.
- Playwright покрывает boot всех 17 уровней, meta/restart/pause/hidden-tab и mobile touch.
- Supabase RLS/Realtime/rate-limit, production API и полное phase gameplay всё ещё требуют
  staging или manual evidence.

## Критичные сценарии

1. Первый запуск, создание игрока, язык и восстановление local save.
2. Навигация по карте, gating уровней, прохождение миссии, reward и повторное сохранение.
3. Все 17 уровней: загрузка сцены, управление, камера, интеракции, outro.
4. Получение друзей, подсчёт звёзд/score, восстановление после reload.
5. Leaderboard: успешный ответ, пустой ответ, malformed data, HTTP/network error.
6. Hub: offline fallback, realtime presence/movement/chat, stale peers, leave/disconnect.
7. `city-say`: validation, moderation, rate limit, DB insert и broadcast.
8. Admin auth и CRUD: token, overview, players, leaderboard moderation, audit log.
9. WebGL/asset failure, mobile viewport/orientation, RU/KK и audio fallback.

## Unit tests

### U1. Миграция и валидация local save

- **Что проверяет:** `migratePlayer`, `migrateProgress`, invalid JSON/shape, старые версии, дубликаты друзей, currentLevel после завершённого уровня.
- **Где должен лежать:** `src/__tests__/save-migrations.test.ts` или рядом с модулем миграции.
- **Входные данные:** fresh save; legacy save без `version`; повреждённые поля; завершённый L0 при `currentLevel=0`; неизвестный friend id.
- **Ожидаемый результат:** корректная нормализованная схема; безопасный reject invalid data; currentLevel не откатывается; неизвестные сущности не ломают запуск.
- **Реальный риск:** потеря прогресса и повторный запуск уже пройденных уровней.

### U2. Reducers игрового прогресса

- **Что проверяет:** `completeLevel`, `addFriend`, stars, unlocks, idempotency повторного outro.
- **Где должен лежать:** `src/store/__tests__/useGameStore.test.ts`.
- **Входные данные:** новый игрок; повторное завершение L0/L16; reward с другом; duplicate friend; максимальный progress.
- **Ожидаемый результат:** reward начисляется ровно один раз; friend не дублируется; unlock/currentLevel и local persistence согласованы.
- **Реальный риск:** дублирование наград, невозможность продолжить сезон или потеря unlock state.

### U3. Score и leaderboard normalization

- **Что проверяет:** `scoreOf`, `isPlausible`, `dedupeByName`, сортировку и limit.
- **Где должен лежать:** `src/utils/__tests__/leaderboard.test.ts`.
- **Входные данные:** одинаковые имена в разных регистрах; negative/over-season levels; null stars; impossible rows; tie scores.
- **Ожидаемый результат:** опасные строки отбрасываются; остаётся лучший score; порядок и limit стабильны.
- **Реальный риск:** накрученные/битые записи попадают ребёнку в рейтинг или ломают UI.

### U4. Moderation и safe chat

- **Что проверяет:** длину, пустые строки, punctuation, запрещённые слова, nick normalization и chat id validation.
- **Где должен лежать:** `src/utils/__tests__/moderation.test.ts` и `src/utils/__tests__/safeChat.test.ts`.
- **Входные данные:** boundary lengths, пробелы, смешанные алфавиты, запрещённые фразы, неизвестный numeric chat id.
- **Ожидаемый результат:** валидный текст нормализован; запрещённый текст отклонён; неизвестные ids не проходят.
- **Реальный риск:** unsafe child-facing message или расхождение client/server validation.

### U5. Realtime payload sanitization

- **Что проверяет:** `sanitize`, `sanitizeIdentity`, pose/coordinate clamps и unknown peer rejection.
- **Где должен лежать:** `src/net/__tests__/hub-sanitize.test.ts`.
- **Входные данные:** NaN/Infinity, coordinates ±10000, unknown id, oversized name, invalid pose, valid presence followed by movement.
- **Ожидаемый результат:** данные clamp/normalize; unknown sender discarded; valid peer updated.
- **Реальный риск:** чужой клиент уносит avatar за карту, ломает сцену или выводит вредный текст.

### U6. API query/input builders

- **Что проверяет:** escaping/encoding `player_key`, search query, limits и allowed admin patch fields.
- **Где должен лежать:** `api/admin/__tests__/_lib.test.ts`, `players.test.ts`.
- **Входные данные:** commas/brackets/parentheses, Unicode key, limit 0/negative/huge, forbidden patch fields.
- **Ожидаемый результат:** безопасный PostgREST filter; limits bounded; forbidden fields ignored/rejected.
- **Реальный риск:** неправильный player lookup, массовая выборка или изменение неразрешённых колонок.

## Integration tests

### I1. Admin auth и error contract

- **Что проверяет:** `handler`/`guard`, valid/invalid/missing token, missing env, JSON error contract и no-store response.
- **Где должен лежать:** `api/admin/__tests__/_lib.integration.test.ts` с mock `fetch`/HTTP handler.
- **Входные данные:** valid token; wrong token; empty `ADMIN_TOKEN`; upstream 401/404/500; non-JSON upstream response.
- **Ожидаемый результат:** 401/503/500 имеют стабильный безопасный error code; секреты не попадают в response; запросы без auth не доходят до DB.
- **Реальный риск:** открытая админка, утечка внутренних DB details и нестабильная диагностика.

### I2. Admin player lifecycle

- **Что проверяет:** GET one/search, PATCH, DELETE, audit write и not-found paths.
- **Где должен лежать:** `api/admin/__tests__/players.integration.test.ts` с PostgREST test double или staging DB.
- **Входные данные:** existing key, missing key, valid/forbidden patch, DB error on before/update/audit.
- **Ожидаемый результат:** правильные status/body; PATCH/DELETE не затрагивают чужие rows; audit получает actor/action; ошибки не маскируются как success.
- **Реальный риск:** потеря детского save, неаудитируемое изменение или частично выполненная операция.

### I3. Admin overview and moderation endpoints

- **Что проверяет:** funnel/histogram/integrity semantics, limits, hidden/unhidden flow.
- **Где должен лежать:** `api/admin/__tests__/overview.integration.test.ts`, `leaderboard.integration.test.ts`.
- **Входные данные:** empty table; hidden rows; boundary levels 0/17/18; friends 0/9/10; null values; DB timeout.
- **Ожидаемый результат:** counts не включают hidden там, где нельзя; boundary values корректны; DB failure даёт controlled error.
- **Реальный риск:** неверные решения по retention/completion и неправильная модерация рейтинга.

### I4. `city-say` validation, persistence и broadcast

- **Что проверяет:** method/JSON/room/device/nick/text validation, moderation reject, rate limit, DB insert и realtime broadcast.
- **Где должен лежать:** `supabase/functions/city-say/index.test.ts` или Deno test рядом с function.
- **Входные данные:** OPTIONS/GET; malformed JSON; unknown room; missing device; unsafe/too-long text; repeated device; Supabase insert error; broadcast error.
- **Ожидаемый результат:** стабильные 400/429/500; rejected message не сохраняется; valid message сохраняется и broadcast получает тот же id; DB errors logged safely.
- **Реальный риск:** обход child-safety фильтра, спам, потеря сообщения или необъяснимый 500.

### I5. Storage persistence integration

- **Что проверяет:** store actions → `localStorage` → reload/migration round trip.
- **Где должен лежать:** `src/store/__tests__/persistence.integration.test.ts`.
- **Входные данные:** complete level, add friend, settings changes, reload, unavailable/throwing storage.
- **Ожидаемый результат:** сериализованные данные читаются обратно без изменения score/unlocks; storage failure не ломает UI.
- **Реальный риск:** награда видна до reload, но исчезает после перезапуска.

## E2E tests

### E1. New player critical path

- **Что проверяет:** Welcome → nick/language → Quick Start → L0 → reward → map → Continue.
- **Где должен лежать:** `e2e/new-player.spec.ts` (Playwright).
- **Входные данные:** clean browser context; RU и KK; desktop и mobile viewport.
- **Ожидаемый результат:** playable scene, movement/interact work, outro persists, next level unlocked, reload restores state.
- **Реальный риск:** блокирующий onboarding или потеря первого reward.

### E2. Returning player and corrupted save

- **Что проверяет:** valid continuation and invalid-save recovery.
- **Где должен лежать:** `e2e/save-recovery.spec.ts`.
- **Входные данные:** fixtures from `docs/qa/save-fixtures.json`; malformed localStorage; mid-season and completed saves.
- **Ожидаемый результат:** valid fixtures open expected screen; corrupt fixture shows safe recovery message and does not render broken state.
- **Реальный риск:** silent progress loss and impossible navigation.

### E3. Level matrix smoke

- **Что проверяет:** each level 0–16 loads, reaches playable state, renders HUD, exits cleanly.
- **Где должен лежать:** `e2e/levels-smoke.spec.ts`.
- **Входные данные:** `?mission=N`, appropriate save fixture, RU/KK; representative desktop/mobile sizes.
- **Ожидаемый результат:** no console errors/unhandled rejections; loading completes; scene dispose on exit; expected reward metadata.
- **Реальный риск:** one broken lazy chunk/asset blocks an entire progression branch.

### E4. Meta screens

- **Что проверяет:** Travel map, Friends preview, Shop, Leaderboard, QR and Episode navigation.
- **Где должен лежать:** `e2e/meta-screens.spec.ts`.
- **Входные данные:** fresh, mid-season and completed fixtures; empty/error leaderboard responses.
- **Ожидаемый результат:** every tab opens; previews dispose; errors have usable UI; locked content remains locked.
- **Реальный риск:** regressions in high-frequency navigation and WebGL preview leaks.

### E5. Hub offline/realtime

- **Что проверяет:** solo fallback, connect/disconnect, movement throttling, presence, safe phrase/free chat.
- **Где должен лежать:** `e2e/hub.spec.ts` with mocked Realtime/WebSocket or controlled staging channel.
- **Входные данные:** `VITE_HUB_REALTIME` off/on; valid and malformed peer payloads; two browser contexts.
- **Ожидаемый результат:** offline hub remains playable; peers appear/disappear; unsafe text is not rendered; leave clears channel.
- **Реальный риск:** hub becomes unusable when realtime is unavailable or exposes unsafe remote data.

### E6. Admin operator journey

- **Что проверяет:** login, overview, player search, patch, leaderboard hide/unhide, audit view, logout.
- **Где должен лежать:** `e2e/admin.spec.ts` against isolated staging API/DB.
- **Входные данные:** valid/invalid token; seeded player; DB missing audit table; upstream 401/500.
- **Ожидаемый результат:** unauthorized user blocked; valid action reflected; audit row visible; errors actionable without secrets.
- **Реальный риск:** operators cannot recover saves or accidentally expose/administer data.

## Regression suite

- **R1 progression:** run E1 + all level smoke after any change to `useGameStore`, `App.tsx`, `levels.ts`, `MissionScreen` or scene base class.
- **R2 camera/input:** level 0/8/16 plus manual orientation matrix after changes to camera, joystick, resize or pointer handlers.
- **R3 save compatibility:** all fixtures in `docs/qa/save-fixtures.json` after changes to migration, schema, rewards or inventory flags.
- **R4 safety/API:** U4/U5 + I1/I4 after changes to chat, Supabase RLS, admin auth or request parsing.
- **R5 WebGL lifecycle:** E3/E4 plus repeated level↔hub navigation after changes to loaders, previews, `dispose()` or renderer quality.
- **R6 release gate:** `npm run type-check`, `npm run build`, automated smoke, then manual mobile RU/KK pass. Current `package.json` has type-check/build but no automated test command.

## Manual QA

### M1. Device and viewport matrix

- **Что проверяет:** touch joystick, camera orbit, orientation, safe-area, keyboard/autoplay and WebGL behavior.
- **Где должен лежать:** `docs/qa/manual-device-matrix.md` or release checklist.
- **Входные данные:** iOS Safari, Android Chrome, desktop Chromium; portrait/landscape; slow 3G/CPU throttle; RU/KK.
- **Ожидаемый результат:** no dead touch zones, no stuck loading, audio starts after gesture, UI readable and controls usable.
- **Реальный риск:** automated desktop tests miss device-only input/autoplay failures.

### M2. Visual level pass

- **Что проверяет:** camera framing, occlusion, reachable objectives, collision, lighting, reward presentation across 17 levels.
- **Где должен лежать:** `docs/qa/level-matrix.md` with screenshots and save fixture.
- **Входные данные:** fresh/mid/completed fixtures; each level’s intended spawn and interaction points.
- **Ожидаемый результат:** hero/objective stays visible; no soft-lock; reward and next-level state match design.
- **Реальный риск:** geometry/camera regressions are not reliably captured by DOM assertions.

### M3. Failure injection

- **Что проверяет:** missing GLB, failed voice manifest/clip, Supabase outage, malformed API response, localStorage unavailable.
- **Где должен лежать:** `docs/qa/failure-injection.md` with repeatable DevTools steps.
- **Входные данные:** blocked URLs, 404/500 overrides, offline mode, private browsing storage behavior.
- **Ожидаемый результат:** fallback/retry or safe error is visible; no infinite spinner; console error is classified.
- **Реальный риск:** production failures currently have uneven user messaging and limited diagnostics.

## Recommended implementation order

1. ✅ Add a test runner and deterministic unit coverage for save/safety boundaries.
2. 🟡 Add I1–I4: local admin/progression contracts are covered; Supabase staging cases remain.
3. 🟡 Add E1/E3/E5: level boot and hub fallback are covered; full gameplay/realtime remain.
4. 🟡 Add regression fixtures and M1–M3 as release gates; device/manual evidence remains.

Tests added in the current implementation phase are local-only and do not call production.
