# Ruflo ops — Barsik

Meta-harness вокруг Claude Code / Cursor MCP. Не часть игрового рантайма.

## Уже подключено

| Слой | Где |
|------|-----|
| V3 runtime | `.claude-flow/config.yaml` |
| Claude Code MCP | `.mcp.json` → `ruflo mcp start` |
| Cursor MCP | `~/.cursor/mcp.json` → server `claude-flow` |
| Memory | `.swarm/memory.db` (namespace `barsik`) |
| Daemon | `npx ruflo daemon` (workers: audit/optimize/testgaps…) |
| Autopilot | enabled, max 50 iter / 180 min |

## Ловушка auth (Connection refused)

В `~/.zshrc` стоят `ANTHROPIC_BASE_URL=http://localhost:20128` + `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_MODEL=auto/best-free`. Если прокси на `:20128` не запущен, Claude Code падает с `Connection refused` и **игнорирует Google/claude.ai login**.

Для Ruflo/Claude через подписку:
```bash
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_MODEL
```
Или закомментируй эти export в `~/.zshrc`, если локальный роутер не нужен.

## Как гонять доработку

Ruflo **сам не пишет код без сессии модели**. CLI держит swarm/tasks; исполнение — Claude Code:

```bash
cd /Users/aleksandr/Project/other/job/barsik-game
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_MODEL

# статус
npx ruflo@latest doctor
npx ruflo@latest daemon status
npx ruflo@latest task list
npx ruflo@latest autopilot status

# обычный путь: открыть Claude Code в этой папке
claude

# hive headless
npx ruflo@latest hive-mind init -t hierarchical-mesh
env -u ANTHROPIC_BASE_URL -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_API_KEY -u ANTHROPIC_MODEL \
  npx ruflo@latest hive-mind spawn --claude --non-interactive -n 3 \
  -o "Continue Barsik S1 polish from memory namespace barsik"
```

После добавления MCP в Cursor: **Reload Window**, чтобы появился `claude-flow`.

## Засеянный backlog (memory)

- `project/barsik/canon`
- `project/barsik/improve-backlog` — premium-bar, VO/models, LB write, e2e, duration
- `project/barsik/constraints`

## Stop

```bash
npx ruflo@latest autopilot disable
npx ruflo@latest swarm stop
npx ruflo@latest daemon stop
```
