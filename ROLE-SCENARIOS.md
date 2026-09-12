# Role Scenarios

**Дата:** 12.09.2026 · роли определены по фактическому коду, а не по старому README.

## Guest / ребёнок без аккаунта

- **Доступ:** `/`, QuickStart, локальная карта и уровни после создания локального игрока; публичное чтение
  leaderboard через anon key.
- **Сценарий:** открыть landing → начать → выбрать язык/ник → пройти L0–L16 → получить stars/friends →
  перейти на карту, в город, магазин, рейтинг и QR demo.
- **Ожидание:** игра работает local-first, ошибки не ломают прогресс, повтор не дублирует награды.
- **Edge cases:** битый localStorage, private mode, выключенный звук, потеря сети, быстрая повторная кнопка,
  reload во время уровня.
- **Проблемы:** локальный прогресс подделываем; cloud sync зависит от env/RPC; нет пользовательского аккаунта
  и восстановления между устройствами.

## Player / локальный игрок

- **Доступ:** те же SPA screens, meta tabs, optional soft gate phone/email после времени/уровней.
- **Сценарии:** смена языка/голоса/звука; pause/restart; выбор уровня по unlock; replay; покупка локальной
  одежды за stars; просмотр друзей и hub.
- **Ожидание:** данные сохраняются в `barsik_player`/`barsik_progress`; server RPC при доступности возвращает
  canonical progress.
- **Edge cases:** повторный completion, устаревший/битый save, RPC 401 и refresh token, 5xx leaderboard,
  отсутствие Supabase.
- **Проблемы:** localStorage не secure storage; server canonical state не синхронизирует UI при всех offline случаях.

## Moderator

- **Статус:** отдельная роль не реализована. Есть admin-панель и admin API; moderation детского свободного текста
  реализована как функция `checkText`, но не как human moderation workflow.
- **Риск:** нельзя выдать минимальную роль только для скрытия рейтинга — admin perimeter шире.
- **Решение:** ввести отдельные `moderator` claims и endpoint scope, если realtime/chat будет включён.

## Admin

- **Доступ:** `/admin` или `/?admin=1`, затем Supabase access token с admin claim/email allow-list; legacy token
  только при явном env flag.
- **Сценарии:** overview → поиск игрока → просмотр → PATCH восстановления → hide/unhide leaderboard → audit →
  DELETE как последнее средство.
- **Ожидание:** сервер проверяет identity, не доверяет UI; service role остаётся только в API env; ответы без stack trace.
- **Edge cases:** отсутствуют env, истёкший token, 401/403, отсутствуют admin tables, повторный PATCH/DELETE,
  malformed patch и upstream 5xx.
- **Проблемы:** legacy token не имеет expiry; PATCH недостаточно валидирует значения; actor legacy spoofable;
  local `vite dev` не исполняет API.

## System / Supabase

- **Сценарии:** anonymous signup → completion RPC → server lock/update progress; leaderboard read; optional
  Realtime presence/broadcast; `city-say` moderation/rate/store/broadcast.
- **Ожидание:** RLS запрещает клиентскую запись напрямую; RPC проверяет level/reward bounds и порядок.
- **Edge cases:** RLS не применена, RPC недоступна, refresh token протух, rate RPC error, city tables missing,
  Realtime timeout.
- **Проблемы:** cloud merge policy и production-like RLS evidence не закрыты; client hub и `city-say` расходятся.

## Bot / QA runner

- **Статус:** не продуктовая роль. Playwright/dev hooks доступны только в DEV и используются для repeatable smoke.
- **Сценарии:** direct mission launcher, `__level`, `__qaErrors`, `__fpsSamples`, keyboard/touch-style input,
  pause/restart, all-level intro boot.
- **Ограничения:** бот не доказывает человеческое решение загадок L6, кодового замка L9 и извилистой навигации L10;
  headless FPS не доказывает FPS на телефоне.
