# BARSIK collaboration contract

This repository is worked on by humans, Codex and Claude Code in parallel.
Treat a clean, understandable history as a product requirement.

## Required BARSIK workflow

For every gameplay, level, character, quest, interaction, camera, collision,
HUD or whole-game improvement task, read and follow
`.agents/skills/barsik-game-director/SKILL.md` before planning or editing. It is
the canonical cross-agent quality and hands-on QA contract.

## Before editing

1. Read `docs/CANON_RECONCILIATION.md`, then the relevant current specification.
   Never revive a behaviour marked legacy just because an older document names it.
2. Work in your own Git worktree and branch. Do not write into another agent’s
   dirty worktree.
3. Claim a narrow scope in `docs/WORKLOG.md`: files, goal and explicit
   out-of-scope areas.

## While editing

- One concern per atomic commit. Do not mix visual polish, gameplay behaviour,
  generated assets and release setup in one commit.
- Record durable decisions in `docs/decisions/NNN-*.md` and player-facing
  changes in `docs/CHANGELOG.md`.
- Do not stage raw source art, generated `.codebase-memory/*`, `dist/`, secrets
  or unrelated unstaged changes.
- New hub UI follows `design.md`; do not introduce violet gradients or
  glassmorphism. In-level HUD needs its own agreed migration task.
- Preserve the canonical L0 story: dombra → lanterns → river → felt → yurt.

## Before handoff

Run the checks relevant to the change:

```bash
npm run type-check
npm run lint
npm run build
git diff --check
```

For an interactive change, also test 390×844 portrait and desktop. The commit
body must state **Why**, **User impact**, **Verification**, and **Coordination**.
Only the release owner merges to the release branch and performs a production
deployment.
