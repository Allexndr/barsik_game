# Cleanup audit — 2026-08-24

Практика: Книга 2, Глава 12.8 (гигиена) + 8.5 (не удалять «мёртвое» без поиска ссылок).

## Сделано в этом проходе

| Что | Действие | Зачем |
|-----|----------|--------|
| `product-state.md` | создан | внешняя память сессий |
| `docs/playbook-overlay.md` | создан | дельта playbook |
| `docs/code-map.md` | создан | карта зоны |
| `.cursor/rules/ai-team.mdc` | создан (workspace) | короткий каркас гейтов |
| Дубли `book-*` в barsik-game | symlink → `../book-*` | один источник, нет drift |
| Stale git worktrees (codex + .claude) | `git worktree remove` | ~3 GB, superseded merge |
| `dist/` | в `.gitignore` + untrack | артефакт сборки, не источник |
| `tmp/fail_*.png` и прочий мусор screenshots | удалены | шум; profile Meshy оставлен |
| `barsik-viber3d-test`, `barsik-unused-models` (workspace) | удалены | вне продукта, не используются |
| `AGENTS.md` | переписан под barsik+книги | был шаблон Claude Flow |

## Осознанно оставлено (нужен confirm владельца)

| Что | Почему не сносим сразу |
|-----|------------------------|
| `CityScreen` / `CityScene` | 0 импортов с маршрута; shop/cityObjects логика может вернуться |
| `js/*` + `css/style.css` | vanilla legacy; `vercel.json` ещё редиректит `/js/` |
| `public/voxel-prototype/` | малый; исторический spike |
| `tmp/meshy-chrome-profile` | логин Meshy Discover (~0.9 GB) — не трогать без нужды |
| Старые `codex/*` remote branches | ветки на origin; локальные worktrees сняты |

## Кандидаты следующего прохода

1. Удалить или перенести `js/`+`css/` в `legacy/` + убрать rewrite в `vercel.json`.
2. Удалить `CityScreen` после подтверждения, что Hub покрывает cityObjects.
3. Remote: `git push origin --delete` на superseded `codex/*` (confirm).
4. Docs hygiene: сжать/архивировать дублирующие S1 notes когда board Done стабилен.
