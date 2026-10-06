# Сервер Barsik

На сервере работает основной Express API с SQLite (`server.js`) и отдельный API аккаунтов (`account-api.cjs`). Оба сервиса используют одну базу. Основной API слушает только `127.0.0.1:3001`; nginx проксирует к нему публичные запросы.

Админ-маршруты закрыты подписанной сессией. Вход: `POST /api/admin/login`; остальные `/api/admin/*` требуют `Authorization: Bearer <session>`. Сессия действует 8 часов, после пяти неверных попыток вход с этого IP блокируется на 15 минут. Серверные значения задаются через `/etc/barsik-admin.env`, а не хранятся в репозитории. Файл должен содержать `ADMIN_USERNAME`, `ADMIN_PASSWORD` (не короче 12 символов) и `ADMIN_SESSION_SECRET` (не короче 32 символов) и иметь права `0600`.

Для подключения файла к systemd установите drop-in `barsik-backend-admin.conf` в `/etc/systemd/system/barsik-backend.service.d/`, затем выполните `systemctl daemon-reload` и перезапустите `barsik-backend`. После перезапуска проверьте, что без сессии `/api/admin/overview` возвращает `401`, а с выданной сессией — `200`.

Новые маршруты аккаунтов проксируются nginx на порт `3002`:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET|PUT /api/progress`

Перед запуском нужно скопировать `account-api.cjs`, `account-api.service` и добавить `nginx-account-locations.conf` перед общим `/api/` location. Секреты хранятся в HttpOnly Secure cookie; пароли в репозитории не сохраняются.
