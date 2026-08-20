# ADR 023 — Stylized river water from one analytic surface

- Status: accepted
- Date: 2026-08-20
- Scope: `RiverWater`, Level 0 obstacle foam; shared rendering in Levels 0, 1 and 4

## Player problem

The shared river already displaced a coarse plane and coloured it by baked bed
depth, but its visible wave and its lighting were unrelated. The surface read as
a painted translucent sheet. At distance the finest ripple could become noisy.
In Level 0, twelve large foam circles also revealed the stepping-stone route
while the stones were deliberately submerged, weakening both composition and
the lantern unlock beat.

## Decision

Keep the river as one draw call with no textures and no off-screen render pass.
Evaluate the same three-wave analytic field for:

1. vertex height;
2. both height derivatives and therefore the visible normal;
3. crest foam.

Fade the highest-frequency wave between 18 and 42 metres, tint the surface with
a cheap sky Fresnel term and a broad warm glint, and anti-alias shoreline and
obstacle foam with `fwidth`. The existing static terrain sampler remains the
source of depth.

Level 0 now supplies a per-obstacle foam strength. It starts at zero while the
stones are submerged and follows the actual visible stone top as the route rises
or settles. Quest phases, water recovery, colliders and platform heights do not
change.

## Open-source research

No third-party source code or asset is copied by this change. The implementation
is a project-native TypeScript/GLSL rewrite of general rendering methods.

| Project | License | Method considered | BARSIK decision |
| --- | --- | --- | --- |
| [Tidewright](https://github.com/winchxyz/tidewright) | MIT | One analytic wave function for simulation/rendering, shoaling/depth foam, distance-aware detail | Adopt consistency, baked depth and detail fade. Reject its ocean grid, screen refraction, shadow maps and simulation textures for mobile cost. |
| [WaterThreeJS](https://github.com/achrefelouafi/WaterThreeJS) | MIT | Gerstner surface plus a CPU height mirror for floating bodies | Defer CPU mirror until BARSIK has gameplay objects that actually float. Reject the multi-pass reflection/refraction stack. |
| [threejs-water](https://github.com/jeantimex/threejs-water) | MIT | GPU wave-equation simulation, caustics and ray-traced optics | Do not adopt for Season 1: impressive demo, disproportionate render-target and shader cost for a traversal river. |
| [world-light](https://github.com/teuzowebdeveloper9/world-light) | non-commercial project license | Deterministic chunks, fixed-step gameplay and analytical ground height | Methods only; copy no source. Determinism/fixed-step remain separate future gameplay work. |
| [BVHEcctrl](https://github.com/pmndrs/BVHEcctrl) | MIT | BVH character collision and camera obstruction | Benchmark later if custom static colliders become a measurable CPU or camera problem; no engine/controller migration in a water patch. |
| [react-three-npc](https://github.com/ssethsara/react-three-npc) | MIT | Reusable NPC steering/state architecture | Candidate for later City residents, not a dependency for Season 1 river rendering. |

## Performance contract

- zero new textures;
- zero new geometry;
- zero new draw calls;
- no reflection/refraction render target;
- no per-frame vertex-buffer upload;
- maximum three analytic waves; the fine wave fades before sub-pixel shimmer;
- the Level 0 obstacle array remains capped at 16 entries.

The shader does more arithmetic than the previous colour-only fragment, so the
release check is a real 390×844 browser run on Levels 0, 1 and 4. A visually
richer effect is not accepted if the route becomes less readable or if WebGL
reports a shader error.

## QA route

1. Level 0 before lantern three: approach the river and verify that submerged
   stones do not have floating white target rings.
2. Light all lanterns: verify the stones rise and tight foam collars appear only
   where their tops meet the water.
3. Cross all twelve stones: verify collars follow the three settling stones and
   do not change physical support or water recovery.
4. Inspect both banks at portrait-phone and desktop sizes: the shallow band must
   read as a shoreline, not an opaque white sheet.
5. Load Levels 1 and 4: verify the shared material compiles with zero obstacles
   and their existing quest/collision logic is unchanged.
6. Run type-check, lint, production build and diff check; restore generated
   `dist` before commit.

