# ADR 035: Level 11 honest snowman and golden catch

Date: 2026-08-24

## Analysis

Level 11 is the winter timing lesson. Barsik first catches two slow white flakes, builds the snowman to seven white flakes, then catches five golden flakes in the air and returns to the completed snowman.

The level's physical and tutorial contracts contradicted what the child saw. A full-size snowman collider existed from the first frame while the snowman was invisible: ordinary forward movement stopped Barsik at `z = -10.45`, `1.55 m` from an empty patch of snow. A smaller rectangular movement clamp also stopped the player `4.832 m` before the visible circular treeline on the east side.

The golden act instructed the player to jump, but the catch test only checked whether the flake was airborne. Barsik could stand underneath a falling golden flake and complete the challenge. Shared Season 1 missions also advertised Space while providing no jump button on touch devices, making the corrected mechanic impossible on mobile.

White flakes left over from the build act counted against the golden spawn cap, retired flakes stayed strongly referenced with undisposed private GPU resources, and multiple golden catches in one update could over-award the target. The finish action hint appeared everywhere instead of only beside the snowman.

The 390×844/medium baseline contained 191 renderables, 106 shadow casters, 128 scene geometries and 100 renderer calls. Most shadow casters belonged to distant winter enclosure/scatter, whose sub-pixel shadows did not justify redrawing them into the shadow map.

## Plan and player contract

- Keep the snowman's physics absent while it is invisible, then grow its collider with the visible body.
- Require Barsik's real airborne state for every golden catch; expose the existing scene `jump()` action through an adaptive shared mobile button.
- Make the visible circular winter enclosure the player-facing boundary and retain only a broad numeric safety guard outside it.
- Treat phase transitions as hard edges: remove stale white flakes before the golden act and remove every remaining flake after the fifth gold reward.
- Retire snowflakes completely by removing their meshes, disposing their private geometry/material and filtering dead references.
- Show the action hint only when the same proximity test makes interaction possible.
- Preserve focal character/prop shadows while disabling low-value shadows from the background winter kit, snowflakes and entrance sign.

Risks: the shared jump control affects every `MissionScreen` level, so it must use the already-supported `ILevelScene.jump()` contract, remain hidden on fine-pointer desktop layouts and avoid the joystick/action regions. A growing collider can trap Barsik if it appears around the hero; its radius starts at `0.45 m`, remains inside the visible snowman and grows only after the first visible snowball.

## Patch

`src/three/scenes/Level11Scene.ts`:

- owns a snowman collider that activates and scales only with the visible snowman;
- requires `this.airborne` for a golden catch;
- clears stale flakes at act boundaries and prevents a sixth same-frame gold reward;
- centralizes complete snowflake retirement and releases private GPU resources;
- derives both the action prompt and interaction permission from the same `3 m` snowman proximity;
- moves the numeric movement guard outside the visible circular enclosure;
- removes shadow casting from winter background roots, the entrance sign and tiny animated flakes without changing their visible placement.

`src/components/MissionScreen.tsx`:

- adds `jump()` to the shared scene interface;
- exposes the existing `.m0-jump` right-thumb control on touch layouts and invokes the current scene's jump action;
- keeps the control hidden under the existing fine-pointer desktop media rule.

A tested static drift merge was rejected and removed: it saved only three renderer calls while increasing the representative rendered-triangle count by about 5,768 through lost per-object frustum culling.

No asset, reward persistence, save-data or production-deployment code changes.

## Measurements

Representative 390×844/medium samples with identical authored density:

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 191 | 191 |
| Shadow casters | 106 | 35 |
| Scene unique geometries | 128 | 128 |
| Renderer calls | 100 | 102 |
| Renderer triangles | 113,027 | 113,913 |
| Renderer geometries | 106 | 109 |
| Referenced textures | 33 | 33 |

The stable structural win is 71 fewer shadow casters (`−67%`). The small renderer/culling differences are runtime winter-scatter and camera-frame variance; no visual object was added to the scene. Dynamic snowflake resources now return to the renderer after collection rather than accumulating for the rest of the level.

## QA route

Desktop 1440×900, ordinary mouse/WASD/Space/E input:

1. Orbit the camera with the mouse and press only `W`; confirm movement follows camera forward (`alignment = 1.000`) without a forced snap.
2. Cross the future snowman footprint before collecting flakes; confirm no invisible collider stops Barsik.
3. Catch the first white flakes and confirm the now-visible growing snowman becomes solid with a matching `0.58 m` collider.
4. Reach seven white flakes and confirm zero white flakes remain in the golden act.
5. Stand underneath a golden flake while grounded; confirm it passes through catch height without awarding progress.
6. Catch all five gold flakes with Space jumps and confirm no sixth reward or remaining flake.
7. Confirm no action hint appears far from the snowman; approach it, press E and reach `outro` with 7 white, 5 gold and 47 gameplay stars.

Result: passed in 87.70 s with zero console/page errors and no direct gameplay-state mutation. The pre-build snowman footprint became traversable, the built snowman remained solid and the boundary probe changed from a `4.832 m` invisible gap to `0 m` at the visible enclosure.

Mobile 390×844/low adaptive profile, physical CDP touch input:

1. Confirm the joystick is 101×101 px with a 16 px left inset and the jump control is 78×78 px with a 20 px right inset; confirm they do not overlap.
2. Swipe the canvas and confirm free orbit changes yaw by `0.665 rad`.
3. Tap the jump control and confirm Barsik becomes airborne with a measured `0.636 m` rise.
4. Use only the physical joystick to catch all seven white flakes.
5. Use the physical jump control for all five golden catches.
6. Drive to the completed snowman, tap the contextual action and confirm `outro`, 7 white, 5 gold, 47 gameplay stars and an empty active-flake list.

Result: passed in 58.17 s with zero console/page errors and no direct gameplay-state mutation.

## Acceptance

- Invisible snowman physics and the inner rectangular boundary no longer contradict visible space.
- Golden flakes require a real jump on desktop and mobile.
- Touch players receive a large adaptive jump control; desktop remains keyboard/mouse only.
- Phase transitions cannot stall, over-award or leak snowflake GPU resources.
- Interaction prompts describe an action that is currently possible.
- Background shadow work is reduced without removing winter colour, silhouettes or focal contact shadows.
- Full desktop and mobile routes complete through normal player input with no browser errors.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
