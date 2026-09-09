# Meshy Discover wishlist (Barsik)

Скачивание community GLB: Playwright + логин в `tmp/meshy-chrome-profile`.

```bash
node tools/meshy_playwright_download.mjs --login --wait-login
node tools/meshy_playwright_download.mjs --download
```

Discover **search** без явных URL отдаёт популярный мусор (доспехи) — только curated URL.

## Скачано (2026-08-03) → `public/assets/models/`

| Роль | Файл | Opt size | Wired |
|------|------|----------|-------|
| Белка (alt) | `chars/squirrel_discover.glb` | ~311 KB | backup (cast = `squirrel.glb`) |
| Табличка cartoon | `props/wood_sign_cartoon.glb` | ~278 KB | `placeWoodSign` 1st |
| Табличка stand | `props/wood_sign_discover.glb` | ~736 KB | fallback |
| Cabin | `props/cabin.glb` | ~1.4 MB | cast map |
| Treehouse | `props/treehouse.glb` | ~796 KB | L5 landmark |
| Ключ | `props/golden_key.glb` | ~352 KB | L5/L9/L16 |
| Сундук | `props/treasure_chest.glb` | ~886 KB | L9/L16 |

## Не скачалось

| Роль | Причина |
|------|---------|
| Holiday Hedgehog | Rigged/animated download hang (189k faces). Остаётся `hedgehog.glb`. |

## Кандидаты на будущее (ручной URL)

Полный URL: `https://www.meshy.ai/3d-models/<slug>-<uuid>`

- Белка: `disney-Adventure-01940bdb-04be-79d4-970a-2b7d140c8edd`
- Ёжик: Holiday Hedgehog `0193b060-8152-7eba-b2e8-ba2d6426543e` (rigged)
- Таблички / cabin / treehouse / key / chest — уже в репо

## Уже свои (не Discover)

`chars/barsik.glb`, `putalo.glb`, `aya.glb`, `squirrel.glb`, `hedgehog.glb`, … — Image/Text-to-3D из наших рефов.
