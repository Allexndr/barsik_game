# ADR 011 — winter biome boundary and camera safety

**Status:** accepted
**Date:** 2026-08-11
**Scope:** Levels 11–16 and the shared level enclosure helpers.

## Context

Ice Valley already configured snow lighting, terrain, snowfall and holiday
decor.  After that setup, however, every route, arena and level enclosure
still hard-coded the green `nature` tree kit.  The result was visually
contradictory (a snow field wrapped in a green forest) and worse on a phone:
the rear path cap could occupy the first follow-camera frame in Levels 13–15.

The winter audit captured a mostly green Level 14 start and a blocked Level 15
start at 390×844.  It also found that Level 13 and Level 15 were already near
or above the normal-phone renderer triangle guard before any premium material
work, so replacing forest rows with heavier snow trees was not safe.

## Decision

1. Treat the instanced enclosure as a **biome choice**. `BaseLevelScene`
   selects a treeline profile during shared environment setup rather than
   hard-coding `nature` in `enclosePath`, `encloseArena` and
   `encloseWithForest`.
2. Forest setup explicitly restores the Forest profile. Winter setup selects
   the `holiday` profile before its levels create an enclosure.
3. The winter boundary uses only existing `holiday/tree-snow-c`, the lightest
   snow-laden tree (234 triangles, one material), and at most two instanced
   rows. The already-authored nearby `tree-snow-a/b/c` decor retains the
   varied focal silhouette.
4. Level 13 deliberately uses one boundary row and 34 remote decor samples:
   its sculpture garden already supplies visual depth, and this keeps its
   normal-phone renderer total under the 180k triangle guard without reducing
   the readable route or objective.
5. Levels 13, 14 and 15 define visual-only rear camera bays at their spawn
   lens volumes. They exclude boundary placement only; play paths, movement
   clamps, rooms, colliders and mission beats stay unchanged.

## Consequences

- Winter scenes no longer inherit a green forest wall; their horizon reads as
  one snow biome on both portrait and desktop screens.
- The first mobile camera frame stays open for the hero, route and objective
  in the three affected path levels.
- The boundary remains instanced. This is a substitution and density cap, not
  a per-tree draw-call expansion.
- Local 390×844 medium renderer samples after the change measured Level 13 at
  179,226 triangles and Level 15 at 169,868. These are whole-renderer QA
  counts, not a claim about physical-device FPS; the dev headless frame rate
  is not a release metric.
- Snow/ice ground material and the uninstanced focal holiday-decor scatter
  remain separate Winter Kit packages. They must reduce or hold the current
  renderer counts before adding richer detail.

## Verification

- `npm run type-check`
- `npm run lint`
- `git diff --check`
- Fresh local 390×844 screenshots: L11, L12, L13, L14, L15 and L16; fresh
  1440×900 screenshots: L13, L14 and L15. The checked live frames showed no
  console errors and no tree cap in the affected camera lens.
- Local `?perf=1` samples at 390×844 medium for the two high-risk levels.

## Follow-up

The next Winter Kit package should add a distinct packed-snow/ice surface and
refactor focal holiday decor to an instanced/ownership-safe scatter. Do not
fold HUD restyling or a hero asset replacement into that work.
