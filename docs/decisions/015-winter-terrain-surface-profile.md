# ADR 015 — Winter terrain surface profile

**Status:** accepted · 2026-08-11
**Scope:** sculpted snow/ice terrain in Levels 11–16 and the Level 12 ice
ribbon. Forest terrain, Level 0 and site/HUD work are explicitly out of scope.

## Context

Ice Valley had sculpted height fields, snow lighting and holiday props, but
its terrain material was still almost entirely a vertex-colour plane:
`roughness: 0.94` for snow and no close-range surface grain. It therefore
read as a flat pale sheet against the sky. Level 12 made the problem more
visible: the actual sliding ribbon used one untextured, highly metallic,
transparent material, so it read grey rather than as intentional ice.

The fix must not turn winter polish into an asset-download, geometry or
post-process project. Several Winter scenes are already close to their
whole-renderer mobile budget.

## Decision

1. `setupWinterEnvironment()` opts every sculpted Winter terrain into one
   seeded, locally generated **256×256 CanvasTexture**. It is a colour map on
   the existing material, not a new mesh or render pass.
2. Snow maps contain pale packed-snow micrograin; ice maps contain soft
   streaks and sparse blue crack accents. Both use repeat wrapping and
   anisotropy `2`, make no network request, and have no per-frame update.
3. The existing terrain vertex-colour loop gains a subtle Winter profile:
   blue-shadow macro pockets, restrained wind-packed highlights, and a
   snow/ice-specific corridor shoulder. This is baked at terrain creation and
   does not alter the height sampler.
4. Snow is intentionally diffuse (`roughness: 0.90`). Ice uses a small
   dielectric-style metalness value (`0.06`) and a less chrome-like
   roughness (`0.34`). The curved L12 ribbon gets its own one-time 256 px ice
   map, `roughness: 0.24`, and the same non-metallic treatment.
5. The Level 12 change is material-only. Its existing `yOffset: 0.07`, trail
   height sampler, checkpoint positions, collectible coordinates, collider
   rules and gameplay zones remain untouched, preserving authored `y=0`
   gameplay semantics.
6. `LevelTerrain.dispose()` disposes the terrain map. The Level 12 map lives
   on the trail material and is disposed by the existing scene-resource
   disposal path. No texture persists across a mission unload.

## Consequences

- Winter horizons gain close-up material information and broad cool pockets
  without changing any Forest or Level 0 ground code.
- The shared path profile now gives a readable packed centre and pale shoulder
  wherever a Winter level defines a corridor; open arenas still retain their
  blue-shadow surface variation.
- L12's route is visually distinct from its snow valley without adding a
  geometry layer or altering its sliding physics.
- Each regular Winter terrain adds one small local map. L12 adds a second map
  only for its separate ribbon material. This is a bounded, auditable texture
  cost rather than an unbounded decal system.

## Performance evidence

`?perf=1` snapshots used the local QA host after the scene had been active for
at least ten seconds. They are renderer-counter smoke tests, not phone FPS
claims.

| Scene / view | Calls | Triangles | Geometries | Textures | Result |
|---|---:|---:|---:|---:|---|
| L12 baseline, 390×844 medium | 180 | 182,984 | 120 | 24 | Existing normal-phone triangle breach |
| L12 candidate, 390×844 medium | 179 | 182,496 | 120 | 26 | No mesh/call/triangle increase; exactly +2 local maps |
| L13 candidate, 390×844 medium | 169 | 176,834 | 109 | 36 | Inside the 180k normal-phone triangle guard |
| L12 candidate, 1440×900 high | 235 | 194,057 | 131 | 39 | Inside the 260k desktop triangle guard |

The L12 normal-phone level was already 2,984 triangles above the ADR 009
180k guard before this surface package. This change does **not** resolve that
separate release-review risk; it slightly lowers the sampled geometry count
and adds only the two expected material textures. Future L12 asset/scene work
must bring the full renderer below the guard instead of raising the limit.

## Verification

- `npm run type-check`
- `npm run lint`
- `git diff --check`
- Local mission smoke at **390×844**: Levels 11, 12, 14 and 16 entered
  successfully, rendered a canvas and reported no console errors. Fresh
  screenshots were saved for all four levels.
- Local **1440×900** Level 12 screenshot and `?perf=1` sample verified the
  curved ice ribbon, material contrast and desktop renderer counters.
- Local **390×844** `?perf=1` samples covered L12 and the high-risk L13.

## Follow-up

Keep any future Winter texture at or below 256 px unless a measured device
review justifies more. Treat L12's existing normal-phone triangle breach as a
separate optimisation task; do not compensate with blur, a full-screen
composer pass or a higher budget.
