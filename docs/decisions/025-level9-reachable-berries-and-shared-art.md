# ADR 025 — Level 9 reachable berries and shared pickup art

- Status: accepted
- Date: 2026-08-21
- Scope: Level 9 berry routes, pickup state and static rendering

## Player problem

Level 9 is the Fruit Forest finale: collect berries, trade three berries to
each of three guardians, copy the three seal symbols at the chest and use the
acorn key earned in Level 5. The quest requires nine berries and places twelve
so a child may miss three.

The visible level and the movement level did not agree. `pathCorridor` plus the
disconnected shrine rooms accepted only three berry centres unchanged. For the
other nine, `clampToPlayArea` displaced the closest legal point by 2.2–6.6 m,
outside the 1.9 m pickup radius. The arrow could point at a berry while an
invisible boundary pushed Barsik away. Because the quest requires nine, the
normal route could not be completed.

The shrine circles themselves were also islands rather than branches of the
route. A normal-input driver collected the first three berries, returned to the
route and then stopped 9.55 m from the first guardian: the room existed, but no
continuous walkable strip reached it.

The authored centre line then ran through the solid chest even though the third
guardian and the final berry cluster live beyond it. The player could improvise
an unmarked detour, but following the visible stone trail stopped at the reward
prop and looked like another invisible boundary.

The same scene independently loaded and parsed the generated berry GLB inside
the twelve-item loop. A fresh phone start held 61 renderer textures and 243
geometries. Picking a berry then hid its entire group, including the bush, so
the environment visibly rewrote itself and left no persistent searched state.

## Decision

1. Connect every berry and shrine to the authored centre route with overlapping
   reserved branch clearings. Reservations are declared before forest dressing
   and the enclosing treeline, so the walkable side path is also free of grass
   clumps, trees and boundary trunks. The main route and outer level bounds
   remain unchanged.
2. Bend the centre route smoothly around the eastern side of the chest between
   `z=-31.5` and `z=-37.5`. The trail stones, movement corridor and forest
   clearance all use the same `routeX`, so the visible route and the legal route
   cannot drift apart. Keep the chest collider solid.
3. Load and fit the berry GLB once per Level 9 scene. Twelve clones share its
   immutable geometry, materials and textures. The existing scene disposer
   deduplicates those resources by identity, so reload/dispose ownership stays
   local to the scene.
4. A pickup hides only the berry model. The bush stays, its magenta active ring
   becomes a smaller muted mint ring, and a textureless cream/mint check badge
   appears above it. The badge billboards and bobs gently; hidden badges cost no
   draw before collection.
5. Use the existing opt-in static batching for the 24-section stone route.
   Merge berry shrubs, ten decorative bushes and eight route flowers by their
   shared materials. Do not remove any decoration.
6. Do not change the three-berries-per-seal economy, extra-berry allowance,
   guardian positions, symbol order, inventory/key gate, input, camera,
   interaction radii, colliders or rewards.

## Measured result

All values are real Chrome/WebGL runs at 390×844, medium quality. Ambient
scatter makes individual triangle and geometry counts vary slightly.

| Level 9 mobile start | Calls | Triangles | Geometries | Textures |
| --- | ---: | ---: | ---: | ---: |
| Before | 256 | 158,333 | 243 | 61 |
| After, repeated starts | 176–192 | 163,397–169,022 | 197–221 | 41 |
| After one picked berry | 193 | 159,873 | 231 | 41 |

The conservative full-trail batch raises the visible triangle range but remains
below the 180k normal-phone guard. One fresh navigation now loads one berry GLB
resource instead of loading it once per pickup. Repeated scene reloads remain at
41 renderer textures, so the shared resources do not accumulate.

Static reachability was sampled at 25 points from the centre route to each of
the twelve berry centres. Every sample has zero displacement after the patch;
nine endpoints were displaced before it. A source-frozen normal-input desktop
run then collected nine berries, completed all three guardian branches and
trades, followed the chest bypass in both directions, verified one wrong-symbol
reset, completed sun→leaf→drop and reached the open-chest outro with zero
console/page errors. The driver only sent keyboard input and read scene state;
it never called a scene/store mutator.

## QA route

1. Load Level 9 at 390×844 medium and 1440×900 high. Verify foreground,
   midground and chest-route depth remain readable and no branch exposes the
   level edge.
2. For all twelve berries, sample the entire horizontal connector from
   `routeX(z)` to the berry and require zero `clampToPlayArea` displacement.
3. Start at the berry at `(7, -2)`, wait for the real quest phase and press the
   visible mobile action button. Require count `0→1`, group still visible,
   fruit hidden, ring mint and scaled to `0.82`, and completion badge visible.
4. Reload Level 9 twice in the same browser context. Require one berry resource
   per fresh navigation, stable 41-texture memory and zero console/page errors.
5. With normal keyboard input only, collect three berries per guardian, walk
   all three side branches, trade 3×3, follow the visible eastern chest bypass,
   deliberately press the wrong drop symbol, then complete sun→leaf→drop and
   require the chest/key payoff. Do not mutate scene state from the test. Final
   evidence: `completedBerries=9`, `sealsDone=3`, `lockFailures=1`,
   `lockDone=3`, `chestOpen=true`, phase `outro`, browser errors `0`.
6. Run type-check, lint, production build and `git diff --check`; restore
   generated `dist` before commit.
