# ADR 042 — Level 5 full-route and terrain contract

- Status: accepted
- Date: 2026-08-24
- Scope: Level 5 playable bounds, quest-state QA, terrain attachment and mobile forest budget

## Analysis

The render-only audit in ADR 024 did not certify the quest route. A fresh
keyboard run found a release-blocking spatial defect on the first controllable
frame: Barsik moved from the authored spawn at `z=4` to `z=-57` after one
ordinary forward step.

The shared forest enclosure derives a corridor's finite z-range from gameplay
rooms registered through `reserve()`. Level 5 registered only the final burrow
at `z=-71`, so the legal range became approximately `-85…-57`; the visible
100-metre path, squirrel, nuts, two blockages, handover and three story stops
were outside the level's own movement contract. The same omission meant the
visible treeline only enclosed the final approach.

The route also used world-absolute y values for the squirrel, carried basket,
escort ring, wait marker, key and several set pieces. Terrain varies along the
route, so the squirrel could float or sink and the basket changed its apparent
attachment height with the carrier's ground height.

## Plan

1. Register every authored gameplay beat as a real room before environment
   placement, letting the existing shared clamp and forest enclosure describe
   the same path the player sees.
2. Replace duplicated blockage/handover coordinates with named authored beats.
3. Ground moving actors, carried props, interaction markers, obstacles, the
   burrow and key through `groundHeightAt()` while preserving their authored
   animation offsets.
4. Extend `encloseLevel()` with an optional local forest profile. Keep all
   existing callers unchanged; use two overlapping rows only for Level 5 on
   mobile because its newly honest enclosure is over 100 metres long.
5. Make the development `?at=x,z` route sampler restore already-completed nuts,
   blockages, handover and story stops instead of dropping late-route QA into
   an impossible early quest state.
6. Run the complete route from a new Level 5 session on desktop Russian and
   mobile Kazakh using the visible input systems, then sample the render budget
   at four route positions.

The principal risk was that enclosing the complete corridor would restore
physical readability but regress the mobile render budget. That is why the
forest-profile change and four-point measurement are part of the same patch.

## Patch

- `Level5Scene` now reserves the spawn, spill clearing, stone wall, root wall,
  basket handover, all three story stops and burrow. The first movement frame
  remains near the spawn instead of being projected to the final act.
- The squirrel is sampled against terrain every frame and keeps only its
  `-0.02…+0.05 m` idle/walk bob. The basket rides at a stable offset above its
  current carrier. Escort/wait/quest markers, obstacles, burrow, treehouse and
  acorn key share the same terrain basis.
- Cleared roots lift relative to the terrain under their animated position,
  not toward the global height `y=1.9`.
- `BaseLevelScene.encloseLevel()` accepts optional `rows`/`step` values. Defaults
  are unchanged. Level 5 uses four rows on desktop and two overlapping rows at
  wider spacing on mobile; the visible boundary remains continuous in sampled
  phone frames while hidden distant canopy is not submitted.
- Late development starts now enter the correct act: spill items are already
  collected, passed blockages are open, the basket is on Barsik after the
  handover and only earlier story stops are marked told.

From the player's point of view, Level 5 is now one continuous, legible route:
walking starts where the intro placed Barsik, every objective has room to be
approached, the forest—not an invisible coordinate clamp—explains the edge,
and the squirrel/basket remain physically attached to the ground and carrier.

## QA route

### Full desktop route — Russian, 1440×900

- Clicked the real Play control and used the bound WASD keyboard events; no
  scene-state mutation or teleport was used.
- Completed this exact sequence:
  `intro → escort → spilled → escort → blocked → escort → blocked → escort → handover → carry → arrived → outro`.
- Result: 12 interactions, 5/5 nuts, 5/5 obstacle pieces, 3/3 story stops,
  acorn key granted, 25 level stars, 292.29 s automation wall time and zero
  page/console errors.
- Final desktop correctly had no visible touch joystick.

### Full mobile route — Kazakh, 390×844

- Used Chrome mobile/touch emulation and physical CDP touch events on the
  visible floating joystick and action button. The camera received an actual
  touch drag before the route; final `camYaw=0.6084` confirms the orbit was not
  locked.
- Completed the same twelve-phase route with the same 12 interactions, 5/5
  nuts, 5/5 obstacle pieces, 3/3 stops and acorn key.
- Result: 206.54 s automation wall time, joystick displayed as `grid`, Kazakh
  HUD/outro readable and zero page/console errors.

### Height and render audit

- Across both full runs the squirrel stayed `-0.020…+0.050 m` from sampled
  terrain; the basket stayed `0.530…0.760 m` above the current carrier.
- Final mobile route samples after the full enclosure profile:

| Position | Phase | Calls | Triangles | Renderables | Shadow casters |
| --- | --- | ---: | ---: | ---: | ---: |
| Spawn `z=4` | escort | 213 | 166,017 | 394 | 188 |
| Stones `z=-16` | blocked | 191 | 144,544 | 387 | 190 |
| Story route `z=-52` | carry | 128 | 128,543 | 385 | 184 |
| Burrow approach `z=-68` | carry | 115 | 123,209 | 387 | 188 |

All four samples stayed below the 180k normal-phone triangle guard and
reported zero browser errors. The late samples also proved the development
state contract: five spill items retired, carrying enabled and respectively
one and three story stops already told.

### Engineering gates

Run TypeScript, ESLint, production build and `git diff --check`. The known
`src/main.tsx` Fast Refresh warning and the existing Three vendor chunk warning
remain non-Level-5 findings; no new warning is accepted by this patch.
