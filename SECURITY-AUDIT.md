# Security Audit

**Дата:** 12.09.2026 · **Метод:** статический аудит кода, локальный route/e2e smoke и review конфигурации.
Production, база, секреты и внешние API не трогались. Это defensive audit, не эксплуатация production.

## Итог

- Подтверждённых critical-взломов локальной игры: **0**.
- Ключевые риски: клиентское доверие к localStorage, admin legacy-token режим, прямой client-to-client
  realtime broadcast при включении флага, публичные внутренние static pages и отсутствие доказанного
  staging-контура для API.
- XSS sink, `eval`, `new Function`, пользовательский HTML, upload и SSRF surface в приложении не найдены.

## Findings

### SEC-001 — HIGH — клиент управляет локальным прогрессом

- **Категория:** authz/data.
- **Затронуто:** `src/store/useGameStore.ts`, `src/App.tsx`, `src/components/MissionScreen.tsx`.
- **Описание:** unlocks, stars, friends и current level читаются из `localStorage`; пользователь DevTools
  может открыть уровни или изменить награды.
- **Воспроизведение:** изменить `barsik_progress` и перезагрузить страницу.
- **Влияние:** локальная накрутка и несовпадение с облачным прогрессом; это не даёт service-role доступа.
- **Рекомендация:** считать серверный RPC authority для competitive/ценностных данных, описать merge policy,
  оставить local-first только как offline cache.
- **Приоритет:** high; текущая offline-модель допустима только при отсутствии ценных призов.

### SEC-002 — HIGH при включении — legacy shared admin token

- **Категория:** auth/session.
- **Затронуто:** `api/admin/_lib.ts`, `src/admin/api.ts`.
- **Описание:** при `ADMIN_ALLOW_LEGACY_TOKEN=true` один статический `ADMIN_TOKEN` передаётся в custom header,
  хранится в `sessionStorage`, не имеет expiry/MFA/rotation и даёт полную admin-поверхность.
- **Влияние:** утечка токена открывает детские сейвы, редактирование и удаление.
- **Рекомендация:** оставить только короткоживущие Supabase identity sessions с server-side admin claim;
  legacy flag удалить после миграции.
- **Статус конфигурации:** по коду legacy отключён по умолчанию; требуется проверить env в preview без чтения значений.

### SEC-003 — HIGH при включении — realtime чат можно обойти

- **Категория:** authz/child-safety.
- **Затронуто:** `src/net/hub.ts`, `supabase/functions/city-say/index.ts`, `supabase/city_chat.sql`.
- **Описание:** безопасная Edge Function `city-say` валидирует и публикует сообщения, но текущий client hub при
  `VITE_HUB_REALTIME=1` сам отправляет `broadcast` для фраз и свободного текста. Изменённый клиент может вызвать
  channel.send напрямую и обойти server moderation.
- **Влияние:** произвольные сообщения детям при включённом realtime; по умолчанию функция выключена.
- **Рекомендация:** один серверный путь публикации, server-side private channel policy, не включать флаг до
  staging-проверки RLS и подтверждения, что client больше не broadcast-ит свободный текст.
- **Приоритет:** high before multiplayer; default-off снижает текущую экспозицию.

### SEC-004 — MEDIUM — PATCH admin не валидирует доменные значения

- **Категория:** input/data.
- **Затронуто:** `api/admin/players.ts`.
- **Описание:** allow-list полей есть, но `stars`, `levels`, `friends`, `save/data/payload` не проходят
  типовые bounds/schema validation перед service-role PATCH.
- **Влияние:** ошибочная admin-правка может создать невозможный progress или повредить JSON.
- **Рекомендация:** Zod/ручная schema validation, bounds сезона, JSON schema, optimistic concurrency/version field.
- **Приоритет:** medium.

### SEC-005 — MEDIUM — rate limit city-say зависит от client-provided device

- **Категория:** api/abuse.
- **Затронуто:** `supabase/functions/city-say/index.ts`.
- **Описание:** есть memory burst limiter и durable RPC, но идентификатор `device` присылает клиент и его можно
  менять; warm-instance Map не является глобальным лимитом.
- **Влияние:** обход лимитов и spam across cold starts.
- **Рекомендация:** server-issued anonymous subject/session, durable atomic quota, global alerting.
- **Приоритет:** medium before enabling chat.

### SEC-006 — MEDIUM — токены Supabase сессии в localStorage

- **Категория:** session.
- **Затронуто:** `src/net/progression.ts`.
- **Описание:** access/refresh token сохраняются в `barsik_auth_session` в localStorage.
- **Влияние:** любой будущий XSS в origin сможет прочитать refresh token; сейчас XSS sink не найден.
- **Рекомендация:** BFF/httpOnly secure sameSite cookie или короткий access token без durable refresh в браузере,
  плюс CSP и token revocation policy.
- **Приоритет:** medium.

### SEC-007 — LOW — публичные внутренние/debug static pages

- **Категория:** infra/info.
- **Затронуто:** `public/model-gallery`, `public/model-viewer.html`, `public/voxel-prototype`.
- **Описание:** URL доступны без авторизации; `.gitignore` исключает voxel prototype, но каталог public может попасть
  в deployment.
- **Влияние:** раскрытие внутренних ассетов/прототипов, увеличение attack surface; privilege escalation не доказана.
- **Рекомендация:** не включать debug pages в production artifact или закрыть preview basic auth; проверять output manifest.
- **Приоритет:** low, но перед публичным релизом.

### SEC-008 — LOW — fallback public Supabase anon key в клиенте

- **Категория:** config.
- **Затронуто:** `src/net/hub.ts`, `src/utils/leaderboard.ts`.
- **Описание:** URL и anon-shaped key — публичная client credential; это не service-role key.
- **Влияние:** RLS остаётся реальной границей, но rotation требует нового bundle и старый ключ может жить в кеше.
- **Рекомендация:** убрать fallback после гарантированного build env и проверять RLS в CI/staging.
- **Приоритет:** low.

### SEC-009 — INFO — actor admin может быть подделан legacy-путём

- **Категория:** logs/audit.
- **Затронуто:** `api/admin/_lib.ts`.
- **Описание:** при legacy token `x-admin-actor` приходит от клиента и попадает в audit log.
- **Влияние:** неверная атрибуция действия; не даёт доступа без самого token.
- **Рекомендация:** actor брать только из verified identity; legacy actor игнорировать.
- **Приоритет:** info/в составе SEC-002.

## Проверенные отрицательные результаты

- React escaping используется; `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `Function` не найдены.
- Пользовательских upload/download, path traversal и server-side file writes в приложении не найдено.
- Прямого SQL execution с query/body нет; PostgREST filters кодируются, но domain validation нужна.
- `AppErrorBoundary` существует; QA collector и FPS globals gated by DEV.
- `npm audit --omit=dev` ранее не показывал production dependency vulnerabilities; повторный production deploy audit
  и lockfile scan следует выполнить в CI.
