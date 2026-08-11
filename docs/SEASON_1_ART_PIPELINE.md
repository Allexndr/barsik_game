# Season 1 Art Pipeline — premium, mobile-first

**Status:** active production contract · 2026-08-11  
**Scope:** Levels 0–16, City, friends, player avatar and the shared UI/3D
boundary. This document is an execution standard; it does not replace the
level-story canon in `docs/CANON_RECONCILIATION.md`.

## 1. The diagnosis

The game does not look unfinished because it lacks a newer renderer or more
polygons. It looks mixed because it combines a capable Three.js foundation
(ACES, quality tiers, instancing, a GPU river, shadows) with prototype-era
art:

| Area | Live implementation | Premium gap |
|---|---|---|
| Barsik | `createBarsikAvatar()` is roughly 55 primitive meshes with pose code | no continuous skinned silhouette, authored garment construction or facial anatomy |
| Ground | `LevelTerrain.ts` has a 28.8k-triangle sculpted grid and vertex colour | no albedo/normal/roughness surface, path or riverbank relationship |
| Grass | one instanced triangle per blade; 5k phone / 14k desktop | lacks layered clumps and ground contact depth |
| Trees and props | excellent instancing but mostly 50–402-triangle flat-colour kits | silhouette/material language is too simple for close hero shots |
| Generated assets | Draco load support exists | no general LOD, KTX2 or Meshopt pipeline; raw high-poly imports are unsafe |

The north star is **soft stylized PBR with authored depth**, not photorealism
and not a denser version of the present primitives. It must feel substantial
and warm to a child while remaining legible on a small phone.

## 2. Character lock: a capable young explorer, not a generic toy

Barsik remains a friendly snow-leopard cub with the recognisable green hoodie,
blue trousers, pale coat and blue eye/marking accents. “More solid” means:

- one continuous, skinned body with a clear head–neck–shoulder silhouette;
- soft cheeks, muzzle and brow that read from a three-quarter camera angle;
- real garment seams, cuffs, hood volume and a backpack/field accessory,
  rather than detached spheres;
- a calm, curious expression: large eyes are welcome, but not oversized
  button eyes or an infantile, helpless pose;
- fur depth baked into normal/roughness/AO maps, never real fur strands;
- an A-pose rig designed for walking, jumping, waving, pointing and dancing.

The user-supplied Tripo reference is useful as a **high-poly look-development
source**. Its viewer reported roughly 1.9 million faces / 984k vertices, so it
must never be placed in `public` or loaded by the game as-is. A raw export is
source material for cleanup, retopology and texture baking only.

### Runtime hero acceptance gate

| Level of detail | Triangle target | Textures | Use |
|---|---:|---|---|
| LOD0 | 25–35k, hard cap 45k | up to 2K during close gameplay | foreground player / wardrobe |
| LOD1 | 9–12k | 1024² atlas | normal gameplay and City |
| LOD2 | 2–4k | 512² atlas | distant or crowded scenes |

Use 45–60 bones, maximum four skin weights per vertex, three material groups
(fur/skin, clothes, eye/accessory) and in-place clips: `Idle`, `Walk`, `Run`,
`Jump`, `Wave`, `Cheer`, `Dance`, `Point`. Initial LOD0 download target is
≤3 MB after compression. These are quality gates to profile against real
phones, not permission to fill every scene to the cap.

## 3. Forest Kit v1: build once, then reuse

Level 0 is the reference location, not a one-off art experiment. It receives
the first approved version of a reusable kit:

| Family | Production requirement |
|---|---|
| Ground | vertex-palette biome material, macro variation, tiled detail normal, trail and wet-bank masks |
| Grass | two dense, wind-driven clump types plus sparse accent flowers; spatial chunks for distance/frustum control |
| Trees | three species, 3 LODs each; foreground 800–1,500 tris, mid 200–500, far 50–150/impostor |
| Rocks/shrubs | four rock silhouettes, three bushes, controlled material roughness and contact shadows |
| Landmarks | yurt, dombra, lantern and felt panels with 6–12k-triangle caps and one or two materials |
| Water | retain the existing low-cost GPU river; improve banks/foam cues before considering heavier water |

Each source asset follows:

```text
high-poly source → cleanup → retopo → UV → bake normal/AO → 3 LODs
→ texture atlas → KTX2/Basis + Draco/Meshopt → GLB audit → integration
```

Draco reduces transfer size only; it does not make an over-dense mesh cheap to
draw. No high-poly generated asset passes integration without the GLB audit.

## 4. Performance contract

| Test profile | Visible triangles | Draw calls | Frame-time goal |
|---|---:|---:|---|
| low phone, 360×800 | ≤90k | ≤110 | p5 FPS ≥30 |
| normal phone, 390×844 | ≤130k | ≤150 | p5 FPS ≥45 |
| desktop/high | ≤220k | ≤220 | p5 FPS ≥55–60 |

Every visual PR records cold-load size, visible triangles, draw calls, texture
count and FPS distribution. Mobile keeps the direct renderer: premium quality
comes from authored light, materials and geometry, not a mandatory expensive
full-screen composer.

## 5. Delivery order

1. **Foundation — now.** Camera/start/HUD correctness, asset quality gates,
   rigged-hero fallback path and Level 0 terrain/grass material pass.
2. **L0 vertical slice.** Approve five screenshots: forest arrival, lanterns,
   river, exterior yurt, interior dombra. Run a full child-flow playtest in
   RU/KK, portrait/landscape and low/medium/high tiers.
3. **Forest rollout.** Reuse the approved kit for L1–L10. Fix the Level 1
   flat-ground legacy path and remove duplicate sky/cloud/firefly setup from
   L2/L3/L10 before adding decoration.
4. **Ice rollout.** Build a separate snow/ice material profile and migrate
   L11–L16. Do not recolour the forest kit and call it winter.
5. **Release gate.** Integrate only tested atomic branches, run the full
   regression matrix, then deploy production with a release log and rollback
   commit identified.

## 6. Asset handoff and ownership

Before an external/generated model is merged, provide or record:

- original `.blend`/source or exported GLB plus the commercial-use licence;
- the exact model version/prompt/reference ownership; no scraped or unclear
  copyrighted game assets;
- an explicit right to derive LODs, bake textures and modify the mesh;
- the intended role, distance and target biome; and
- a preview turntable or screenshots for style approval before integration.

Until an optimised rigged Barsik is handed off, the procedural avatar remains
the safe playable fallback. This avoids a visually prettier but static hero
that slides across the world.

## 7. Collaboration and history

Codex and Claude work in one concern per branch/commit. Every commit includes
**Why**, **User impact**, **Verification** and **Coordination**; every
behaviour/visual-system decision gets a short ADR. Generated `dist`, raw
source exports, credentials and unreviewed assets are never committed. A
preview may be created for each atomic package; production deploys only the
integrated, tested release branch.
