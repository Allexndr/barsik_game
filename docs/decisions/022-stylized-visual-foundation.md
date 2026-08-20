# ADR 022 — Stylized visual foundation without a heavier render stack

## Status

Accepted for the Season 1 visual pass.

## Context

Season 1 had several independent lighting and environment recipes. Forest
levels could render custom-shader grass nearly white on desktop, winter levels
were ringed by green summer trees, and Level 12's route was a flat grey ribbon.
Level 2 was the largest measured outlier: its first mobile frame redrew a dense
set of imported apples, ambient trees and small shadow casters for roughly
429k triangles and 489 draw calls.

The target is a richer, child-readable frame on phones and desktops, without
adding another post-processing pass or making gameplay geometry more complex.

## Decision

1. `VisualProfiles` is the single source for sky, fog, key/fill/rim light,
   exposure, bloom and grass palette. A level can select a mood without owning
   another render pipeline. Existing per-level overrides remain valid.
2. The sun glow is baked into the existing 512 px sky texture. Cloud puffs are
   merged into one geometry per cloud, reducing five draws to one.
3. Wind grass writes display-space colours only on the direct mobile path and
   linear colours when rendered through the desktop composer. This fixes the
   white desktop field without reintroducing the former black mobile blades.
4. Level 0 selects the warm `dombraGolden` profile and one existing firefly
   point field. It does not add a full-screen effect or another shadow caster.
5. Level 2 selects `orchard`, removes a duplicate sky/cloud/mountain stack,
   merges its path, reduces non-gameplay filler, and replaces eleven
   5.7k–14.8k-triangle imported pickup apples with one-mesh authored apples.
   Their colours, colour-blind bands, halos and interaction state remain.
   Small baskets, pickups, gate pieces and background fillers no longer pay a
   second shadow-map render; four authored orchard trees keep the focal shadow.
6. Winter boundaries use the existing CC0 `holiday/tree-snow-c` model in two
   wider instanced rows. Level 12 selects `iceTrail` and uses one deterministic
   128×256 repeating ice texture plus `MeshPhysicalMaterial`; route geometry,
   collision and slide physics are unchanged.

## Player impact

- Forest grass has a stable green/gold palette on mobile and desktop.
- Level 0 reads as a warm musical journey; Level 2 reads as an orchard instead
  of a forest filled with markers; winter levels no longer end in a green wall.
- Ice has cracks, direction and a glossy edge, so the playable route is legible.
- Critical objects and the hero keep their contrast against the background.

## Measured result

Twenty-frame `renderer.info` samples include the main, shadow and composer
renders. Values vary slightly with asynchronous assets and quest phase.

| Scene / viewport | Before calls / tris | After calls / tris |
| --- | ---: | ---: |
| L0 390×844 medium | 320 / 123,668 | 312 / 121,270 |
| L0 1440×900 high | 354 / 140,547 | 353 / 136,515 |
| L2 390×844 medium | 489 / 429,069 | 349 / 178,107 |
| L2 1440×900 high | 578 / 448,132 | 406 / 201,732 |
| L12 390×844 medium | 209 / 211,510 | 194 / 201,180 |
| L12 1440×900 high | 268 / 223,173 | 252 / 209,685 |

Level 12 adds exactly one local ice-ribbon texture. Profiles and the baked sun
add no draw call. The full mobile L0–L16 mount sweep completed with no console
or page errors.

## Known debt and follow-up

This package does not claim the whole season is at final budget. The same sweep
still identifies L4/L5 as draw-call outliers and L10 as a triangle outlier; L3,
L9, L11/L12 and L16 can cross the normal-phone triangle guard depending on
loaded actors and phase. They require separate, level-owned batching/LOD work,
not a global reduction that silently removes gameplay or scenery.

## QA contract

- Mobile 390×844 medium and desktop 1440×900 high screenshots: L0, L2, L12.
- Mobile winter start screenshots: L11, L14, L16.
- Mobile mount/renderer sweep: L0–L16, zero console/page errors.
- TypeScript, ESLint, production build and `git diff --check` must pass.
- Recheck L2 pickup colour bands and L12 ice route after any material disposal
  or asset-loader changes.
