# Routes Functional Audit

**Дата:** 12.09.2026 · **Окружение:** local Vite + Chromium/Pixel emulation. Production и Supabase API не вызывались.

## Страницы и SPA flow

| Поверхность | Роли | Проверка | Статус | Проблемы |
|---|---|---|---|---|
| Welcome `/` | guest/player | открытие, CTA, mobile layout | OK | production parity не проверена |
| QuickStart | guest/player | старт и переход в L0/game | OK | нет отдельного auth flow |
| L0–L16 | player/QA | boot, canvas, intro→playable, console/page/request errors | OK: 17/17 | full human golden path не покрыт официальным тестом |
| Map/travel | player | completed save, replay CTA, keyboard pin | OK | cloud save не проверен |
| Friends | player | route exists/lazy preview path | warning | 3D asset fallback/device visual QA open |
| Hub/city | player | local hub route and scene entry | warning | realtime disabled by default; server chat path not wired to client |
| Shop | player | route/lazy screen | warning | local economy, real account persistence not staged |
| Leaderboard | guest/player | loading/empty/error rendering and read path in code | warning | no staging API run; no write path in UI |
| QR chest | player | route and demo state | OK local | real QR/product flow out of scope |
| Pause/settings | player | pause priority, language, restart, hidden-tab recovery | OK | no explicit offline banner for all external calls |
| Admin `/admin` | admin | static entry/login code review | warning | local Vite cannot execute `/api/admin/*`; preview/staging required |
| Model gallery/viewer | anyone with URL | static route/config review | warning | public internal surface |
| Voxel prototype | anyone with URL | static route/config review | warning | should be excluded from public artifact |

## Evidence

- `npm run test:e2e` → **64/64 PASS** in one worker.
- Coverage includes 17/17 level boot, 17/17 intro→playable, 18 device matrix cases, pause/restart,
  language, hidden tab, replay map entry and mobile touch-style input.
- `npm run test:perf` → 4/4 PASS; samples are headless-only and not a real-device acceptance gate.
- `npm test -- --run` → 25/25; `npm run build` → PASS; `npm run lint` → 0 errors, 2 existing Fast Refresh warnings.
- No console/page/failed-request errors were collected by the tested local cases.

## API functional boundary

| Surface | Local result | Required next check |
|---|---|---|
| `/api/admin/*` | not executable under `vite dev`; static handlers reviewed | `vercel dev`/preview with test Supabase and role matrix |
| Supabase Auth/RPC | not called to avoid external state | isolated staging project, anonymous session/refresh/401 tests |
| leaderboard GET | client error/empty states implemented | staging RLS, malformed response, timeout and 5xx |
| Realtime hub | default offline path only | private channel/RLS, forged payload, reconnect and rate tests |
| `city-say` | source/schema reviewed, not invoked | staging function with invalid JSON, CORS, abuse and DB failure tests |
