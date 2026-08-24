# ADR 038: Level 14 authored cold-rescue route

Date: 2026-08-24

## Analysis

Level 14 teaches one resource across three acts: meet a freezing Aya and learn the warmth meter, follow the wind to recover her scarf, then gather three bundles of wood and build a permanent fire beside her.

The authored coordinates formed a useful left/right serpentine with three campfires placed as safe islands, but navigation always chose the nearest unsearched drift. That shortcut reached the nominally “farthest” scarf after only four of eight drifts. A full sprint then completed the whole level in 65.26 seconds with warmth still at 84%; half the search content and the safe-fire decision never mattered.

At critical warmth the HUD told the child to find a fire while the world arrow continued pointing to a snowdrift or log. The non-fail sneeze worked, but navigation contradicted it. Once the scarf was found it existed only as a boolean/HUD line until it appeared on Aya, so the important rescue object had no carried state. Searched false drifts remained visually identical to untouched drifts.

The outro claimed a snowman was melting and instructed the player to go to it, but the level contains no snowman and immediately opens the result state.

The 390×844/medium baseline contained 226 renderables, 127 shadow casters, 159 scene geometries and 120 resident renderer geometries. Winter scatter, entrance signage and decorative props all redrew into the shadow map; three identical flames and nine identical log cylinders allocated separate geometry.

## Plan and player contract

- Treat the eight authored drift coordinates as a deliberate wind trail and expose exactly one live search marker at a time.
- Keep each searched empty drift in the world as a visibly flattened dug-out patch.
- Reuse the real scarf art as a visible carried object from discovery until hand-off, then show the same art on Aya.
- At `≤25%` warmth or during a sneeze, point the guide arrow to the nearest lit fire; resume the interrupted objective after recovery.
- Measure Aya's completed fire at its visible offset position rather than at Aya's body origin.
- Make the final copy and composition pay off the scarf and fire that actually exist in the scene.
- Remove only background/decorative shadow work and share repeated flame/log geometry; preserve shadows for Barsik, Aya, searchable drifts, carried wood and the three safe fires.

Risks: a strict sequence can feel arbitrary, cold routing can steal a quest target while an item is carried, and cloned scarf art can double memory. The marker copy identifies the sequence as a wind trail; safe-fire routing activates only at a clearly communicated threshold and returns automatically; the carried scarf clone shares geometry/material with Aya's scarf and is visible only during the hand-off leg.

## Patch

Only `src/three/scenes/Level14Scene.ts` changes:

- `nextDrift()` and `updateDriftMarkers()` make all eight snowdrifts one readable serpentine instead of a nearest-neighbour shortcut;
- empty searched drifts flatten and retain a persistent `searchedVisual` state;
- a shared-art carried scarf follows Barsik and retires exactly when Aya's scarf becomes visible;
- critical warmth and sneeze states temporarily route `objectiveWorldPos()` to the nearest actual fire position;
- the finished Aya fire contributes warmth from its visible transform rather than the NPC origin;
- final copy celebrates the built fire instead of promising a nonexistent snowman;
- the ordinary chase camera uses the shared vertically smoothed follow helper, while the outro frames Aya's rescue area;
- winter scatter, entrance signage and ambient authored decoration stop casting low-value shadows;
- three flame meshes share one cone geometry/material and nine log sticks share one cylinder geometry/material.

No BaseLevel, shared input, shared HUD, reward persistence, save-data, asset-file or production-deployment changes.

## Measurements

Representative 390×844/medium samples:

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 226 | 226 |
| Shadow casters | 127 | 45 |
| Scene unique geometries | 159 | 149 |
| Renderer geometries | 120 | 115 |
| Referenced textures | 41 | 41 |
| Renderer textures | 34 | 34 |

The scene removes 82 shadow casters and ten authored geometry allocations while retaining every landmark, drift, fire, log bundle and ambient character. The carried scarf deliberately adds one transient shared-art draw only between discovery and hand-off. Random winter placement changed the representative renderer sample from 101 to 103 calls and 77,521 to 78,079 triangles; this package does not claim a call/triangle reduction.

## QA route

Desktop 1440×900, ordinary mouse/WASD/E input:

1. Finish the intro, drag the canvas and confirm free orbit changes yaw by `1.232 rad`.
2. Press only W after the orbit and confirm displacement follows visible camera forward (`alignment = 1.000`).
3. Meet Aya and wait away from fire until warmth naturally reaches `23.6%`; confirm the guide objective switches from the first drift to the nearest fire.
4. Walk to that fire, recover above `58%`, and confirm the wind-trail objective resumes without direct state mutation.
5. Search all eight marked drifts in authored order; after each false result confirm the pile remains as a visibly flattened searched patch.
6. Find the scarf at drift eight, confirm it is visible on Barsik, deliver it to Aya and confirm the carried copy retires as Aya's scarf appears.
7. Retrieve and visibly carry each of three log bundles, deliver each once, and confirm the new fire grows through three states.
8. Confirm `outro`, 8/8 searched, 3/3 logs, 52 gameplay stars, Aya's scarf and fire visible, and no snowman instruction.

Result: passed in 157.93 s with zero console/page errors and no direct gameplay-state mutation. The earlier shortcut baseline passed in 65.26 s but searched only 4/8 drifts and never needed a fire.

Mobile 390×844/low adaptive profile, physical CDP touch input:

1. Confirm joystick 101×101 px at a 16 px left inset and jump 78×78 px at a 20 px right inset.
2. Swipe the canvas and confirm yaw changes by `0.665 rad`; tap jump and confirm a `0.635 m` airborne rise.
3. Use only the visible joystick and context action button for the complete eight-drift scarf route and all three wood deliveries.
4. Confirm every false drift retains its searched visual, the scarf is visible while carried, and each delivered log becomes inactive.
5. Confirm the portrait result copy fits the viewport and final state remains 8/8, 3/3, 52 gameplay stars with scarf/fire visible.

Result: passed in 143.19 s with zero console/page errors and no direct gameplay-state mutation.

## Acceptance

- The first-play route exposes all eight authored search beats; the scarf can no longer be reached through the nearest-neighbour shortcut.
- Only the current wind-trail drift is marked and interactable; searched drifts retain a readable world state.
- Critical warmth, HUD copy and world navigation agree on the nearest real fire.
- Finding, carrying and handing over the scarf are three visible states.
- All three log bundles remain visible while carried and retire only on valid delivery.
- The final story pays off objects that actually exist in the level.
- Free camera, camera-relative movement, jump and context interaction work on desktop and touch.
- Background shadow cost falls without flattening focal rescue objects.
- Desktop and mobile full routes complete with no browser errors.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
