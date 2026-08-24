# Playbook overlay — barsik-game

> Книга 2, Глава 18 / Приложение C. Дельта проекта поверх книг.
> Overlay **добавляет** правила, не вычёркивает ACL/секреты/confirm на прод.

## Продукт

- Детская web-игра, soft-fail only («Нет проигрыша» в CLAUDE.md).
- Style Lock: plush + Barsik Hum — не дефолтный purple/Inter AI look.
- Канон сезона: `docs/SEASON_1_FULL_SPEC.md`; журнал фактов: `../../docs/PROJECT_MEMORY.md`.

## Stage сейчас

`implementation` → к `quality_security` для «S1 идеал». Не начинать Season 2 architecture без cut S1.

## Корзины команд (уточнение)

| Корзина | Примеры |
|---------|---------|
| auto | `tsc`, lint, `npm run voice:check`, чтение git, локальный `npm run dev` |
| confirm | `vercel deploy --prod`, push remote, удаление worktrees с `--force`, Meshy spend |
| forbid | секреты в git/чат, `--no-verify`, force push main, hard reset без явной просьбы |

## Зоны кода (один писатель на инвариант)

См. `docs/S1_BOARD.md` Roles. Хаб 3D (`src/three/scenes/hub/**`) — зона hub-ui + lead, не «никто».

## Не грузить в контекст по умолчанию

- Полные `book-1-guidebook/*` тела (только toc + нужная глава).
- `dist/`, `node_modules/`, `tmp/`, чужие git worktrees.
- Весь `S1_COMPLETION_PLAN.md` — только §0 DoD + открытые чекбоксы зоны задачи.

## Гигиена (Книга 2, 12.8)

После merge в `main` — снимать stale worktrees. Дубли книг — один источник (symlink). Устаревший stage в чате не важнее `product-state.md`.
