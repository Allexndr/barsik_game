# ADR 036: Level 12 camera-relative ice and real gate

Date: 2026-08-24

## Analysis

Level 12 is the Season 1 ice-handling lesson: a wide learning straight leads into increasingly tight bends, eight checkpoint arches, ten optional golden-path crystals, a fast final drop and a landmark ice gate with the ice master beyond it.

The chase camera visually aligned itself to the trail tangent, but the sliding input converted W/stick input as if that un-orbited camera always faced world `−Z`. On a hard bend the road turned in the frame while Barsik continued accelerating toward global north. The free 360° orbit itself worked, yet the promise “forward follows the camera” stopped being true as soon as the underlying path turned.

The eighth checkpoint at `t = 0.93` immediately changed the phase to `outro`; the level therefore completed seven percent of the route before Barsik entered the large ice gate that the HUD and composition presented as the finish. The custom sliding integrator also wrote hero coordinates directly and bypassed the shared collider resolver.

Ice retention was multiplied by a fixed value once per rendered frame. A high-refresh phone therefore lost momentum more often than a 60 Hz device. The same custom vertical settle also pulled Barsik toward the terrain while the shared jump system applied its ballistic arc, crushing touch/Space jumps.

The guide arrow always chose the first uncollected crystal, including one already passed behind the player. The ordinary chase camera remained underneath the five-metre gate after completion, leaving a visually noisy result frame.

The 390×844/medium baseline contained 190 renderables, 85 shadow casters, 162,920 scene triangles, 144 scene geometries and 135 renderer calls. Eight arches used 24 separate meshes/geometries. Ten small imported crystals drew 33,060 triangles, ten calls and four texture channels even though each read as a small faceted pickup from the gameplay camera.

## Plan and player contract

- Build the sliding basis from the same trail tangent used by the chase camera, then apply the player's unrestricted orbit angle.
- Preserve the authored 60 Hz ice response with an exact time-based exponential integrator.
- Route custom movement through the shared collider resolver and dissipate stored velocity when a visible body blocks the candidate step.
- Make the last checkpoint announce a dedicated final sprint; award completion only inside the centre of the actual gate.
- Let the shared jump system own vertical motion and keep the guide arrow on route targets ahead of the player.
- Instance repeated checkpoint geometry and replace tiny high-poly crystal clones with one clearcoat faceted instance set.
- Remove only low-value background, sign, arch and pickup shadows; preserve focal character/landmark lighting.
- Compose the outro from just beyond the gate looking back along the travelled ice ribbon.

Risks: rotating input into the trail basis can over-steer on short spline segments, a strict gate test can make the finish frustrating, and instancing can break per-pickup state. The camera uses the same `t + 0.03` preview tangent for both framing and input; the finish accepts the visible central `1.05 m` half-width; each crystal retains independent logical position, bob, rotation and collected state while only its draw data is shared.

## Patch

Only `src/three/scenes/Level12Scene.ts` changes:

- `cameraTrailDirection()` composes local input from trail-forward, trail-right and free camera yaw.
- the ice response uses exact exponential retention with the same 60 Hz steady-state speed at 30/60/120 Hz;
- every sliding candidate passes through `resolveCollisions()` and blocked momentum is dissipated;
- jump height is no longer simultaneously pulled toward terrain;
- a `finish` act separates the eighth arch from a central gate crossing at `t ≥ 0.992`;
- stale behind-the-player crystals are ignored by the guide arrow;
- 16 arch posts and eight beams become two static instanced draws;
- ten 3306-triangle imported pickups become one 80-triangle dynamic faceted instance draw with individual collection state;
- background winter roots, the entrance sign, arches and emissive pickups stop casting low-value shadows;
- a reverse outro camera uses the travelled ribbon as the leading line instead of framing boundary geometry.

No BaseLevel, shared UI, reward persistence, save-data, asset-file or production-deployment changes.

## Measurements

Representative 390×844/medium samples:

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 190 | 159 |
| Shadow casters | 85 | 31 |
| Scene triangles | 162,920 | 130,174 |
| Scene unique geometries | 144 | 122 |
| Renderer calls | 135 | 102 |
| Renderer triangles | 149,334 | 116,138 |
| Renderer geometries | 129 | 106 |
| Referenced textures | 27 | 23 |

The scene removes 31 renderables, 54 shadow casters, 32,746 authored triangles and 22 unique geometries. The representative frame removes 33 calls and 33,196 rendered triangles. All eight arches and ten pickups remain at their authored route coordinates.

The time-based retention check ran the same three-second constant-input response at 30/60/120 Hz. Final velocity was `0.72889` in all three simulations; integrated distance was `2.13680 / 2.13133 / 2.12844 m`, a sub-0.4% integration spread instead of refresh-rate-dependent handling.

## QA route

Desktop 1440×900, ordinary mouse/WASD input:

1. Finish the three-beat intro, drag the canvas and confirm unrestricted orbit changes yaw by `1.291 rad`; physically drag back rather than resetting state.
2. Deliberately steer across the visible rail and confirm a visible slip/reset returns Barsik to the last arch rather than meeting invisible glass or restarting the whole level.
3. On the hard drop bend at `t = 0.667`, release the correction input and press only W; confirm displacement aligns with the visible camera/trail forward vector (`alignment = 1.000`).
4. Take every lateral crystal and pass all eight arches with normal keyboard input.
5. Confirm the eighth arch enters the final-sprint act rather than opening the result screen.
6. Slide through the centre of the landmark gate and confirm `outro` only at `t = 0.992`, lateral `0.094`, with 8/8 arches, 10/10 crystals and 46 gameplay stars.

Full golden-route result: passed in 198.54 s with zero console/page errors and no direct gameplay-state mutation. A separate staged camera-only snapshot verified the final composition after the physical route had already proven progression.

Mobile 390×844/low adaptive profile, physical CDP touch input:

1. Confirm the joystick is 101×101 px with a 16 px left inset and jump is 78×78 px with a 20 px right inset.
2. Swipe the canvas and confirm yaw changes by `0.664 rad`, then physically swipe back.
3. Tap jump, confirm a `0.693 m` rise and wait for a real landing before moving.
4. Use only the visible joystick to collect all ten crystals and cross all eight checkpoint arches.
5. Enter the centre of the real gate and confirm `outro` at `t = 0.992`, lateral `0.090`, 10/10 crystals and 46 gameplay stars.
6. Inspect the portrait result frame: controls are gone, copy fits, the gate frames the foreground and the travelled ribbon remains readable behind the modal.

Result: passed in 221.93 s with zero console/page errors and no direct gameplay-state mutation.

## Acceptance

- W/stick forward follows the visible camera direction on every bend and after a full orbit.
- Ice response is stable across refresh rates and retains its progressively stronger inertia.
- Visible rails communicate the slip boundary; custom sliding no longer bypasses scene colliders.
- Jump works as a complete airborne/landing arc on desktop and touch.
- The final checkpoint cannot complete the level before the actual ice gate.
- All checkpoints/crystals preserve their route, state, animation and rewards after instancing.
- The guide arrow never asks the child to reverse for an already missed bonus.
- The final frame has deliberate foreground/midground/background composition.
- Desktop and mobile golden routes complete through normal player input with no browser errors.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
