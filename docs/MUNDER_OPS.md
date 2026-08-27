# Munder Difflin ops — Barsik

Visual multi-agent office around **Claude Code** (Pro/Max via `claude` CLI).
Not part of the game runtime. Complementary to Ruflo ([RUFLO_OPS.md](./RUFLO_OPS.md)).

| Layer | Role |
|-------|------|
| **Munder Difflin** | Electron floor: Michael (GOD) + Claude workers in PTYs, hive memory/mailboxes |
| **Ruflo** | Meta swarm/tasks/MCP memory (`barsik` ns). Does not replace Munder workers |
| **Cursor** | Human + agent coding in IDE |

## Scope (locked)

- Engine: **Claude Code only** (`claude` on PATH)
- Project cwd for workers: `/Users/aleksandr/Project/other/job/barsik-game`
- Hive home: `~/MunderDifflin/barsik-hive`
- Do **not** point the office at the whole `job/` monorepo

## Install (done once)

- App: `/Applications/Munder Difflin.app` (v0.4.6 universal DMG)
- Source reference (shallow): `job/tools/munder-difflin/`
- Releases: https://github.com/chaitanyagiri/munder-difflin/releases

## Launch

```bash
/Users/aleksandr/Project/other/job/tools/munder-barsik.sh
```

The script:

1. `unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_MODEL`
2. Puts `~/.local/bin` on `PATH` (Claude Code)
3. Opens Munder Difflin

### Auth trap (same as Ruflo)

If `~/.zshrc` exports `ANTHROPIC_BASE_URL=http://localhost:20128` and that proxy is down,
`claude` fails with Connection refused and **ignores** the claude.ai subscription.
Always launch via `munder-barsik.sh`, or unset those vars in the shell before `open`.

Smoke:

```bash
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_MODEL
claude -p "ping"
```

## First-run onboarding (UI)

Config seed (if no prior config) lives at:

`~/Library/Application Support/munder-difflin/config.json`

Suggested values (already seeded when missing):

| Setting | Value |
|---------|--------|
| GOD provider | `claude` |
| defaultCommand | `claude` |
| harnessHome / hive | `~/MunderDifflin/barsik-hive` |
| registeredRepos | `…/job/barsik-game` |
| maxConcurrentWorkers | `2` |
| orchestratorMaySpawn | `false` (human gates spend) |

In the wizard / Add agent:

1. Finish onboarding as **technical** audience.
2. Confirm hive = `~/MunderDifflin/barsik-hive`.
3. Register / pick project = `barsik-game` only.
4. Spawn **Michael** (GOD) — orchestrates, does not implement.
5. Spawn **1–2 Claude workers** with cwd = `barsik-game` (not hive root).

Human gates: spend, destructive ops, scope changes → escalate to you (harness default).

## How to assign work

Talk to **Michael** (GOD):

- Decompose a Barsik task (e.g. from Ruflo memory `project/barsik/improve-backlog`).
- He routes to a worker inbox; worker edits under `barsik-game/`.
- You approve tool prompts / critical escalations.

Starter smoke (after onboarding): see `~/MunderDifflin/barsik-hive/FIRST_TASK.md`
(read-only summary of `worldScale.ts` — no edits unless asked).

Do not ask Michael to implement large diffs himself — that is worker work.

## Stop

Quit the app from the dock/menu, or:

```bash
osascript -e 'quit app "Munder Difflin"'
```

## Update

In-app update badge, or reinstall DMG from GitHub releases.

## Related

- Hive design: `job/tools/munder-difflin/HIVE.md`
- Ruflo: [RUFLO_OPS.md](./RUFLO_OPS.md)
- Workspace memory: `job/docs/PROJECT_MEMORY.md`
