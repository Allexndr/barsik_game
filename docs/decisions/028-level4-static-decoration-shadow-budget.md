# ADR 028 — Level 4 static decoration and shadow budget

## Status

Accepted — 2026-08-21.

## Context

ADR 026 reduced Level 4's bridge rigging submission cost, but a fresh 390×844
scan still found 471 renderables and 290 shadow-casting meshes. Runtime ancestry
showed that the remaining fragmentation did not come from gameplay objects:
each static GLB rock or flower was three separate shadow casters. Bed rocks,
face rocks, lip rocks and 28 flower groups accounted for most of the excess.

The bridge, loose planks, winch, Aya, Barsik and nearby forest silhouettes are
the forms whose moving shadows communicate depth or gameplay. A tiny flower or
a rock seven metres below the player gains no useful readability from its own
shadow-map submission.

## Decision

- Static decorative AssetKit clones are baked by compatible geometry signature
  and shared material after their final world transforms are known.
- The bake clones geometry but never disposes source geometry, materials or
  textures, because those resources belong to the AssetKit cache.
- The repeated cliff blocks become a small shared-material batch that still
  casts a coherent gorge shadow. Gorge-bed, gorge-face, lip, island-detail and
  approach-flower batches receive light and shadows but do not cast into the
  directional shadow map.
- Gameplay objects and the forest keep their existing shadow behaviour.

## Player impact

The gorge keeps the same rocks, flowers, UVs, materials and silhouette. The
phone submits fewer independent objects and shadow casters, reducing CPU and
shadow-pass work during the timed crossing without flattening the bridge or its
characters.

## Verification gates

- Compare mobile and desktop start, island and far-bank frames before/after.
- Record renderables, shadow casters, renderer calls and visible triangles.
- Complete plank collection, repair, five bridge sections, three winch turns,
  Aya's walk-on and outro using normal input.
- Exercise real touch camera, joystick and interaction input at 390×844.
- Pass type-check, lint, production build and diff-check; restore generated
  `dist` before commit.

## Verification evidence

- Mobile scene traversal fell from the reported `545` renderables / `308`
  shadow casters to `374` / `160` while preserving the bridge and gorge
  silhouette. The representative intro frame used `221` renderer calls,
  `66,908` visible triangles, `213` geometries and `18` textures.
- Full 1440×900 keyboard route completed all three planks, repair, five timed
  sections (including the safe stumble path), three winch turns, Aya's walk-on
  and outro with no browser or page errors.
- Real 390×844 touch input rotated the camera by `0.66 rad`, collected a plank
  through the contextual action button and moved Barsik `1.279 m` with the
  joystick. The joystick remained `16 px` from the left and `24 px` from the
  bottom edge.
