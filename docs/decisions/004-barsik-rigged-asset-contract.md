# ADR 004 — Barsik is a qualified rigged asset or the animated avatar

**Status:** accepted · 2026-08-11

## Context

The shipped `chars/barsik.glb` is an attractive but static asset: the checked
file is 8,086 vertices with one material and four textures, but **zero skins
and zero animation clips**. Moving it through a level makes a statue slide.
The procedural avatar is less final-looking, but it genuinely idles, walks,
runs, jumps and celebrates.

The high-detail Tripo reference shown during art review reports roughly
1.9 million faces / 984 thousand vertices. That is a source-quality preview,
not a browser-mobile game asset: it would consume the hero's whole frame and
memory budget before the level, HUD or other characters render.

## Decision

- The runtime probes only `public/assets/models/chars/barsik_rigged.glb`.
  It never auto-loads `barsik.glb`, `hero_placeholder.glb`, or any static
  character as the player hero.
- Default (`?hero` absent) attempts that named rigged asset once, then falls
  back to the procedural animated avatar if it is missing or rejected.
  `?hero=avatar` forces the control avatar. `?hero=glb` and `?hero=rigged`
  are QA aliases that exercise the same *rigged-only* path; they still fall
  back safely when the gate rejects the file.
- The loaded asset must pass the runtime gate: 1,000–80,000 vertices,
  1,000–120,000 triangles, at most 8 meshes / 4 PBR materials / 8 textures,
  at least one skinned mesh with 12+ bones, an applied base-colour texture,
  2,048px-or-smaller loaded images, and meaningful named idle plus walk/run
  clips. Rejection is fail-closed and releases the loaded scene.

## Asset handoff checklist

1. Deliver **one licensed, upright, forward-facing GLB** named
   `barsik_rigged.glb`; do not overwrite `barsik.glb`. Confirm ownership or a
   redistribution licence for every source texture.
2. Retopologize the generator output before export. Target LOD0 at 20–45k
   triangles (the runtime limit is a safety ceiling, not an art target),
   1–3 materials and 1024px texture atlases. Prepare 8–18k and 3–8k triangle
   LODs for the later distance/quality pass; this release does not pretend to
   support a KTX2-only asset.
3. Include a skinned humanoid-compatible rig and clips named `Idle`, `Walk`,
   `Run`, `Jump`, and `Cheer` (the current gate uses Idle + Walk/Run; the
   other clips stop the next gameplay pass from needing a re-export).
4. Before committing the binary, run
   `node scripts/probe-glb.mjs public/assets/models/chars/barsik_rigged.glb`.
   Then test `?mission=0&hero=glb` on a 390×844 phone viewport and desktop:
   no T-pose, no sliding, no texture loss, stable idle/walk transition, and
   no material/console errors.

## Consequences

The avatar remains the honest, playable fallback until an art-ready asset is
actually handed over. A raw high-poly export cannot silently make the game
slower or replace Barsik because its filename happens to resemble the hero.
