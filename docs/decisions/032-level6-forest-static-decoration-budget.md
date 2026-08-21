# ADR 032: Level 6 forest and static-decoration budget

Date: 2026-08-21

## Analysis

Level 6 is the forest-riddle level. The player starts on the southern trail, collects three coloured clues around the clearing, returns to the talking stump and solves three observation riddles by visiting the red, yellow and green landmark trees. A wrong answer costs no stars but requires a visible return trip to the stump before the tree choices become active again.

The 390×844/medium baseline was the heaviest remaining non-winter scene after the earlier Season 1 packages: 410 renderables, 152 shadow casters and 234 renderer geometries. Ownership inspection found 99 casters in the random `loadTrees`/`loadProps` background scatter. It also found 26 static procedural bushes and 14 static tulips, each already using a family-wide shared material but still owning and drawing a separate geometry.

## Plan and player contract

- Preserve all forest objects, tree/nest/animal colliders, clue positions, stump logic, riddle answers, rewards, camera input and route reservations.
- Merge the 26 bushes into one static mesh and the 14 tulips into another, retaining their baked positions, rotations and vertex colours.
- Disable `castShadow` only for the distant random forest/ground scatter; retain receiving shadows and all authored/hero/landmark shadows.

Risks: disposing a family-wide material would break other levels; globally disabling shadows would flatten the riddle landmarks. The patch therefore disposes only the short-lived source geometries and uses a child-ownership boundary around the two random loaders.

## Patch

Only `src/three/scenes/Level6Scene.ts` changes:

- `addStaticDecorationBatch` uses the existing `mergeStatic` seam and disposes source geometry only after a successful merge. Shared `BUSH_MAT`/`FLOWER_MAT` ownership remains unchanged.
- The child index immediately before `loadTrees`/`loadProps` defines the exact distant-decoration ownership boundary; only meshes appended inside that boundary stop casting shadows.

No BaseLevel, input, physics, UI, asset or reward code changes.

## Measurements

Representative 390×844/medium samples (random forest placement produces small per-load texture/triangle variance):

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 410 | 372 |
| Shadow casters | 152 | 53 |
| Renderer calls | 221 | 86 |
| Renderer triangles | 127,816 | 95,312 |
| Renderer geometries | 234 | 143 |
| Scene unique geometries | 291 | 253 |
| Referenced textures | 38 | 38 |

The large call/triangle reduction includes the shadow pass: 99 distant casters no longer re-render into the shadow map. No visible forest object or gameplay mesh was removed.

## QA route

Desktop 1440×900, ordinary WASD/E input:

1. Complete the intro and collect all three clues by physically walking to their markers.
2. Approach the red tree during riddle 1 and continue holding toward its trunk; confirm the visible collider stops Barsik at `1.95 m` from the centre.
3. Intentionally choose that wrong tree; confirm `wrongAttempts=1`, no star loss and every tree becomes inactive.
4. Walk back to the visible stump and press E; confirm the same riddle is re-asked and trees reactivate.
5. Solve the landmark riddles in world-authored order: green/tallest, yellow/nests, red/hedgehog.
6. Confirm all three clue states, all three riddle states, 22 stars and the outro.

Result on the final source: passed in 71.02 s with zero console/page errors. The full route remains physically reachable and the wrong-answer recovery contract works.

Mobile 390×844, actual touch input:

1. Swipe the canvas (`0.60 rad`) and drive 20.3 m to the first clue with the visible joystick.
2. Collect it with the contextual paw button and confirm `cluesDone=1`/two stars.
3. Rotate through four camera quarters (`7.56 rad`) beside the landmark tree and confirm free 360° input remains active.
4. Inspect the route and navigable ground from each quarter. A generic close-object camera resolver remains a separate shared-camera task; this package deliberately adds no Level 6-only render mutation.

Result: zero console/page errors; joystick 101×101 px with 16 px left inset, action 124×55 px.

## Acceptance

- The complete level route and wrong-answer recovery pass using normal player input.
- Riddle landmarks, nests, hedgehog, clues and stump keep their authored shadows and interactions.
- No random distant scatter object adds a private shadow-map draw.
- Valid 360° camera input remains unrestricted and the physical route stays readable.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
