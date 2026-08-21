# ADR 024 — Level 5 static route batching

- Status: accepted
- Date: 2026-08-21
- Scope: shared opt-in trail batching; Level 5 breadcrumb nuts and route flowers

## Player problem

Level 5 already has a complete five-minute shape: meet the squirrel, follow
her with the basket, collect the spilled nuts, clear stone and root blockages,
swap roles, hear three short story beats and reach the burrow. Its readable
stone path, nut crumbs and flowers are deliberate navigation language, not
filler to delete.

The mobile Season 1 sweep nevertheless found the level's start to be the draw
call outlier: 364–420 calls in fresh 390×844 medium-quality runs. A scene audit
found 607 renderable objects. About 150 of them were the child meshes of 59
small path-stone GLBs; another 51 breadcrumb nuts and 26 flowers were submitted
individually. Most are static, unshadowed and visually identical from frame to
frame, so the CPU paid for object submission rather than useful detail.

## Decision

1. Add an explicit `batchStatic` option to `BaseLevelScene.layTrail`. The
   default is `false`, so every other level keeps its current culling and
   ownership behaviour.
2. When enabled, group path child meshes only when they share exactly the same
   geometry and material set. Bake their world transforms into one
   `InstancedMesh` per group. Keep all model variants, positions, scales,
   materials and receive-shadow flags.
3. Draw the decorative breadcrumb route as one 51-instance mesh and ground
   every instance with the authored terrain sampler.
4. Merge the 26 route flowers with the existing safe `mergeStatic` helper.
   Their per-vertex colours preserve the four-colour rhythm.
5. Do not change quest state, pickup nuts, squirrel navigation, interaction
   ranges, collisions, camera, controls, route density or phase timing.

Cached AssetKit geometry and materials remain owned by the kit; the batching
path does not dispose them. The new breadcrumb and merged-flower geometry is
scene-owned and is disposed with the scene.

## Measured result

One before/after audit used the same 390×844 medium-quality start and inspection
script. Asynchronous ambient assets make individual frames vary, so the Season
1 sweep range is also retained rather than presenting one lucky sample.

| Mobile Level 5 start | Draw calls | Triangles | Geometries | Textures |
| --- | ---: | ---: | ---: | ---: |
| Before, detailed audit | 364 | 124,457 | 237 | 27 |
| Before, full-season sweep | 420 | 141,347 | 260 | 31 |
| After, detailed audit | 180 | 129,853 | 180 | 27 |
| After, route samples | 114–186 | 118,468–141,396 | 178–185 | 27–31 |

The whole trail now consists of eight batches containing all 155 original child
mesh instances. Breadcrumbs remain 51 instances. The conservative cost is that
an entire tiny stone batch can survive frustum culling when only part of the
route is visible; the measured triangle range remains below the 180k normal
phone guard, while draw submission is reduced by roughly half.

## QA route

1. On a 390×844 touch viewport, start Level 5 and verify the stone trail,
   breadcrumb nuts, four flower colours, squirrel and first blockage are
   readable and no touch control overlaps the route.
2. Inspect dev starts at the stone blockage (`z=-16`), root blockage (`z=-29`),
   story route (`z=-52`) and burrow approach (`z=-68`). The trail must remain
   visible at both ends; this catches a bad instanced bounding volume.
3. Send real touch-stick and desktop keyboard input after the intro and verify
   movement is accepted with no page or console error. This render-only patch
   does not claim a full Level 5 gameplay certification.
4. Verify the scene contains eight named trail batches totalling 155 instances
   and one 51-instance `nut-breadcrumbs` mesh.
5. Run type-check, lint, production build and `git diff --check`; restore
   generated `dist` before commit.
