# Defensive security audit

Дата: 2026-08-29. Scope: auth/authz, web input, API, multiplayer, secrets, dependencies и debug surface. Проверка статическая; атаки не выполнялись, production не затрагивался.

## Summary

- **CRITICAL:** 0 подтверждённых.
- **HIGH:** 2.
- **MEDIUM:** 5.
- **LOW:** 3.
- `npm audit --omit=dev` сообщил 0 известных уязвимостей для 15 production dependencies на момент проверки.
- Upload/file ingestion и SSRF surface в приложении не найдены.

## Findings

| Severity | файл/строка | доказательство | риск | безопасный фикс |
|---|---|---|---|---|
| HIGH | `src/store/useGameStore.ts:97-127`, `src/App.tsx:186-215` | Прогресс, stars и friends хранятся/восстанавливаются из client-controlled `localStorage`; серверной authoritative проверки нет. | Tampering позволяет локально открыть уровни и изменить награды; при появлении backend score возникнет накрутка. | Для конкурентных/ценностных данных перенести authority на сервер: signed save или server-side validation с bounds и пересчётом score. |
| HIGH | `api/admin/_lib.ts:77-97`, `src/admin/api.ts:63-75` | Вся admin authorization — один статический `ADMIN_TOKEN`, передаваемый custom header и хранимый в `sessionStorage`; нет expiry, rotation, user identity или MFA. | Компрометация токена даёт полный доступ к детским сейвам, изменению и удалению данных. XSS/скомпрометированный admin browser может прочитать token. | Заменить shared token на короткоживущую server session/identity-based auth с rotation; actor брать из проверенной identity. |
| MEDIUM | `api/admin/players.ts:38-121`, `api/admin/leaderboard.ts:48-81` | После общей проверки admin token клиент полностью задаёт `player_key` для чтения/изменения. | IDOR внутри admin perimeter: скомпрометированный или ошибочно выданный token позволяет адресовать произвольный save. | Добавить resource-level authorization/tenant scope и проверять допустимый admin role на сервере; audit correlation обязателен. |
| MEDIUM | `supabase/functions/city-say/index.ts:32-49` | Rate limit хранится в памяти warm instance и идентифицирует клиента по присланному `device`; обход через cold starts прямо отмечен в коде. | Flood через новые device ids/инстансы расходует Edge/DB/Realtime ресурсы и загрязняет детский чат. | Durable atomic limiter плюс global quota и alert по объёму/429; не полагаться только на client-provided id. |
| MEDIUM | `supabase/functions/city-say/index.ts:51-55` | `Access-Control-Allow-Origin: *` разрешён для endpoint, который принимает и сохраняет сообщения. | Любой сайт может вызывать endpoint из браузера и использовать его как relay/spam surface. Это не cookie-CSRF при текущем дизайне, но расширяет abuse perimeter. | Если endpoint public, усилить server-side abuse controls и не включать credentials; иначе allow-list origins. |
| MEDIUM | `supabase/city_chat.sql:72-87`, `src/net/hub.ts:177-185` | Realtime policy разрешает anon/authenticated слушать любой topic `room:%`; room access не привязан к user/session. | Посетитель может подписаться на известные/угадываемые комнаты и читать broadcast traffic. | Ввести auth-aware topic policy и room claims либо явно классифицировать чат как public и не передавать персональные данные. |
| MEDIUM | `api/admin/_lib.ts:114-123,168-176` | До 300 символов upstream PostgREST response попадают в exception, затем часть сообщения отправляется клиенту и логируется. | Возможна утечка schema/relation/query details и чувствительных fragments в admin browser/platform logs. | Клиенту отдавать стабильный `error_code` + request ID; upstream body только в redacted structured log. |
| LOW | `.env`, `.env.local` (локальные, не tracked) | `git check-ignore` подтверждает ignore rules; локальные env-файлы содержат secret-like credentials. Значения намеренно не раскрываются; коммитов по этим путям в истории не найдено. | Backup/export/ошибка публикации рабочей директории может раскрыть provider tokens. | Сохранить ignore rules, добавить CI/pre-commit secret scan, не копировать `.env*` в artifacts; ротировать уже раскрытые ключи. |
| LOW | `src/net/hub.ts:23-27`, `src/utils/leaderboard.ts:10-15` | В client bundle есть fallback Supabase URL и JWT-shaped anon key literal. Это anon key, не service-role key, но он публичен. | Привилегий не даёт при корректном RLS, но усложняет rotation и может пережить смену проекта/RLS. | Убрать production fallback, требовать build-time env и проверять RLS в CI/staging. |
| LOW | `src/main.tsx:7`, `src/dev/qaConsole.ts:18-53` | QA collector активируется в production по `?qa=1`, monkey-patches `console.error` и exposes `window.__qaErrors()`. | Диагностические сообщения могут стать доступными локальному скрипту/пользователю; debug surface не ограничен build mode. | Ограничить collector DEV/staging или подписанным QA flag и применять redaction; убрать debug globals из production. |

## Проверенные категории без подтверждённой уязвимости

- **XSS:** React escaping используется; `dangerouslySetInnerHTML` и `innerHTML` не найдены.
- **SQL/NoSQL injection:** прямого SQL execution с пользовательским input не найдено; PostgREST filters URL-encoded/ограничены.
- **SSRF/path traversal:** asset paths строятся из внутренних constants/allow-lists; user-controlled URL/file path surface не найден.
- **CSRF:** admin requests используют custom `x-admin-token`, а не cookie auth; классическая cross-site form CSRF не подтверждена.
- **File upload:** multipart parser, `FileReader`, upload endpoint и server-side file write в application surface не найдены.
- **JWT/cookies:** собственная JWT/cookie session не реализована; Supabase anon JWT используется как public client credential.
- **Dependencies:** `npm audit --omit=dev` вернул 0 vulnerabilities; production dependencies включают React, Three.js, Zustand и Supabase Realtime.

## Дополнительные observations

- `supabase/functions/city-say/index.ts:23-24` читает service-role key только из env; tracked frontend service-role key не найден.
- `api/admin/_lib.ts:90-97` принимает `x-admin-actor` от клиента, поэтому audit actor spoofable при наличии valid admin token.
- `api/admin/_lib.ts:168-176` логирует raw exception; известные token values напрямую не логируются, но redaction отсутствует.
- Client-local saves не являются secure storage и не обеспечивают anti-cheat; это допустимо только для non-competitive offline progression.

## Remediation order

1. HIGH: заменить shared static admin token на короткоживущую identity/session модель.
2. HIGH: определить server authority для progression/score до появления competitive backend flows.
3. MEDIUM: durable rate limiting, room access policy и безопасный error contract с request ID/redaction.
4. LOW: production-disable QA collector, secret scan и убрать hardcoded public fallback.

Это defensive static audit, а не penetration test. Повторный аудит нужен после изменений auth, RLS, Realtime, admin API или deployment secrets.
