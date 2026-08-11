# ADR 002 — Level 0 HUD: token re-skin, not a global redraw

**Status:** accepted · 2026-08-11

## Context

The first playable scene is the strongest promise of the game, but its UI
chrome was still from the legacy violet/glass system: purple title and pause
pills, generic collectible counters, OS emoji and a pixel runner above a
soft-3D story world. It contradicted the current cream / pear / cyan / mint
style lock and made the scene look like several unrelated prototypes.

`Mission0Screen.css` is also used by `MissionScreen` for levels 1–16. A broad
selector change would silently repaint unfinished levels without validating
their layouts or screenshots.

## Decision

- Keep Level 0's gameplay structure, controls, scene timing and Three.js
  world unchanged in this pass.
- Add `m0-screen--level0` only to `Mission0Screen`; apply its new tokens,
  surfaces, shadows, focus states and semantic beat icons under that scope.
- Keep the shared loader a blocking, no-fail arrival screen with real asset
  progress. It must block pointer input to the live canvas and may not run a
  second pixel runner/game-over loop while a 3D level is loading.
- Mount the rotate-device hint only after the start gate closes, so its
  one-time timer cannot expire invisibly under the loader.
- Retire emoji in the Level 0 dialogue/rotate affordances in favour of the
  existing inline SVG icon system.

## Consequences

Level 0 now has a clear, tactile paper-and-lantern entry ritual and quieter
HUD while other missions keep their current look until each has its own
approved visual pass. Future shared HUD work must first take the same
portrait/landscape/mobile screenshot matrix; it cannot be smuggled in via
`.m0-*` base selectors.

## Verification boundary

For each Level 0 change, check: fresh ready gate, one intentional start,
phone 390×844, touch target sizes, keyboard focus, reduced motion, RU/KK,
and no console errors. The full playable path remains in
`docs/LEVEL0_PLAYTEST_CONTRACT.md`.
