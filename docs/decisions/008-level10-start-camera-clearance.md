# ADR 008 — Keep the Level 10 launch camera outside the forest cap

**Status:** accepted · 2026-08-11
**Scope:** `BaseLevelScene.enclosePath()` opt-in behaviour and Level 10 only.

## Context

Level 10 begins at the back end of a serpentine route. The forest enclosure
correctly closes that end so the movement boundary does not feel invisible,
but its tall cap also occupied the follow camera's rear lens volume. At both
390 × 844 and 1440 × 900, pressing `Играть` could therefore open into a tree
trunk/canopy rather than Barsik and the first objective.

Moving the spawn, changing the route width, or adding tree colliders would
hide the composition problem by changing gameplay. The cap is an instanced,
visual boundary already; it has no collision role.

## Decision

- `enclosePath()` accepts an opt-in list of `visualClearZones`. They exclude
  only candidate trees from the instanced enclosure; they do not alter
  `playPath`, reserved rooms, movement clamps, or collider data.
- Level 10 provides one 9.5 m clear zone centred on its initial rear camera
  volume. The surrounding treeline remains on both sides and beyond the
  clearing, keeping the level closed-in without placing foliage in the lens.
- No global camera or forest-density change is made. Other levels retain
  their current composition until a screenshot review identifies the same
  issue.

## Test notes

Run `npm run type-check`, `npm run lint`, `npm run build`, and
`git diff --check`. On local `?mission=10`, wait for the ready gate, press
`Играть`, and check the initial shot at 390 × 844 and 1440 × 900:

1. Barsik, the spawn pad and first guide target are visible rather than
   occluded by a foreground trunk/canopy.
2. The treeline still frames the scene.
3. The level mounts without console errors; movement and interaction retain
   the authored route/collider behaviour.

**2026-08-11 result:** both checked start shots show Barsik, the spawn pad and
the forward guide lane while the forest continues to frame the clearing. The
desktop movement-input smoke and both start checks reported no console errors.
Only instanced tree candidate placement changed; the Level 10 path, reserved
rooms, movement bounds and colliders are byte-for-byte outside this patch.
