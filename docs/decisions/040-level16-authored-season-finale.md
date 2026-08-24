# ADR 040: Level 16 authored Season 1 finale

Date: 2026-08-24

## Analysis

Level 16 is the Season 1 payoff: Barsik follows the winter climb, gathers five friends, restores three crystals to a snowflake lock, uses the ice key earned in Level 13 and opens the final chest for a group photo.

The state machine was completable, but several visible states contradicted that story. Every friend had been grounded once and then had `position.y` overwritten with a world-zero bob each frame. On the first waiting friend the difference from terrain was about `0.79 m`, enough to bury most of the character. Greeting a friend started the procession but left the gold meeting ring glowing at the empty location. Four friends described as “already waiting at the cave” remained invisible until the chest opened, so more than half of the final photograph still appeared from nowhere.

The ice key was visible near the spawn instead of belonging to Barsik. It stayed there while the player crossed the whole valley, then vanished remotely when the chest was used. The key's inventory state therefore had no spatial continuity.

The imported `treasure_chest.glb` is a single static mesh. The scene retained that closed mesh and animated a separate procedural box above it as a lid. The visible asset never opened. World confetti also used the chest's obsolete coordinates around `z = -4`, thirty metres from the real finale at `z = -34`; only the React result-card confetti made the ending appear to celebrate.

Eight identical 3,306-triangle crystal props surrounded the chest although only three could be interacted with. Five high-detail decoys looked like quest objects, consumed about 16,500 referenced triangles and all cast shadows. The 390×844/medium baseline contained 204 renderables, 89 shadow casters, 137,515 referenced triangles and 159 unique scene geometries.

## Plan and player contract

- Preserve each character rig's grounding offset and add terrain height continuously while friends wait and walk.
- Hide the matching meeting ring as soon as its friend is greeted.
- Show the four cave-side friends from the beginning; locked friends remain readable as soft translucent silhouettes.
- Keep the earned ice key visibly at Barsik's shoulder until it enters the lock.
- Replace the contradictory static-GLB/procedural-lid stack with one coherent rounded ice chest whose actual visible lid rotates around a rear hinge.
- Launch all world celebration particles around the real chest at `CHEST_Z`.
- Keep three imported quest crystals; replace five non-interactive copies with small dim shared low-poly facets.
- Preserve focal shadows for Barsik, the chest, three active crystals and principal friends while removing background shadow redraws.
- Smooth the ordinary follow-camera vertically over terrain and retain free render-time orbit.

Risks: showing four additional friends earlier adds visible draws and texture residency, a procedural chest could look flatter than a textured prop, and terrain-following can double-count a model's root offset. The photo assembly is a deliberate finale cost; removing 61 shadow casters and about 19,000 scene triangles offsets it. Rounded ice, gold bands, a dark cavity and a hinged lid make the procedural chest both more legible and functionally honest than the black closed single-mesh asset. Ground height and the one stored model-specific offset are kept separate and QA checks every friend's final error against that sum.

## Patch

Only `src/three/scenes/Level16Scene.ts` changes:

- shared silhouette body/head geometry removes repeated procedural allocations;
- winter scatter, entrance signage and ambient authored decoration stop casting low-value shadows;
- meeting rings share geometry/material, identify their friend and retire on greeting;
- non-waiting cave friends are visible throughout the level and locked silhouettes receive their translucent state at creation;
- `groundOffset` preserves each rig's local seating while `groundHeightAt()` follows the terrain during the procession;
- the ice key follows Barsik's shoulder and retires together with the chest marker during the valid key hand-off;
- five decorative crystal copies become shared eight-triangle facets with no shadows; the three real lock crystals retain imported art and visible flight states;
- all three lock rays share geometry while keeping independent light state;
- a rounded blue/gold chest replaces the static imported mesh, with a dark interior and a true rear-hinged lid;
- scene confetti is emitted around `z = -34`, and normal/finale camera motion uses the shared smoothed helper.

No BaseLevel, shared input, shared HUD, reward persistence, save-data, source asset, Level 13 key-resolution or production-deployment changes.

## Measurements

Representative 390×844/medium samples:

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 204 | 208 |
| Shadow casters | 89 | 28 |
| Referenced scene triangles | 137,515 | 118,491 |
| Scene unique geometries | 159 | 148 |
| Referenced textures | 53 | 52 |
| Renderer calls | 126 | 140 |
| Renderer triangles | 138,322 | 131,557 |

The package removes 61 shadow casters, 19,024 referenced scene triangles and 11 scene-geometry identities. Four additional cave-side friends are now intentionally rendered before the finale, increasing the representative draw count by 14 and uploading their textures; the renderer still submits about 6,800 fewer triangles in the same view. This trade makes the group-photo story honest rather than hiding characters to improve a counter.

## QA route

Desktop 1440×900, medium quality, ordinary mouse/WASD/E input:

1. Finish the intro, rotate the free camera by about `1.26 rad`, press only W and confirm camera-relative alignment `1.000`.
2. Confirm the ice key remains visible within `1.65 m` of Barsik after movement.
3. Follow the authored left/right climb and greet all five friends; after each greeting confirm exactly one gold meeting ring retires and the friend starts walking.
4. Confirm gather closes at 5/5 with all meeting rings hidden and four cave-side friends already visible.
5. Visit the three guided imported crystals; confirm each becomes non-interactive, flies into its own ray and lights that ray before the chest step.
6. Approach the chest with 27 stars, use the key, and confirm key and chest marker retire only on the valid interaction (37 stars).
7. Confirm the actual visible lid reaches `-1.948 rad`, the dark cavity is exposed and world celebration sparks exist around `z = -34`.
8. Confirm all nine friends are visible, no procession remains in motion and every final terrain error stays within the `±0.035 m` authored bob.
9. Confirm `outro`, 5/5 friends, 3/3 crystals, open chest, 57 gameplay stars and the Season 2 teaser.

Result: passed in 60.06 s with zero console/page errors and no direct gameplay-state mutation.

Mobile 390×844/low adaptive profile, physical CDP touch input:

1. Confirm joystick 101×101 px at a 16 px left inset and jump 78×78 px at a 20 px right inset.
2. Swipe the canvas (`0.665 rad` yaw change), tap jump (`0.636 m` rise) and confirm the key remains at Barsik's shoulder.
3. Use only the visible joystick and context action button for five greetings, three lock-crystal flights and the chest hand-off.
4. Confirm every marker/state transition matches desktop, all friends finish grounded, the real lid opens and world particles celebrate at the cave.
5. Confirm the portrait result card fits the viewport and final state remains 5/5, 3/3, open chest and 57 gameplay stars.

Result: passed in 63.97 s with zero console/page errors and no direct gameplay-state mutation.

## Acceptance

- Every waiting and walking friend remains seated on the actual terrain.
- Greeting a friend visibly consumes that meeting state; no empty objective ring remains.
- The cave-side cast is visible before the finale and the group photo assembles instead of popping into existence.
- The Level 13 key remains spatially attached to Barsik until the snowflake lock consumes it.
- Exactly three high-readability crystals are quest objects; decorative facets cannot impersonate interaction.
- The visible chest itself opens around a coherent hinge and reveals a readable dark interior.
- World particles, camera composition and the friend arc all celebrate the real chest position.
- Free camera, camera-relative movement, jump and context interaction work on desktop and touch.
- Desktop and mobile full routes complete with no browser errors.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
