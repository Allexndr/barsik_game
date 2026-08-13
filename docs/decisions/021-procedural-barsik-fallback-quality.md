# ADR 021 — Procedural Barsik remains a small, expressive fallback

**Status:** accepted · 2026-08-13

## Context

ADR 004 correctly rejects the shipped static `barsik.glb`: a sliding statue is
not a playable hero. The animated procedural fallback preserved gameplay, but
the shipped close-up read was still too primitive. Barsik had a round bauble
head, narrow capsule body and limbs, tiny ears, button-like blue eyes, flat
clothes and a tail that often disappeared behind him. More importantly, the
wardrobe multiplied an already green fabric map by green material colour,
turning the signature hoodie dark and muddy.

The fallback is shared by every level derived from `BaseLevelScene`, City and
Avatar Preview, so a quality pass must remain small enough for the primary
390×844 phone target and must not change the hero loader contract.

## Decision

- Keep `createBarsikAvatar()` as the honest animated fallback behind the ADR
  004 rigged-asset gate. Do not auto-release a static or unqualified GLB.
- Improve only its existing procedural rig: a flatter, wider snow-leopard
  skull, lower rounded ears, broader hoodie/limbs, shaped shoes, richer muzzle,
  warmer eyes, readable tail and garment construction.
- Use neutral cached weave maps and material colour for wardrobe recolours.
  Shared `furMaps()` / `fabricMap()` textures are never disposed by an avatar;
  only the avatar-owned tiled coat clones are released.
- Add one one-draw-call embroidered paw badge and a low-cost blink. Correct the
  mirrored raised-arm signs so jump, wave, cheer and point remain visible from
  the gameplay camera.
- Hold the naked fallback at approximately 60 meshes / 16.3k triangles. This
  is a small bridge asset, not permission to grow procedural geometry toward a
  production character.

## Consequences

Barsik reads more clearly as a snow-leopard child at both preview and gameplay
distance, and hoodie colour variants no longer collapse into dark fabric. The
same public avatar/fallback API, equipment sockets and named poses remain
available to all existing callers.

This does **not** close the final hero-art requirement. The production target
is still a licensed, retopologised, textured, upright `barsik_rigged.glb` with
the clips and runtime limits defined by ADR 004.
