# ADR 026 — Level 4 static bridge batching

- Status: accepted
- Date: 2026-08-21
- Scope: Level 4 bridge rigging, lookout railings and entry barrier rendering

## Player problem

Level 4 already has a coherent three-act route: recover three wind-torn boards,
watch them repair the deck, cross five timed sections with a safe island in the
middle, turn the far-bank windlass three times and let Aya cross. A
keyboard-only baseline completed that route without a gameplay failure.

The scene was nevertheless paying prototype-level submission cost for its most
deliberate landmark. Every suspension hanger, hand rope, tower post, cap and
beam was a separate Mesh even though none moves independently. The bridge
rigging alone contributed 74 renderables; the two lookout railings contributed
another 14. At 390×844 medium, the start measured 297 renderer calls and 275
live geometries for only about 64k visible triangles. The bottleneck was object
and shadow submission, not visual complexity.

## Decision

1. Add a Level-4-local `bakeStaticFamily` helper. It applies each private
   procedural part's local matrix, merges the cloned geometries, disposes the
   private source geometries and keeps the shared family material owned by the
   resulting scene mesh. A merge failure safely returns the original parts in
   a group.
2. Bake the suspension bridge into two meshes: one rope family and one timber
   family. The whole result remains under `bridgeGroup`, so the existing
   aggregate sway still moves the same silhouette. Ropes remain non-shadowing;
   the timber family remains one shadow caster.
3. Bake each lookout railing into one timber mesh and the two-strand visible
   entry barrier into one rope mesh. Preserve group transforms and visibility,
   so layout and the repair transition do not change.
4. Do not change bridge geometry, missing sections, board positions, collider
   shapes, movement clamp, safe/unsafe timings, camera, input, rewards, dialogue
   or phase state machine.

## Measured result

Real Chrome/WebGL runs at 390×844, medium quality. Environmental scatter is
random, so triangle and world-object totals vary slightly between loads.

| Level 4 mobile start | Calls | Triangles | Geometries | Textures |
| --- | ---: | ---: | ---: | ---: |
| Before | 297 | 64,053 | 275 | 18 |
| After | 216 | 62,730 | 196 | 18 |

Scene traversal changed from 555 to 468 renderables and from 312 to 295 objects
marked as shadow casters. The before/after phone frames retain the same bridge,
rope, tower and railing silhouettes. No texture or shader was added.

## QA route

1. Compare 390×844 start frames and require the suspension ropes, vertical
   hangers, three tower pairs, two railings and red entry barrier to remain in
   their authored positions.
2. With normal keyboard input only, collect the stream, wind and forest boards;
   require `planksFound=3`, the repair flight and removal of the visible entry
   barrier/collider.
3. Walk the five timed bridge sections, including the island phase and safe
   stumble recovery, then reach the far bank.
4. Approach the windlass and press the real interaction key three times;
   require `winchTurns=3`, Aya's walk-on and phase `outro`.
5. At 390×844 with real touch events, rotate the camera, collect one board with
   the visible action button and move with the joystick. Require non-zero yaw
   and movement, a `0→1` board count, correctly inset controls and zero
   console/page errors.
6. Run type-check, lint, production build and `git diff --check`; restore
   generated `dist` before commit.
