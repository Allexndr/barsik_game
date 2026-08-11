# ADR 007 — Shared Season 1 mission HUD

- **Date:** 2026-08-11
- **Status:** accepted
- **Scope:** `MissionScreen` for Levels 1–16; Level 0 remains a separately
  authored vertical slice.

## Context

Level 0 had received the approved Barsik Hum HUD treatment, while every later
mission still inherited the original `.m0-*` violet/glass defaults. That made
the same game look like two products and encouraged per-level CSS copies.
The scene shell is shared by all of those missions, so a global rewrite would
also risk changing the independently checked Level 0 experience.

## Decision

`MissionScreen` now owns an explicit `m0-screen--season1` class, plus a
level-specific class reserved for future world accents. A scoped CSS layer
uses the locked cream, ink, cyan, pear and mint tokens for the HUD chrome:

- paper status and dialogue cards instead of violet glass;
- cyan pause/navigation controls, pear action/reward controls, mint movement;
- an opaque, tactile story tablet with a cyan goal divider;
- cream keyboard and touch affordances with existing safe-area and 44 px touch
  sizing preserved;
- no renderer, scene geometry, asset or gameplay-flow changes.

Level 0 keeps `m0-screen--level0` and is not restyled as a side effect.

## Consequences

All shared Season 1 missions now have a coherent in-session visual language.
Future world-specific variation must be attached to the level class only after
a screenshot matrix proves that it remains legible over that world's terrain;
it must not reintroduce legacy violet or glassmorphism. This is a HUD pass,
not an environment or hero replacement pass.

## Verification

- `npm run type-check`
- `npm run lint`
- `npm run build` (generated `dist` restored afterwards)
- Level 1 local screenshots at 390×844 and 1440×900
- Level 1 and Level 11 phone smoke: load → play → fold/reopen dialogue →
  pause → resume, with no console errors
