# ADR 039: Level 15 snowman state and shadow budget

Date: 2026-08-24

## Analysis

Level 15 asks the player to save a melting snowman in two readable acts: carry three snow chunks under a soft timer, then recover his nose, hat, scarf and buttons. The route itself was complete, but the item state machine broke its own fiction.

Carrying moves the actual pickup mesh above Barsik. When a chunk timed out, the code made that mesh visible without restoring its authored position, so the physical snow stayed at Barsik while the marker remained at the original drift. Successful delivery left the same carried mesh beside the snowman even though the snowman also grew, duplicating one chunk into two results.

Five chunk pickups exist to give the player route choice, but only three are required. After the third delivery, the two unused chunks continued bobbing and glowing like active pickups throughout the feature act even though interaction had silently moved on. The transition also reset the logical melt amount without reapplying the visual scale, leaving the rendered snowman smaller than the HUD state.

The outro instructed the player to walk to a winter chest, while Level 15 has no chest interaction or exit marker in its scene. The actual winter chest is a separate Level 16; a Level 15 result card must resolve the snowman rescue instead of presenting an impossible local objective.

The 390×844/medium baseline contained 238 renderables, 125 shadow casters, 176 scene geometries and 115 resident renderer geometries. Distant winter scatter, the entrance sign, authored props and ambient animals all redrew into the shadow map, and five identical snow chunks allocated five sphere geometries.

## Plan and player contract

- Store every carryable's authored home transform and restore a timed-out chunk to the same drift.
- Treat successful chunk delivery as visible absorption: hide the chunk, grow the snowman and play the existing snow/gold burst.
- After three valid deliveries, convert the two unused pickups into flat, non-glowing snow patches rather than leaving fake objectives or making objects vanish without explanation.
- Reapply the snowman's visual scale after the melt reset so model and HUD agree.
- Keep all four recovered features visible on the finished snowman.
- Resolve Level 15 in its result card; Level 16 remains the dedicated winter-chest level.
- Preserve focal shadows for Barsik, the snowman and active quest objects, while removing shadow redraws from background scatter and ambient set dressing.
- Use one shared chunk geometry/material and the shared vertically smoothed follow-camera helper.

Risks: flattening spare chunks could still read as a collectible if their glow or marker remained, sharing a material could accidentally alter an active chunk, and a restored timeout object could compete with a different nearest objective. Spare chunks retire only after all chunk gameplay is complete, lose both emissive intensity and marker, and are excluded from active-item and bobbing queries; before that transition the shared material is unchanged. The restored mesh returns before nearest-objective selection runs, so marker, guide arrow and interaction all converge on its authored drift.

## Patch

Only `src/three/scenes/Level15Scene.ts` changes:

- `Carryable.home` records each pickup's authored position and timeout restores it before the objective loop updates;
- delivered chunk meshes retire as the existing snowman growth/burst communicates absorption;
- `settleSpareChunk()` turns the two unused chunks into flat ambient snow and removes them from interaction/bobbing;
- the feature transition reapplies the final `1.14` snowman scale after clearing melt;
- all five snow chunks share one sphere geometry and one standard material;
- winter scatter, entrance signage, authored props and ambient animals stop casting low-value shadows;
- the normal chase camera uses `updateCamera()` for vertically smoothed terrain following;
- final Russian/Kazakh copy celebrates the completed snowman and no longer issues a nonexistent local chest objective.

No BaseLevel, shared input, shared HUD, reward persistence, save-data, asset-file, Level 16 or production-deployment changes.

## Measurements

Representative 390×844/medium samples:

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 238 | 241 |
| Shadow casters | 125 | 29 |
| Scene unique geometries | 176 | 172 |
| Renderer geometries | 115 | 95 |
| Referenced textures | 47 | 47 |
| Renderer textures | 26 | 26 |

The scene removes 96 shadow casters, four explicit chunk-geometry allocations and 20 resident renderer geometries while retaining every landmark, quest item and ambient character. Procedural winter placement changed the representative scene sample by three renderables and roughly one thousand referenced triangles; this package does not claim a draw-call or triangle reduction.

## QA route

Desktop 1440×900, medium quality, ordinary mouse/WASD/E input:

1. Finish the intro, drag the canvas and confirm free orbit changes yaw by about `1.26 rad`.
2. Press only W after the orbit and confirm displacement follows visible camera forward (`alignment = 1.000`).
3. Pick up and visibly carry the first chunk, deliver it and confirm pressure mode opens.
4. Pick up the second chunk and deliberately wait for the 32-second timer to expire; confirm its mesh, marker, guide objective and interaction all return to the authored drift.
5. Pick it up again, deliver it, deliver a third chunk and confirm the two unused chunks remain visible only as flat retired snow patches.
6. Confirm all three delivered chunk meshes are hidden while the snowman has grown to `1.14`.
7. Retrieve and visibly carry the nose, hat, buttons and scarf; confirm each remains attached after delivery.
8. Confirm `outro`, 3/3 chunks, 4/4 features, 59 gameplay stars including the retry pickup, the authored rescue copy and no old chest instruction.

Result: passed in 130.08 s with zero console/page errors and no direct gameplay-state mutation.

Mobile 390×844/low adaptive profile, physical CDP touch input:

1. Confirm joystick 101×101 px at a 16 px left inset and jump 78×78 px at a 20 px right inset.
2. Swipe the canvas and confirm yaw changes; tap jump and confirm the scene enters an airborne state.
3. Use only the visible joystick and context action button for all three timed snow deliveries and all four feature deliveries.
4. Confirm carried items remain visible, delivered chunks retire, spare chunks settle, and delivered features remain on the snowman.
5. Confirm the portrait result card fits the viewport and final state remains 3/3, 4/4, 57 gameplay stars and snowman scale `1.14`.

Result: passed in 105.86 s with zero console/page errors and no direct gameplay-state mutation.

## Acceptance

- A timed-out snow chunk returns to the drift shown by its marker and guide arrow.
- Successful chunk delivery has one unambiguous visible result and never duplicates the prop.
- Spare chunks stop advertising interaction and become readable scenery without disappearing.
- Visual snowman size and HUD state agree after the rescue transition.
- Every recovered feature remains visibly attached to the completed snowman.
- The final story resolves Level 15 and does not impersonate Level 16's chest interaction.
- Free camera, camera-relative movement, jump and context interaction work on desktop and touch.
- Background shadow cost falls without flattening focal rescue objects.
- Desktop and mobile full routes complete with no browser errors.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
