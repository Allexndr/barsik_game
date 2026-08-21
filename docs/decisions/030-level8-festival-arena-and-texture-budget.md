# ADR 030 — Level 8 festival arena and texture budget

## Status

Accepted — 2026-08-21.

## Context

The Season 1 mobile scan found 61 resident GPU textures in Level 8, the
highest mobile texture count in the chapter. Three garland coils and four
mushroom bushes each parsed the same four-map GLB again. Festival props from
the same Kenney families also parsed private copies of byte-identical colour
atlases.

Gameplay QA exposed a more serious fault. The visible stone trail was also
used as the walkable boundary, although the garland trees and fruit patches
sit on both sides of it. The authored objectives were reserved from scatter,
but those disconnected reserved rooms did not make the space between them
walkable. A child following the objective arrow could meet an invisible clamp
before reaching a valid quest object.

## Decision

- Parse the garland and mushroom assets once and place deep clones that share
  their immutable geometry, materials and texture resources.
- Share only the base-colour atlas between known props from the same Kenney
  palette family. Geometry, materials, normal/roughness/emissive data,
  transforms, shadows and visible prop count remain independent.
- Treat the whole festival footprint as one open arena centred on the glade.
  Keep the stone trail as the visual route from spawn, but ring the reachable
  space with three instanced tree rows so the boundary is visible in-world.
- Preserve every objective position, phase transition, collider, reward and
  final composition.

## Player impact

The route now teaches the way to the glade without becoming an invisible
wall. Barsik can walk naturally from the path to all three oaks and all four
fruit patches. Repeated festival art looks unchanged, while the phone keeps
fewer texture resources resident and the arena tree ring uses fewer distant
instances.

## Verification gates

- Complete 5 lanterns, 3 garlands, 4 fruit pickups and deliveries, gathering,
  photograph and outro using only normal desktop movement and interaction.
- Exercise real mobile camera swipe, joystick and contextual action at
  390×844, then inspect at least four positions through a full camera orbit.
- Compare renderer and scene resource counts against the frozen mobile
  baseline; do not claim gains from random decoration variance.
- Pass type-check, lint, production build and diff-check; restore generated
  `dist` before commit.

## Verification evidence

- Frozen 390×844 start: GPU textures fell from 61 to 43 and referenced texture
  objects from 89 to 62. Renderer geometry fell from 212 to 206. The arena
  boundary used 317 instanced placements instead of 454, bringing the sampled
  frame from about 118,916 to 110,050 triangles. Calls remained effectively
  flat at 217; the scene still contains 388 renderables.
- Frozen 1440×900 route passed in 75.52 seconds: 5/5 lanterns, 3/3 garlands,
  four visible pickups, four proximity deliveries, gathering, photograph and
  outro. Final scene state was 43 earned stars with no console or page errors.
- Real 390×844 input rotated the camera by 0.425 rad, moved Barsik 2.708 m with
  the joystick and activated the first lantern with the contextual action.
  Four further orbit samples covered 7.56 rad without canopy occlusion.
- The mobile joystick measured 101.4 px and remained 16 px from the left edge;
  the action target measured 126×56 px.
