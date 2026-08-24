# ADR 034: Level 2 honest orchard boundary and render budget

Date: 2026-08-24

## Analysis

Level 2 is the apple-orchard lesson. The player meets the gardener, watches one sorting demonstration, sorts six colour/pattern apples, opens the western head gate, removes three increasingly heavy channel blockages, follows the returning water to the oldest apple tree, takes its golden apple and delivers it to the gardener.

The scene already had a visible circular forest boundary, but movement was clamped first by a smaller `x = -20..20`, `z = -27.5..8` rectangle. A ten-second ordinary `D` input stopped Barsik at `x = 20`, leaving `4.815 m` of visibly open ground before the forest ring. The southern clamp also cut across the flower-led approach to the old oak at `z = -31`. This made the level's geometry contradict its camera and landmarks.

All three channel blockages were visually substantial but physically transparent. Trees, baskets, the gardener and gate beside them were solid, yet Barsik could walk through the branch, leaf plug and rock that supposedly stopped the water. The old oak itself had no collider. Apple bobbing accumulated a sine delta every frame, making pickup height dependent on frame cadence rather than on the authored grounded pose.

The 390×844/medium baseline contained 357 renderables, 63 shadow casters, 258 scene geometries and 289 renderer calls. Twenty-two static path/oak tulips were already compatible with the shared static merge seam. Thin animated reeds and a small imported 15.6k-triangle entrance sign also cast low-value shadows.

## Plan and player contract

- Make the visible circular treeline the only player-facing boundary; retain only a broad numeric safety guard outside it.
- Keep the old oak inside the reachable orchard and give its visible trunk a physical collider.
- Give each active channel blockage a collider sized to its silhouette, move the heavy-rock collider with its intermediate pushes and remove each collider immediately when that obstacle clears.
- Evaluate every apple's bob from a stored grounded `baseY` so animation is bounded and frame-rate independent.
- Merge the 22 static tulips without changing placement, colour or shared-material ownership.
- Remove shadow casting only from thin reeds and the small imported entrance sign; preserve receiving shadows, orchard focal trees, gameplay objects and hero shadows.

Risks: adding four honest colliders can expose overly tight approach radii, while removing a cleared collider too late would leave an invisible obstruction behind the departing mesh. Each blockage radius therefore remains within the existing `2.4 m` interaction range and is removed in the same synchronous success branch that marks the blockage cleared. The old oak gets a matching reservation before random scatter so a background tree cannot close its approach.

## Patch

Only `src/three/scenes/Level2Scene.ts` changes:

- `ApplePickup.baseY` records the final seated pose and drives a bounded ±`0.035 m` bob.
- `OLD_OAK` becomes the shared landmark/collider coordinate and is reserved before random placement.
- Every `Blockage` owns its active circular collider; intermediate rock pushes update both visual and physics coordinates, and successful removal splices that exact collider.
- The broad `-40..40`, `-40..24` numeric guard sits outside `playArena`; the visible forest enclosure now determines the reachable edge.
- Twenty path tulips plus two oak tulips are baked through `mergeStatic()`. Only their private temporary geometries are disposed after merge; the shared flower material remains alive.
- Reeds and the imported entrance sign stop casting shadows but remain visible and continue receiving the scene lighting.

No BaseLevel, global input, HUD, reward, asset, save-data or production-deployment code changes.

## Measurements

Representative 390×844/medium samples:

| Metric | Before | After |
| --- | ---: | ---: |
| Scene renderables | 357 | 336 |
| Shadow casters | 63 | 52 |
| Scene unique geometries | 258 | 237 |
| Renderer calls | 289 | 265 |
| Renderer triangles | 145,576 | 146,848 |
| Renderer geometries | 216 | 195 |
| Referenced textures | 24 | 24 |

The stable structural wins are 21 fewer renderables, 11 fewer casters and 21 fewer GPU geometries. Renderer calls fell by 24. The 1,272-triangle sample increase is random enclosure/scatter variance rather than new authored density: all 22 flowers remain in the scene and are now counted as one merged geometry; no decorative object was added for the optimization.

## QA route

Desktop 1440×900, ordinary mouse/WASD/Shift/E input:

1. Drag the canvas and press only `W`; confirm the movement vector aligns with the rotated camera (`alignment = 1.000`).
2. Approach the gardener and complete the visible sorting demonstration.
3. Pick up the first red apple, intentionally try the yellow basket and confirm the apple stays carried while the pattern-count correction appears.
4. Sort all six required apples and confirm the second act starts with three stars.
5. Open the head gate and confirm the first water leg becomes visible.
6. Walk directly into each visible blockage before interacting; confirm its collider holds. Clear them with the authored 1/1/3 pushes and confirm the collider disappears with each cleared mesh.
7. Follow the water, take the golden apple, cross the former `z = -27.5` invisible clamp and walk into the old oak; confirm the reachable trunk remains solid at `1.65 m` centre distance.
8. Return to the gardener and confirm `outro`, 6/6 sorted apples, 3/3 cleared blockages and eight gameplay stars.

Result: passed in 81.72 s with zero console/page errors and no direct gameplay-state mutation. Apple height stayed within `0.035 m` of its grounded base. The boundary probe changed from a `4.815 m` invisible gap to exactly `0 m` at the visible arena radius.

Mobile 390×844/low adaptive profile, physical CDP touch input:

1. Confirm the visible joystick is 101×101 px with a 16 px left inset.
2. Swipe the canvas and confirm free orbit changes yaw by `0.668 rad`.
3. Drive to the gardener with the joystick and start the demonstration with the contextual paw.
4. Pick up the first red apple, try the wrong yellow basket, retain the apple, then sort it into red using joystick/paw only.
5. Confirm contextual action targets remain at least 123×55 px and the first learning loop reaches `sorted = 1` without browser errors.

Result: passed in 19.10 s with zero console/page errors. Medium-profile render measurements were run separately from the low-end functional route.

## Acceptance

- The orchard has one visible movement boundary and no objective/landmark is cut off by an earlier rectangle.
- The old oak and all active water blockages are physically honest; cleared blockages never leave invisible colliders.
- Sorting, incorrect-match teaching, water progression, gift delivery and all rewards complete using normal player input.
- Apple bobbing is bounded and frame-rate independent.
- Static flower/shadow work is reduced without deleting orchard colour or focal shadows.
- Desktop and mobile camera-relative controls remain unrestricted and adaptive controls remain usable.
- Type-check, lint, production build and diff checks pass.
- No production deploy is part of this package.
