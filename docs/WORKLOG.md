# BARSIK work log

This is the durable, repository-local record for Codex + Claude Code work.
`PROJECT_MEMORY.md` can remain a broader workspace archive, but a clone, pull
request or release must still explain why its code changed.

## Working agreement

1. One agent owns one narrow file scope in one worktree/branch.
2. Every functional change has an atomic commit with **Why**, **User impact**,
   **Verification** and **Coordination** in its body.
3. Long-lived choices go in `docs/decisions/NNN-*.md`; release-facing summaries
   go in `docs/CHANGELOG.md`.
4. Never stage generated `.codebase-memory/*`, raw source assets, credentials,
   or another agent’s unstaged files in a feature commit.
5. Release owner alone integrates, pushes to the protected release branch and
   deploys production. Other branches receive preview deployments only.

## 2026-08-13 — BARSIK game-director contract and Level 0 control recovery

- **Branch:** `codex/s1-premium-integration`
- **Scope:** repository skill/routing; Level 0 camera-relative controls, yurt
  entry/collision truth and procedural hero quality in separate atomic patches.
- **Agent compatibility:** legacy Claude gameplay/level/narrative prompts now
  route to the same Game Director contract; their conflicting generated-level
  targets are retired rather than left as a second source of truth.
- **Why:** visual smoke checks missed a player-blocking mismatch between camera,
  movement and the authored route, plus unreadable yurt boundaries/entry.
- **Out of scope:** changing L0's canonical story order; importing an unrigged
  generated hero; unrelated level-budget and hub-nav work.
- **Required verification:** complete L0 through normal input on desktop and
  390x844 mobile; 360-degree orbit; forward movement at reversed heading;
  collider/river/door tests; type-check, lint and build; production only after
  the integrated route passes.

## 2026-08-11 — Hub navigation foundation

- **Branch:** `codex/ui-navigation-foundation`
- **Scope:** `design.md`, `ART_DIRECTION.md`, hub navigation, hub surface CSS,
  translations and repository-local history.
- **Why:** a child saw six equal mobile destinations with too-small labels;
  violet/glass rules conflicted with the locked design system.
- **Decision:** ADR 001 introduces one UI source of truth and a four-item
  mobile thumb bar with secondary systems under More.
- **Out of scope:** Three.js scenes, Level 0 gameplay/HUD, QR/leaderboard
  backends, player-data collection and production release integration.
- **Verification:** `npm run type-check` ✅; `npm run lint` ✅; `npm run build` ✅;
  manual 390×844 touch flow (More open, choose secondary destination, Escape
  close) ✅; 1440×900 desktop smoke check ✅; console warnings/errors ✅ none.
- **Release note:** Vite currently rewrites tracked `dist/` files during a
  build. Generated output was deliberately not staged; production delivery
  should build from committed source, and tracking `dist/` needs a separate
  release-infrastructure decision.
