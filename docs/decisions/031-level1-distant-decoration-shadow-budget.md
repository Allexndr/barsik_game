# ADR 031: Level 1 distant-decoration shadow budget

Date: 2026-08-21

## Analysis

Level 1 (`Mission1Scene`) teaches the player to follow the trail, cross the creek by the bridge, free a fruit with three deliberate interactions, find Aya, give her the fruit and invite her to Barsik's city. The authored bridge, quest bush, Aya clearing and hero all need contact shadows because they carry navigation or interaction meaning.

The mobile baseline at 390×844/medium contained 431 visible renderables and roughly 170 shadow casters. An ownership trace from a representative load counted 174 casters: 126 belonged only to the random distant `loadTrees`/`loadProps` scatter, while the bridge, Aya, quest rock, animals and hero accounted for the useful remainder. Those 126 objects sit around the route at approximately 13–70 metres and are not interactive. Rendering a private shadow-map draw for each one spent GPU work without improving the child's understanding of the route.

## Plan and player contract

- Keep the complete forest composition, materials, receiving shadows and all colliders.
- Disable only `castShadow` on roots added by the two distant scatter loaders.
- Preserve shadow casting for the hero, bridge, Aya, quest rock, animals and other authored foreground objects.
- Do not change input, camera, phase state, rewards, water rules or UI.

Risk: removing too many casters could flatten the forest. The change therefore uses a narrow scene-child ownership boundary around the two loader calls instead of a global traversal or distance heuristic. Before/after mobile captures must remain compositionally equivalent.

## Patch

`src/three/scenes/Mission1Scene.ts` records the scene-child index immediately before `loadTrees` and `loadProps`. Only the roots appended by those calls are traversed, and only their meshes have `castShadow` disabled. They keep `receiveShadow`, so the distant forest remains grounded by the shared lighting and nearby authored shadows.

## QA route and measurements

Representative 390×844/medium measurements (random scatter placement can vary by a few objects between loads):

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 431 | 431 |
| Shadow casters | ~170 | 43 |
| Renderer geometries | 179 | 179 |
| GPU textures | 24 | 24 |
| Sampled triangles | 118,991 | 118,111 |
| Sampled calls | 144 | 147 |

The package is a shadow-pass optimization, not a geometry/draw-call claim; random ambient placement and camera framing explain small per-load call/triangle variance.

Desktop 1440×900, ordinary WASD/E input:

1. Finish the intro and reach both trail phases.
2. Approach the creek beside the bridge and hold forward: the water collider stops the hero (`0.70 m` bounded advance) instead of allowing an invisible shortcut.
3. Return to the visible bridge and cross to the southern bank.
4. Reach the stuck fruit, pull it exactly three times and confirm it moves to the bag/state instead of silently disappearing.
5. Find Aya, complete both dialogue beats, give the fruit, invite her and reach the outro.

Result: full route passed in 30.57 s; `pullCount=3`, final phase `outro`, zero console/page errors, 43 shadow casters.

Mobile 390×844, actual touch input:

1. Swipe the canvas and confirm the look gesture changes yaw (`0.60 rad`).
2. Drive the complete start-to-fruit route with the visible joystick (`30.45 m`).
3. Use the contextual paw button three times; phase advances to `find_aya` with the fruit recorded.
4. Perform four camera quarters and inspect all frames for clipping/occlusion.

Result: orbit delta `7.56 rad`, all four frames readable, zero console/page errors, 43 shadow casters. The joystick remains 101×101 px with a 16 px left inset; the contextual action is 123×55 px.

## Acceptance

- Distant forest remains visually present and receives lighting/shadows.
- No quest, collision, water, reward or route behavior changes.
- Shadow casters stay near the authored/hero set rather than scaling with distant scatter count.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
