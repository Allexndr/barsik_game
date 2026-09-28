# Сервер Barsik

На сервере уже работает основной Express API с SQLite. `account-api.cjs` использует ту же базу, но отдельный порт: старые leaderboard, чат и админские маршруты остаются совместимыми.

Новые маршруты аккаунтов проксируются nginx на порт `3002`:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET|PUT /api/progress`

Перед запуском нужно скопировать `account-api.cjs`, `account-api.service` и добавить `nginx-account-locations.conf` перед общим `/api/` location. Секреты хранятся в HttpOnly Secure cookie; пароли в репозитории не сохраняются.
