# Barsik S1 — отдел + массовые задачи (coop)

## Массово назначить спринт (главное)

```bash
cd /Users/aleksandr/Project/other/job/barsik-game
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_MODEL ANTHROPIC_API_KEY

# перезапуск всех + общая цель
./scripts/kick-barsik-dept.sh --restart "Добить premium-bar L2/L14 и QA L0/L1 к вечеру"

# или только kick с новой целью (добавит ещё сессии — лучше --restart)
./scripts/kick-barsik-dept.sh "Следующий час: только blockers с доски"
```

Кооп идёт через **`docs/S1_BOARD.md`**: claim → in progress → done → сразу следующая Todo.  
Без kick после Done агенты **становятся idle** — это нормально для Claude `--bg`; цикл = повторный `kick`.

## Как они «кооперируют»

| Механика | Где |
|----------|-----|
| Общая цель | аргумент `kick-barsik-dept.sh "..."` |
| Кто что берёт | `docs/S1_BOARD.md` (Todo / In progress / Done / Handoffs) |
| Зоны без драки | роли не пересекают файлы |
| Передача | строки `@from → @to` в Handoffs |
| Lead | переставляет приоритеты на доске |

Настоящего shared-memory realtime нет: доска = «канал». Ruflo `hive-mind broadcast` — опционально сверху, но отдел сейчас на Claude `--bg`.

## Смотреть кто чем занят

```bash
claude agents
claude logs <id>
claude attach <id>
# доска:
open docs/S1_BOARD.md
```

## Первый спавн (если никого нет)

```bash
./scripts/spawn-barsik-dept.sh
```

Потом всегда лучше **`kick ... --restart`**, чтобы не плодить дубликаты.

## Pixel Agents

`--bg` часто **не виден** в офисе (worktrees). Для пикселей: **+ Agent** × N и тот же текст из kick / board.  
Settings → **Watch All Sessions**.

## Роли

| Имя | Зона |
|-----|------|
| barsik-lead | docs / board |
| barsik-levels-forest | L1–L9 |
| barsik-levels-ice | L10–L16 |
| barsik-hub-ui | `src/components` |
| barsik-qa | QA docs + soft-locks |
| barsik-perf | FPS |
| barsik-audio-i18n | RU/KK + SFX |
| barsik-review | review notes |
