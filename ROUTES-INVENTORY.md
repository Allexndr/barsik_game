# Routes Inventory

**Дата:** 12.09.2026 · **Среда:** локальный Vite/Playwright · **Production не проверялся.**

## Срез архитектуры

- Frontend: React 18 + TypeScript + Vite.
- Routing: собственного router нет; экран хранится в Zustand (`currentScreen`, `activeTab`),
  уровень выбирается через `MissionRoute`.
- 3D: императивный Three.js, 17 сцен через общий `BaseLevelScene`.
- Состояние: Zustand + `localStorage`; облачный прогресс — Supabase Auth/RPC, если env настроен.
- Server: Vercel-style функции в `api/admin/*`; Supabase Edge Function `city-say` хранится отдельно.
- База/таблицы: `barsik_progress`, `barsik_saves`, `barsik_leaderboard`, admin audit и chat tables.
- Очереди, ORM, Redis/cache, GraphQL, WebSocket-сервер и Server Actions не обнаружены.

## Пользовательские страницы и экраны

| Роут/вход | Тип | Методы | Роль | Описание | Файлы | Статус |
|---|---|---|---|---|---|---|
| `/` | SPA landing | GET | guest/player | Welcome, навигация по секциям, CTA | `src/App.tsx`, `src/components/WelcomeScreen.tsx` | OK |
| `/?quick` через CTA | SPA screen | client state | guest/player | короткий старт и имя игрока | `QuickStartScreen.tsx`, `useUIStore.ts` | OK |
| `/?mission=0` | dev-only launcher | GET, только DEV | QA/developer | прямой вход в «Тропу домбры» | `App.tsx`, `Mission0Screen.tsx`, `Level0Scene.ts` | OK local; hidden in prod |
| `/?mission=1..16` | dev-only launcher | GET, только DEV | QA/developer | прямой вход в 16 динамических сцен | `MissionRoute.tsx`, `missions.ts`, `Level*Scene.ts` | OK local; hidden in prod |
| `/?tab=travel|friends|city|shop|leaderboard|qr` | dev-only launcher | GET, только DEV | QA/developer | прямой вход в meta-экран | `App.tsx`, `GamePage.tsx` | OK local; hidden in prod |
| `/` + `GamePage` | SPA screen | client state | player | карта, награды и навигация по сезону | `GamePage.tsx`, `NavBar.tsx` | OK |
| `activeTab=travel` | SPA screen | client state | player | карта 17 уровней, unlock/replay | `TravelMapScreen.tsx` | OK |
| `activeTab=friends` | SPA screen | client state | player | коллекция друзей и 3D previews | `FriendsScreen.tsx` | OK |
| `activeTab=city` | SPA screen | client state | player | 3D hub с локациями и emotes | `HubScreen.tsx`, `HubScene.ts` | OK; realtime gated |
| `activeTab=shop` | SPA screen | client state | player | локальный магазин гардероба | `ShopScreen.tsx`, `wardrobe.ts` | OK local |
| `activeTab=leaderboard` | SPA screen | GET Supabase | guest/player | чтение публичного рейтинга | `LeaderboardScreen.tsx`, `utils/leaderboard.ts` | warning: read-only, network dependent |
| `activeTab=qr` | SPA screen | client state | player | демонстрационный сундук | `QRChestScreen.tsx` | OK; real QR out of scope |
| `/admin` | admin entry | GET + API calls | admin only | ленивый вход в админ-панель | `src/main.tsx`, `src/admin/AdminApp.tsx` | warning: API/deploy required |
| `/?admin=1` | admin entry | GET + API calls | admin only | альтернативный admin entry | `src/main.tsx` | warning: hidden, not a security boundary |
| `/model-gallery` | static internal page | GET | anyone with URL | каталог моделей | `public/model-gallery/index.html` | warning: public internal/debug surface |
| `/model-viewer.html` | static internal page | GET | anyone with URL | просмотр отдельной модели | `public/model-viewer.html` | warning: public internal/debug surface |
| `/voxel-prototype/` | static prototype | GET | anyone with URL | старый прототип | `public/voxel-prototype/index.html` | warning: should not be published |
| `/assets/*` | static files | GET | public | textures, models, voice, images | `public/assets/` | OK; cache policy only assets |

## API и внешние функции

| Endpoint | Методы | Роль/аутентификация | Вход | Выход/ошибки | Файлы | Статус |
|---|---|---|---|---|---|---|
| `/api/admin/overview` | POST/GET handler | verified Supabase admin или legacy token при явном flag | query не используется | aggregate overview; 401/403/503/500 | `api/admin/overview.ts`, `_lib.ts` | warning: только Vercel/preview |
| `/api/admin/players` | GET | admin | `key`, `q`, `limit` | player(s); 400/404/401/403/500 | `api/admin/players.ts` | warning: service-role DB |
| `/api/admin/players` | PATCH | admin | `{key, patch, reason}` | updated player; 400/404/500 | same | warning: editable fields need domain validation |
| `/api/admin/players` | DELETE | admin | `key` | deleted key; 400/404/500 | same | high-impact reversible only by DB backup |
| `/api/admin/leaderboard` | GET | admin | `limit` | rows + impossible markers | `api/admin/leaderboard.ts` | warning |
| `/api/admin/leaderboard` | POST | admin | `{key, hidden, reason}` | updated row; 400/404/500 | same | warning |
| `/api/admin/audit` | GET | admin | `limit` | audit entries; missing table flag | `api/admin/audit.ts` | warning |
| Supabase Auth `/auth/v1/signup` | POST | public anon signup | `{}` | access/refresh session | `src/net/progression.ts` | external; not local Vite API |
| Supabase Auth `/auth/v1/token` | POST | refresh token | `refresh_token` | new session | same | external |
| Supabase RPC `barsik_complete_level` | POST | authenticated anon Supabase session | level, stars, friend | canonical progress; 401/4xx | `src/net/progression.ts`, `supabase/progression.sql` | external; RLS/RPC staging gate |
| Supabase REST `barsik_leaderboard` | GET | anon key/read policy | select/order/limit | public leaderboard | `src/utils/leaderboard.ts` | external |
| Supabase Realtime `hub:*` | subscribe/broadcast | anon/authenticated when feature flag enabled | presence, coords, phrase/text | live peers; channel errors | `src/net/hub.ts` | warning: client broadcast path |
| Supabase Edge `city-say` | POST/OPTIONS | function endpoint; body validation | room, nick, device, text | accepted/blocked/rate-limit errors | `supabase/functions/city-say/index.ts` | warning: not used by current hub client |

## Guards and hidden surfaces

- Admin entry detection is in `src/main.tsx`; UI visibility is not authorization.
- Actual admin authorization is in `api/admin/_lib.ts`: Supabase identity/admin claim, allow-listed
  emails, or legacy shared token only if `ADMIN_ALLOW_LEGACY_TOKEN=true`.
- Dev launchers and QA globals are gated by `import.meta.env.DEV`; production bundle should not expose them.
- No explicit 404, 403 or 500 page exists. React has a generic `AppErrorBoundary`; API errors use JSON.
- No file upload, generation UI, user profile page, password-reset page or payments route exists.
