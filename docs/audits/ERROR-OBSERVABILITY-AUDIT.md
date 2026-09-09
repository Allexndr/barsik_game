# Error & observability audit

Дата: 2026-08-29. Read-only аудит. Внешние сервисы и код не менялись.

## Findings

### 1. Ошибка `scene.init()` превращается в unhandled rejection

- **Проблема:** асинхронная инициализация сцены запускается без обработки rejection.
- **Сценарий:** GLB, WebGL setup или загрузка уровня завершается ошибкой после открытия миссии.
- **Как воспроизвести:** открыть `/?mission=0`, заблокировать/подменить запрос одного из GLB или вызвать reject из `createScene(...).init()` в DevTools.
- **Что увидит пользователь:** loading overlay может остаться навсегда; понятного сообщения или retry нет.
- **Что увидит команда:** `unhandledrejection` только в DevTools/QA collector при `?qa=1`; production telemetry отсутствует.
- **Рекомендуемый лог/метрика/алерт:** структурированный `scene_init_failed` с `level_id`, `asset_phase`, `error_class`, `request_id`; метрика rate и alert при росте ошибок.
- **Приоритет:** P1.
- **Доказательство:** `src/components/MissionScreen.tsx:124-133` и аналогичный `src/components/screens/HubScreen.tsx:81-95` используют `void scene.init(...).then(...)` без `.catch()`.

### 2. Нет глобального Error Boundary для React

- **Проблема:** render/lifecycle exception может обрушить React subtree без штатного fallback UI.
- **Сценарий:** ошибка в screen/component при рендере, в том числе из-за неожиданного сохранённого состояния или lazy chunk.
- **Как воспроизвести:** в DevTools временно бросить исключение в компоненте текущего экрана или повредить код lazy chunk на preview deployment.
- **Что увидит пользователь:** пустой/сломанный экран React вместо экрана восстановления.
- **Что увидит команда:** browser `error` event может попасть в QA collector только при `?qa=1`; production событие не доставляется.
- **Рекомендуемый лог/метрика/алерт:** `react_render_error` с component boundary, route/screen, build id и stack; alert по доле сессий; локальный fallback с кнопкой перезагрузки.
- **Приоритет:** P1.
- **Доказательство:** `src/main.tsx` монтирует приложение напрямую; в `src/` нет Error Boundary, а `src/dev/qaConsole.ts` включается только query-параметром `qa=1`.

### 3. Ошибки загрузки ассетов только пишутся в console.warn

- **Проблема:** missing/failed asset не становится измеримым production событием.
- **Сценарий:** GLB или texture отсутствует, истёк timeout или CDN отвечает ошибкой.
- **Как воспроизвести:** переименовать runtime GLB в preview build либо вернуть `404` через DevTools Local Overrides.
- **Что увидит пользователь:** fallback-модель/упрощённый объект или неполная сцена; иногда это выглядит как контентная ошибка без объяснения.
- **Что увидит команда:** `[load] failed: <url>` только в browser console; сервер и команда не получают счётчик.
- **Рекомендуемый лог/метрика/алерт:** `asset_load_failed` с type, logical asset id, HTTP status, duration, level; alert по missing critical assets. Не логировать query tokens или полный пользовательский URL.
- **Приоритет:** P1 для critical assets, P2 для optional.
- **Доказательство:** `src/three/loadProgress.ts:99-103` вызывает только `console.warn`; `src/three/AssetKit.ts:80-93` ловит ошибку и возвращает `null` без причины.

### 4. Ошибки загрузки player/progress стирают локальные данные без пользовательского сообщения

- **Проблема:** invalid JSON/migration error приводит к удалению сохранения, а причина не показывается пользователю.
- **Сценарий:** повреждён `localStorage`, несовместимая версия save или миграция выбрасывает исключение.
- **Как воспроизвести:** изменить `barsik_player` или `barsik_progress` в Application → Local Storage на некорректный JSON/объект и перезагрузить приложение.
- **Что увидит пользователь:** потеря состояния/возврат к welcome screen без объяснения и recovery path.
- **Что увидит команда:** `console.error('Failed to load player/progress')` только локально; request/session/build context отсутствует.
- **Рекомендуемый лог/метрика/алерт:** `save_migration_failed` с schema version, storage key, error class и anonymized device/session id; UI-сообщение о повреждённом локальном save перед очисткой; не отправлять содержимое save.
- **Приоритет:** P1.
- **Доказательство:** `src/App.tsx:168-183` и `:186-215`; `removeItem()` выполняется сразу после catch.

### 5. Ошибки базы и внешнего API в `city-say` не наблюдаемы

- **Проблема:** Supabase insert error возвращает общий ответ, но не записывает исходную ошибку в server log/metric.
- **Сценарий:** таблица `city_messages` отсутствует, RLS запрещает insert, Supabase недоступен или истёк service key.
- **Как воспроизвести:** удалить/переименовать таблицу в staging либо подставить недействительный `SUPABASE_SERVICE_ROLE_KEY`, затем отправить POST в `city-say`.
- **Что увидит пользователь:** `{ error: 'store' }` с HTTP 500; в UI возможны generic failure/no confirmation.
- **Что увидит команда:** для `insertError` нет `console.error`, correlation ID и счётчика; останется только инфраструктурный 500 без безопасного контекста.
- **Рекомендуемый лог/метрика/алерт:** `city_say_store_failed` с request_id, room, operation, Supabase error code, duration; метрика 5xx/latency и alert. Не логировать `text`, `device`, service key или Authorization.
- **Приоритет:** P1.
- **Доказательство:** `supabase/functions/city-say/index.ts:108-113` проверяет `insertError`, но только возвращает `store`.

### 6. Ошибка записи rejection в базу не обработана отдельно

- **Проблема:** logging path для заблокированного сообщения сам может выбросить исключение.
- **Сценарий:** `city_rejects` не создана или недоступна в момент сообщения, которое moderation отклоняет.
- **Как воспроизвести:** отправить запрещённую/слишком длинную строку при недоступной таблице `city_rejects`.
- **Что увидит пользователь:** вместо штатного `{ error: 'blocked' }` может прийти необработанный 500; причина блокировки теряется.
- **Что увидит команда:** нет контролируемого события с причиной БД; runtime может записать только общий platform error.
- **Рекомендуемый лог/метрика/алерт:** отдельный `city_reject_audit_failed` с request_id и DB code; основной moderation response не должен зависеть от audit insert; alert, если audit failure > 0.
- **Приоритет:** P1.
- **Доказательство:** `supabase/functions/city-say/index.ts:93-100` делает `await admin.from('city_rejects').insert(...)` без проверки `.error` и без `try/catch`.

### 7. Realtime errors видны только в console.warn

- **Проблема:** disconnect/channel timeout не имеет production telemetry и пользователь получает только смену статуса.
- **Сценарий:** Supabase Realtime недоступен, канал timeout или broadcast send отклонён.
- **Как воспроизвести:** включить `VITE_HUB_REALTIME=1`, заблокировать `/realtime/v1` в DevTools и открыть hub.
- **Что увидит пользователь:** hub переключится в offline/не покажет соседей; причины и retry strategy неочевидны.
- **Что увидит команда:** `[hub] офлайн: ...` только в console; `channel.send()` promise не проверяется.
- **Рекомендуемый лог/метрика/алерт:** `realtime_connection_state` и `realtime_send_failed` с location, state, error code, duration; rate alert; sampling для повторных reconnects.
- **Приоритет:** P2.
- **Доказательство:** `src/net/hub.ts:170-176`, `:258-280` обрабатывают channel state локально; `:266-270` и `:302-305` используют `void ...send(...)` без rejection handler.

### 8. API errors раскрывают внутреннее сообщение наружу

- **Проблема:** общий admin handler отправляет клиенту первые 200 символов exception message.
- **Сценарий:** PostgREST/DB возвращает schema, relation, SQL или инфраструктурную деталь при ошибке admin endpoint.
- **Как воспроизвести:** вызвать admin endpoint при неверной таблице/колонке или недоступном Supabase.
- **Что увидит пользователь:** техническое сообщение вместо стабильного кода ошибки.
- **Что увидит команда:** исходное исключение логируется через `console.error`, но без request ID/actor-safe context.
- **Рекомендуемый лог/метрика/алерт:** клиенту отдавать стабильный `error_code` и request_id; полный upstream detail — только в server log с redaction; метрики по endpoint/status/error_code.
- **Приоритет:** P1.
- **Доказательство:** `api/admin/_lib.ts:121` создаёт exception с текстом upstream response; `:168-171` возвращает `(e as Error).message.slice(0, 200)`.

### 9. Server logs не имеют correlation/request IDs

- **Проблема:** один пользовательский сбой нельзя надёжно связать между browser, Vercel function, Supabase function и DB call.
- **Сценарий:** admin 500, `city-say` 500 или asset/network failure требует расследования по времени и нескольким компонентам.
- **Как воспроизвести:** повторить любой failure и попытаться найти его одновременно в browser console, function logs и Supabase logs.
- **Что увидит пользователь:** отсутствие reference ID для обращения в поддержку.
- **Что увидит команда:** сообщения `[admin]`, `[hub]`, `[load]` и `city-say` не содержат общего идентификатора запроса; поиск требует ручного сопоставления timestamp.
- **Рекомендуемый лог/метрика/алерт:** принимать/создавать `request_id` на edge, прокидывать его через API и function calls, возвращать его в response header/body; логировать JSON-поля `request_id`, service, route, operation, status, duration.
- **Приоритет:** P1.

### 10. QA console collector не является production observability

- **Проблема:** сбор uncaught errors ограничен ручным QA режимом и хранит сообщения только в памяти вкладки.
- **Сценарий:** production пользователь получает runtime exception или unhandled rejection.
- **Как воспроизвести:** открыть production без `?qa=1`, вызвать rejected promise и проверить отсутствие канала доставки/накопления ошибки.
- **Что увидит пользователь:** стандартный сломанный UI браузера без recovery.
- **Что увидит команда:** ничего; `window.__qaErrors()` существует только при `?qa=1` и не отправляет данные наружу.
- **Рекомендуемый лог/метрика/алерт:** оставить QA collector для тестов, но добавить собственный минимальный same-stack error endpoint/structured server log без внешнего сервиса; sampling и redaction обязательны.
- **Приоритет:** P1.
- **Доказательство:** `src/dev/qaConsole.ts:18-22`, `:40-53`; production transport отсутствует.

### 11. Риск попадания секретов и чувствительных данных в диагностические сообщения

- **Проблема:** явной печати service key/admin token не найдено, но несколько общих логов и raw exception paths недостаточно защищены от будущих секретов.
- **Сценарий:** upstream exception или добавленный debug log содержит URL/header/body; `console.error`/platform log сохраняет это целиком.
- **Как воспроизвести:** вызвать ошибку admin DB request и проверить function log; отдельно включить `?qa=1` и вызвать ошибку с чувствительным значением в thrown message.
- **Что увидит пользователь:** обычно ничего; в QA возможно отображение полного сообщения через `window.__qaErrors()`.
- **Что увидит команда:** `api/admin/_lib.ts:170` логирует объект exception целиком; `src/dev/qaConsole.ts:34-37` захватывает все аргументы `console.error`; `api/admin/_lib.ts:121` сохраняет до 300 символов upstream response в exception.
- **Рекомендуемый лог/метрика/алерт:** централизованный redaction для `Authorization`, `apikey`, `x-admin-token`, cookies, player payload и message text; allow-list полей вместо сериализации exception; secret-pattern scan в CI.
- **Приоритет:** P1.

## Покрытие проверки

- **Необработанные исключения:** найдены async scene init, Realtime send promises и отсутствие React boundary.
- **Ошибки API/БД/внешних API:** найдены generic responses, отсутствие logging в `city-say`, последовательные admin paths.
- **Пользовательские сообщения:** часть UI показывает generic/admin errors; gameplay failures не имеют recovery UI.
- **Server logs:** есть точечные `console.*`, но нет структурированного формата, уровней, request IDs и delivery/retention policy.
- **Секреты:** прямого лога известных ключей не найдено; raw exception/console capture остаются риском.

## Приоритет первых исправлений

1. Перехватывать ошибки `scene.init`, `city-say` DB operations и admin exceptions; выдавать стабильный `error_code` + request ID.
2. Добавить Error Boundary и пользовательский retry/reload fallback.
3. Ввести redaction и correlation IDs до расширения логирования.
4. Добавить метрики/алерты для asset failures, API 5xx, Realtime disconnects и migration failures.
