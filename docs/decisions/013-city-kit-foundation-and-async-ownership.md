# ADR 013 — City Kit foundation and async scene ownership

**Status:** accepted · 2026-08-11
**Scope:** `CityScene` and the shared `AssetKit` lifecycle only.

## Context

The city is a permanent hub, so its zero-friend state is not a temporary
placeholder: it is a new player's first image of the place they will grow.
It was permanently assembled from box, cone and sphere primitives while the
repository already contained a lightweight, compatible City Kit from Kenney.
That kit is CC0; its license lives at
[`public/assets/models/kits/city/LICENSE.txt`](../../public/assets/models/kits/city/LICENSE.txt).

The scene also added a sign, mushroom, rabbit and bee through independent
async helpers on every city entry. Besides spending first-frame work on
non-interactive decoration, the critter helper could attach an old result to a
new world after `setCity()` rebuilt it. A generic `disposeObject()` pass would
also be unsafe for `AssetKit` clones, because clones deliberately share the
template geometry, materials and textures.

## Decision

- The always-present starter town is a deterministic City Kit layout: one
  `building-type-a`, `path-long`, three `tree-small` instances and two
  `planter` instances. Neighbourhood rewards extend that same grammar with
  alternating `building-type-a` / `building-type-b` models at the former
  house-ring positions.
- Each `CityScene` owns one `AssetKit`. Kit clone roots are removed on city
  rebuild without disposing their shared resources; the kit releases its
  template resources once when the City scene itself is disposed.
- `AssetKit` treats disposal as terminal. A GLTF that resolves after disposal
  is released immediately and returns `null`, so a late template cannot leak
  into an unreachable cache or create a late clone.
- All City async additions check both the generation number and their owning
  root before attaching. Stale direct-loaded character and festival props are
  released instead of attached. Resident picking still targets the current
  `residents` array.
- The always-on sign, mushroom, rabbit and bee are removed. They were not a
  city progression reward and were the only nonessential async asset work in
  an empty hub. Earned finale table, presents and flags remain, but only after
  the festival unlock.

## Budget and verification

The source meshes for the starter layout are deliberately tiny: `building-
type-a` is 1,174 triangles, each `tree-small` 42, `path-long` 12 and each
`planter` 204. The whole permanent starter kit is about 1.9k source triangles
before renderer/shadow accounting.

Run `npm run type-check`, `npm run lint`, `npm run build`, and inspect the
0-friend city at 390×844 and 1440×900 with `?tab=city&perf=1`. Rebuild the
scene during in-flight asset loading and confirm only the final generation
remains in `world`; dispose it during a fetch and confirm no late child is
attached. This is a local QA smoke, not a device-performance claim.

## Consequences

The hub keeps its existing friend progression, cards, picking and procedural
Barsik fallback while gaining a coherent asset language from its first visit.
No static `barsik.glb`, raw generated asset or external model service is
loaded by this decision. The asset cache change also makes the same
dispose-during-load path safe for other scenes that already use `AssetKit`.

**2026-08-11 local QA result:** type-check, lint and production build passed.
At 390×844 medium, the completed empty city sampled 146 calls, 36,502
triangles, 75 geometries and 11 textures (avg/p5 70.1/50.8 FPS). At
1440×900 high it sampled 147 calls, 36,517 triangles, 76 geometries and 11
textures (avg/p5 49.3/40.3 FPS). Both count sets are below ADR 009's frame
guards. The latter FPS came from headless Chromium and is therefore recorded
as a composition/count smoke, not as a desktop-device performance pass; run
the desktop p5 check on a hardware browser before calling it a release
benchmark. A forced `setCity([friend]); setCity([])` during loading left only
the current `city-kit-foundation` and avatar roots, zero residents and seven
current kit children, with no application console errors. A separate delayed
City Kit request followed by immediate `dispose()` kept `world.children` at
zero and `kit` at `null` after the requests resolved, again with no application
console errors. With two saved friends, both resident ids stayed live after
the kit loaded and a projected 3D click on `gardener` opened the existing
“Садовник” resident card.
