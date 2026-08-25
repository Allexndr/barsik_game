# ADR 052 — Level 0 airborne water recovery

**Status:** accepted · 2026-08-25
**Scope:** Level 0 river crossing, `Level0Scene.loop()` water recovery and the
mobile jump contract. No other level's water or movement rules are changed.

## Analysis

The continuous new-save smoke run exposed a real ordering edge case. Level 0's
frame loop updates horizontal movement, checks the river, and only then runs
the shared ballistic jump update. A jump requested at the visible bank edge
could therefore move Barsik into the trench while his feet were still at the
take-off height. The river saw an airborne request as a grounded miss and
returned him to the near-bank checkpoint before the first jump frame was
applied. From a child's perspective the jump button appeared broken.

## Plan

1. Keep the existing visible water boundary, stone radii, and no-fail recovery.
2. Exclude an actually airborne hero from the grounded wet test for the
   current frame so the jump arc can lift and attempt a landing.
3. Preserve the normal miss behavior: once the arc lands without a stone,
   the next frame returns Barsik to the visible bank and keeps quest progress.

## Patch

`src/three/scenes/Level0Scene.ts` now requires `!this.airborne` in the river's
wet predicate. This is intentionally local to Level 0; the shared jump code
and all other water scenes retain their existing contracts.

## QA route

1. Start from a fresh mobile save and complete the three lanterns.
2. Stand at the near-bank edge, press the visible jump button, and steer toward
   the first raised stone. Confirm the hero rises before any wet recovery.
3. Miss the first stone deliberately. Confirm the splash/recovery still
   returns to the near bank and does not reset lantern progress.
4. Complete the crossing, repair all three visible yurt panels, enter through
   the explicit door action, finish the kui, and check the outro/map save.
5. Run type-check, lint, production build, and `git diff --check`.

The full new-save route remains a release gate until it passes after this
patch; existing source-frozen desktop/mobile Level 0 routes remain the baseline
regression evidence.
