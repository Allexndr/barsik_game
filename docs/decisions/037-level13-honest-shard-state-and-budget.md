# ADR 037: Level 13 honest shard state and budget

Date: 2026-08-24

## Analysis

Level 13 is the Season 1 ice-craft lesson. Barsik meets a sculptor, retrieves five ice shards spread across the valley, carries each one back to the podium, then circles the completed sculpture and polishes it from three sides to receive the ice key.

The authored route and its three-act verb progression were sound and fully reachable, but every delivered physical shard remained visible at Barsik's hand position while a new sculpture part appeared on the podium. The same object therefore existed twice after every delivery, contradicting the pickup state and turning the workspace into visual debris.

The five small imported shard props cost 16,530 triangles, five shadow casters and four texture channels per prop family even though they occupy only pickup-scale screen space. Three polish stations allocated identical ring geometries separately. The dense winter scatter, entrance sign and distant decoration still rendered into the shadow map, producing 118 shadow casters in a 222-renderable scene.

The sculptor's idle turn added a sine value to rotation on every frame. This accumulated rather than oscillated, produced tens of radians over time and changed speed with display refresh rate.

## Plan and player contract

- Preserve each shard as a visible, individually interactive world object and keep it visible while Barsik carries it.
- In the same transaction that adds the corresponding sculpture part, retire the physical shard so delivery has one honest visual state.
- Replace pickup-scale imported shards with a shared low-poly faceted silhouette and material while retaining independent positions, markers, bobbing and carried state.
- Share the three identical polish-ring geometries.
- Remove only low-value winter-background and entrance-sign shadow work; retain Barsik, the sculptor, podium and sculpture as focal casters.
- Make the sculptor's idle turn a bounded absolute oscillation around the authored facing angle.

Risks: hiding a shard too early would make carrying unreadable, sharing geometry could accidentally share interaction state, and a broad shadow pass could flatten the focal workspace. The delivery transition hides only the captured carried mesh after the valid master interaction; logical state remains per shard; the shadow pass is limited to environment roots created by `setupWinterEnvironment()` plus the entrance sign.

## Patch

Only `src/three/scenes/Level13Scene.ts` changes:

- a delivered shard becomes invisible exactly when its corresponding sculpture part becomes visible;
- five independent 3,306-triangle imported shard clones become five independent eight-triangle meshes backed by one octahedron geometry and one clearcoat material;
- the three polish stations share one ring geometry without sharing `done` state;
- winter ambient roots and the entrance sign stop casting low-value shadows;
- the sculptor records the authored base yaw and uses a bounded `±0.06 rad` time-based idle motion.

No shared input, BaseLevel, HUD, reward persistence, save-data, asset-file or production-deployment changes.

## Measurements

Representative 390×844/medium samples:

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 222 | 218 |
| Shadow casters | 118 | 39 |
| Scene triangles | 142,972 | 125,764 |
| Scene unique geometries | 151 | 149 |
| Referenced textures | 41 | 37 |
| Renderer triangles | 88,658 | 86,056 |
| Renderer geometries | 115 | 114 |
| Renderer textures | 36 | 31 |

The structural scene removes 79 shadow casters, 17,208 authored triangles, two unique geometries and four referenced texture channels. The five gameplay shards alone fall from 16,530 triangles to 40 while preserving five separately testable objects. Representative renderer calls varied from 96 to 98 because random winter placement changes frustum visibility; this package does not claim a draw-call reduction.

## QA route

Desktop 1440×900, ordinary mouse/WASD/E input:

1. Finish the intro, drag the canvas and confirm free orbit changes yaw by `1.233 rad`.
2. Press only W after the orbit and confirm movement follows visible camera forward (`alignment = 1.000`).
3. Walk to each of the five shards, press E, and confirm the selected shard remains visible above Barsik while carried.
4. Return each shard to the sculptor and confirm delivery increments once, the physical shard becomes invisible, and exactly one new sculpture part appears.
5. After 5/5 deliveries, walk around the podium and activate all three independently reachable polish rings.
6. Confirm the final state is `outro`, 5/5 delivered, 3/3 polished, 37 gameplay stars and the ice key visible.

Result: passed in 81.69 s with zero console/page errors and no direct gameplay-state mutation.

Mobile 390×844/low adaptive profile, physical CDP touch input:

1. Confirm the joystick is 101×101 px with a 16 px left inset and jump is 78×78 px with a 20 px right inset.
2. Swipe the canvas and confirm free orbit changes yaw by `0.665 rad`.
3. Tap jump and confirm a real `0.632 m` airborne rise.
4. Use only the visible joystick and context action button to retrieve and deliver all five shards, then polish all three faces.
5. After every delivery, assert that the delivered physical mesh is hidden rather than duplicated near the podium.
6. Confirm the portrait result frame fits the viewport and the final state remains 5/5, 3/3, 37 gameplay stars with the ice key visible.

Result: passed in 79.03 s with zero console/page errors and no direct gameplay-state mutation.

## Acceptance

- Picking up, carrying and delivering a shard have distinct, readable and non-duplicated visual states.
- Five deliveries build five sculpture parts exactly once.
- All five shard routes and all three polish stations are reachable with normal desktop and mobile controls.
- Camera orbit, camera-relative movement, jump and context interaction remain functional.
- The sculptor idle animation is bounded and refresh-rate independent.
- Focal characters and sculpture retain grounding shadows while background shadow cost is reduced.
- Desktop and mobile full routes complete with no browser errors.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
