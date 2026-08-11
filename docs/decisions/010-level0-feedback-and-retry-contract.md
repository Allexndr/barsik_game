# ADR 010 — Level 0 feedback and retry contract

**Status:** accepted · 2026-08-11
**Scope:** `Level0Scene` only.

## Context

The first beat says to follow the dombra. Its proximity value was calculated
every frame, but the React HUD received it only when an unrelated quest event
happened. A child playing with audio muted therefore saw a frozen “warmer /
colder” percentage.

The three fallen lanterns also called `loadPropModel()` independently. They
are visual copies of the same prop, so this paid for the same download and
Draco decode three times during the opening level.

Finally, the dombra mini-game stated that a mistake replayed the phrase, but
its retry path dealt a new random phrase. That makes the teaching signal move
after the child has made one mistake.

## Decision

- Publish the dombra meter only when the percentage the HUD can actually draw
  changes, and only during the `follow` beat. This restores muted-play
  feedback without making React receive a 60 Hz stream of scene state.
- Load the usable lantern model once, then place deep object clones that share
  its immutable geometry, materials and textures. Each holder keeps its own
  flame, rotation and interaction state.
- Deal a random phrase when a *new* kui round begins. A wrong pad resets the
  answer progress and replays that same phrase; advancing to the next round
  deals the next one.

## Consequences and checks

This preserves the canonical flow, controls and no-fail-state policy. The
meter keeps its visual one-percentage-point granularity; lantern fallbacks
remain per-instance if no GLB is usable. Test with `npm run type-check`,
`npm run lint`, `npm run build`, then a 390×844 and desktop first-play smoke:
move through the follow beat with audio muted, start the yurt QA route, make a
wrong pad choice and confirm the shown sequence repeats unchanged.

**2026-08-11 result:** type-check, lint and production build passed. On the
390×844 route the visible dombra meter changed from `0%` to `2%` while moving
through `follow`, with no console errors. On the desktop yurt QA route, an
intentional wrong pad returned to “Слушай…” while the visible round stayed
`2/3`, rather than advancing or resetting the lesson. Both checks retain the
pre-existing warning that the 20,946-triangle ambient bird is deliberately
skipped by its separate budget gate; it is not produced by this change.
