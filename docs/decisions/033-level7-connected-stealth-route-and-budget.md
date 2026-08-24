# ADR 033: Level 7 connected stealth route and forest budget

Date: 2026-08-24

## Analysis

Level 7 is Putalo's forest meeting. The player follows him through four butterfly-photo hides, learns the move-while-he-shoots/freeze-while-he-looks rule, answers him kindly, recovers three photographs blown away by the wind and returns them for the exit.

The previous scene looked traversable but its movement geometry described a narrow north/south corridor around `x = 0`. The authored hides alternate between `x = -11` and `x = 13`; their reserved rooms did not touch that corridor. Normal WASD input stopped Barsik at approximately `(1.40, -13.70)`, still `11.91 m` from the second hide. The gather phase had the same defect: the photograph at `x = 18` and routes between photographs were not guaranteed to connect. These were invisible walls in the critical path.

Level 7 also overrode `BaseLevelScene.bindKeys()` for dialogue selection without restoring the shared camera-orbit and orientation bindings. Pointer/touch events reached the canvas, but `camYawTarget` never changed, making this the only Season 1 level with a non-functional 360° drag.

The close-range HUD advertised E/the paw beside Putalo during stealth even though no approach interaction existed, and that dead prompt could hide the more important freeze warning. Putalo's ground height was calculated and then overwritten by a `sin()` bob around world `y = 0`, so uneven terrain made him visibly sink or float.

The 390×844/medium baseline contained 391 renderables and 121 shadow casters. Ownership inspection attributed 89 casters to random noninteractive forest/ground scatter; 22 static bushes were separate renderables.

## Plan and player contract

- Replace the disconnected corridor with one authored polyline through spawn, all four hides and all three photograph rooms, including a closing gather leg so collection order is not constrained.
- Reuse the same route for movement, terrain flattening, trail stones, tree reservations and the visible forest boundary.
- Preserve an explicit low tree boundary but clear the follow-camera lens corridor of the tall enclosure rows.
- Restore shared camera-orbit/orientation input inside Level 7's dialogue-aware keyboard binding.
- Remove the dead approach interaction, keep freeze/lifting warnings authoritative at every distance and show trust progress while standing quietly.
- Merge the 22 static bushes and remove `castShadow` only from random background scatter.
- Apply Putalo's bob relative to sampled ground height.

Risks: a winding enclosure creates more instanced asset parts than the old straight strip, so scene renderable count can increase even while actual renderer calls, shadow work and GPU geometry decrease. Route samples also reserve more ground from random trunks. These are intentional costs for honest traversability and camera readability; authored rocks, hide cover, Putalo and story props keep their collisions and shadows.

## Patch

Only `src/three/scenes/Level7Scene.ts` changes:

- `LEVEL_ROUTE` and `pointOnRoute()` form the shared geometric source for movement, terrain, trail, decoration offsets and enclosure.
- Every route sample and lost-photo room is reserved before random placement, preventing an uncollidable random trunk from blocking an opened corridor.
- `enclosePath()` keeps its low physical row and excludes the tall mid/far rows from an `11.2 m` camera clearance around the route.
- The 22 bushes are baked through the existing `mergeStatic()` seam; only temporary source geometries are disposed because their material is shared.
- A scene-child ownership boundary disables shadow casting for `loadTrees()`/`loadProps()` output without touching authored gameplay objects.
- Level 7's input method explicitly restores `bindCameraOrbitDrag()` and `bindOrientationChange()`.
- Interaction/HUD ordering and Putalo's vertical placement now match their real gameplay contracts.

No shared BaseLevel, global input, physics, reward, asset or production-deployment code changes.

## Measurements

Representative 390×844/medium samples:

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 391 | 417 |
| Shadow casters | 121 | 32 |
| Renderer calls | 221 | 213 |
| Renderer triangles | 99,354 | 78,898 |
| Renderer geometries | 202 | 164 |
| Referenced textures | 19 | 19 |

The 26 extra scene renderables are instanced parts of the visible winding boundary, not 26 extra private draw calls. The final frame performs eight fewer renderer calls, renders 20,456 fewer triangles and keeps 38 fewer GPU geometries while eliminating 89 background shadow casters.

## QA route

Desktop 1440×900, ordinary WASD/Shift/E/ArrowRight input:

1. Intentionally sprint inside Putalo's notice radius and confirm he hides without ending or resetting the level.
2. Recover, then complete all four hides by walking only while he is shooting and stopping while he lifts/looks.
3. Confirm the previously blocked second hide is reachable by normal movement.
4. Hold movement into the authored rock and confirm its visible collider stops Barsik at `1.95 m` from its centre.
5. Open the dialogue, select the second kind response and continue through the photo flash.
6. Collect the photographs in order 1 → 2 → 3, including the former disconnected photo 2 → photo 3 leg.
7. Return to Putalo and confirm the outro, three photographs and 64 gameplay stars.

Result: passed in 144.31 s with zero console/page errors and no direct gameplay-state mutation. Putalo stayed within `0.03 m` of the sampled ground+bob contract.

Mobile 390×844/low adaptive profile, physical CDP touch input:

1. Swipe the canvas and confirm free orbit changes yaw by `0.67 rad`.
2. Use a full-strength visible joystick (`0.96`) to trigger the readable spook consequence.
3. Recover with a walk-strength joystick (`0.70`), freeze during look-ups and complete all four hides.
4. Use the contextual paw for dialogue, select response two with the joystick and confirm it with the paw.
5. Drive to and collect all three photographs with joystick/paw only, then return to Putalo.
6. Confirm the 101×101 px joystick has a 16 px left inset and no dead approach action appears.

Result: passed in 173.76 s with `outro`, dialogue choice 2, three photographs, 64 gameplay stars and zero console/page errors. Medium-profile visual/GPU measurements were run separately so the functional low-end test exercises the product's adaptive-quality contract instead of timing out under headless software rendering.

## Acceptance

- Every objective room is connected by visible, walkable geometry; no critical-path invisible wall remains.
- Level 7 accepts unrestricted 360° mouse/touch orbit and camera-relative movement.
- The freeze/shooting rule is always more prominent than proximity flavour text; approach never advertises a dead action.
- Putalo stays grounded, all authored colliders/interactions remain active and photograph collection order is unrestricted.
- Medium rendering reduces shadow, triangle, call and GPU-geometry budgets without deleting forest depth.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
