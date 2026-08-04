# Meshy Discover — как реально качать модели

## Короткий ответ

**API-ключ ≠ скачивание Community.**  
`MESHY_API_KEY` умеет только Text/Image-to-3D **ваших** задач.  
Страницы Discover / free-3d-models без логина отдают SPA-оболочку; `.glb` лежит за сессией + signed CDN URL.

Массовый парсинг 580k моделей:
- не даёт бинарники без логина,
- упирается в ToS Meshy,
- бесполезен для Barsik (нужны 20–40 курируемых ассетов, не «всё подряд»).

## Рабочие пути (по приоритету)

### A. Hero Барсик — наш пайплайн (уже в деле)
1. Реф T-pose: `docs/refs/barsik_tpose_v2.png` (голубые глаза, худи, джинсы).
2. Костюмы: `barsik-game/assets/chars/*.png` + T-pose варианты в `docs/refs/`.
3. `python3 tools/meshy_image_to_glb.py <tpose.png> public/assets/models/chars/barsik.glb`
4. Optimize: `npx @gltf-transform/cli optimize … --texture-compress webp --compress draco`

### B. Tripo / Meshy Web Export (если модель уже в UI)
1. Export **GLB** из Tripo Studio / Meshy Workspace.
2. Положи файл сюда: `barsik-game/public/assets/models/chars/barsik.glb`
3. Напиши «готово» — подключим/оптимизируем.

### C. Discover download вручную (логин обязателен)
1. Открой [Discover](https://www.meshy.ai/discover) **в своём Chrome**, где ты уже залогинен (~650 credits).
2. Search: `plush squirrel`, `hedgehog`, `wooden sign`, `treasure chest`, `snowman`, `songbird`, `tree stump`.
3. Карточка → **Download GLB**.
4. Сохрани в `public/assets/models/{chars|props}/<name>.glb`.

### D. Playwright + persistent Chrome (рекомендуется для batch)
**Не кидай пароль Google в чат.** Логин только руками в окне.

```bash
# 1) Откроет Chrome с профилем tmp/meshy-chrome-profile — войди (Google/email)
node tools/meshy_playwright_download.mjs --login --wait-login

# 2) После «готово» / когда в шапке видны credits:
node tools/meshy_playwright_download.mjs --download --searches
```

Wishlist: белка/ёжик/sign/cabin/treehouse/key/chest → `public/assets/models/{chars|props}/*_discover.glb`.
Cursor Browser OAuth часто показывает «Вход успешен», но **сессию не держит** — используй это окно Chrome.

### E. Cookies export (опционально)
```bash
# cookies → barsik-game/tools/meshy_cookies.json
python3 tools/meshy_discover.py catalog --query "plush squirrel" --out tmp/discover_squirrel.json
```

## Wishlist (курат)

| Роль | Search |
|------|--------|
| белка | plush squirrel / chibi squirrel |
| ёжик | plush hedgehog |
| табличка | wooden sign post cartoon |
| сундук | cartoon treasure chest |
| ключ | chibi golden key |
| снеговик | cute snowman |
| пень | talking tree stump |
| птица | cute songbird soft toy |
| домик | whimsical treehouse / rustic cabin |

Скрипт: `tools/meshy_discover.py`  
Старый список UUID: `docs/MESHY_DISCOVER_WISHLIST.md`
