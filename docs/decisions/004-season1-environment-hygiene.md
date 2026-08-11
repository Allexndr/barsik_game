# 004 — Season 1 environment hygiene

**Status:** accepted · 2026-08-11
**Scope:** Mission 1, Level 2, Level 3 and Level 10 only.

## Context

`Mission1Scene` was the remaining real Season 1 route on a flat textured
`PlaneGeometry`. Its bridge, trail, fruit interaction and Aya are authored at
`y=0`, so applying terrain relief across the route would risk changing the
walk, collision and interaction spacing.

`setupForestEnvironment()` already owns one sky dome, cloud field, sculpted
ground, ridge backdrop and deferred instanced wind grass. Levels 2, 3 and 10
created extra sky/cloud fields after calling it; Level 3 also called
`setupFireflies()` after the shared setup had already created them.

## Decision

- Mission 1 now uses `setupForestEnvironment()` with a 30 m flat feature
  centred on its authored route and a 56 m terrain play extent. The flat area
  covers the start, bridge, thicket and Aya beat; the rim starts beyond the
  `z=-46` movement bound. Relief therefore improves the horizon without
  moving scripted objects off their existing zero-height gameplay surface.
- The existing sky palettes and cloud counts are passed through the shared
  setup once. This retains each level's intended mood while removing the
  redundant draw work.
- Level 3 retains exactly one firefly system via `fireflies: true`.

## Test notes

Run `npm run type-check`, `npm run lint`, `npm run build`, and
`git diff --check`. In a local build, smoke-test `?mission=1`, `?mission=2`,
`?mission=3` and `?mission=10`:

1. Mission 1: walk start → bridge → thicket → Aya; the route remains level,
   water/bridge collision remains reachable, and grass stays out of the path.
2. Levels 2/3/10: one stable sky and cloud layer, no console errors.
3. Level 3: fireflies remain visible but are not doubled; switching levels
   does not leave their previous points behind.

**2026-08-11 smoke result:** all four routes mounted a WebGL canvas and
reported no console errors at 390 × 844 after the entry screen was started.
Mission 1 retained a level start/bridge/trail surface while gaining visible
relief at the forest edge and wind grass around the cleared route. Level 10
still starts with a large canopy occluding much of the mobile camera. This
patch did not move its camera, tree placement or collision data, so that
composition issue is recorded for a separate camera/forest-layout pass rather
than being hidden inside sky cleanup.

## Deferred

The old standalone cloud calls used different far distances (60/80 m); the
shared pipeline uses its common 70 m bound. Counts and palette are retained.
Adding per-level cloud-distance plumbing is intentionally deferred until a
visual comparison identifies a real composition problem.
