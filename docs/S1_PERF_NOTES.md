# S1 Perf notes — render quality tiers

Scope: `src/three/renderQuality.ts` + the renderer/shadow setup in
`src/three/scenes/BaseLevelScene.ts`. No level scenes were touched — this is
about the caps every level inherits, not any one level's content.

## What changed

**Auto low-tier for weak phones.** `resolveRenderQualityTier` previously only
had two buckets: `medium` for any mobile device, `high` for everything else.
A budget Android phone (the common case for this audience) got the same
`medium` profile as a mid-range one. It now also checks `navigator.deviceMemory`
(≤3 GB) and `navigator.hardwareConcurrency` (≤4 cores) — mobile-only, since
plenty of desktops/laptops report 4 cores too and aren't the target. A weak
phone now lands on `low` without needing the `?quality=low` URL override.

**`antialias` moved into the profile.** The renderer used to hardcode
`antialias: true` regardless of tier. On `low` tier the post-processing
composer is already off (see `useComposer`), so renderer-level MSAA was the
*only* AA being paid for — and it's one of the more expensive fixed GPU costs
on a weak mobile tile renderer. `low` now builds the `WebGLRenderer` with
`antialias: false`. `medium`/`high` are unchanged (`true`).

**`shadowSoft` moved into the profile.** Shadow map *type* was hardcoded to
`PCFSoftShadowMap` (5×5 poisson-disk sampling per shadowed fragment) for every
tier — only `shadowMapSize` scaled down before. `low` now uses `PCFShadowMap`
(single/few-tap), `medium`/`high` keep `PCFSoftShadowMap`. Shadows stay on and
still visually read as shadows (per the "no `setupGround`, no ambient light"
lighting-rig rules in the project `CLAUDE.md`) — this only cuts the per-pixel
sampling cost on the tier that's already visually reduced everywhere else.

## Why not more

Grass/firefly instance counts (`setupWindGrass`, `setupFireflies`) are already
gated by `isMobile` in `BaseLevelScene`, but several individual levels
(`Level4Scene`, `Level5Scene`, hub scenes) pass their own hardcoded
mobile/desktop counts at the call site rather than using the `BaseLevelScene`
default. Tuning those is level content, not a shared cap, so it's out of
scope here (see "avoid redesigning levels"). If a future perf pass wants to
chase this, the fix is to have those call sites read `this.renderQuality.tier`
instead of `this.isMobile` — same shape as the changes in this pass, just at
each level's `setupWindGrass({ count: ... })` call.

`CityScene.ts` and `AvatarPreview.ts` build their own `WebGLRenderer`
directly and never route through `renderQuality` at all — also out of scope
for this pass (task scope was `renderQuality.ts` + `BaseLevelScene`).

## How to check

```bash
# Force a tier regardless of device detection
http://localhost:5173/?mission=1&quality=low
http://localhost:5173/?mission=1&quality=medium
http://localhost:5173/?mission=1&quality=high

# Log avg/p5 FPS over rolling 10s windows to the console
http://localhost:5173/?mission=1&fps=1
```

`?quality=` always wins over device auto-detection (see
`resolveRenderQualityTier`), so it's the fast way to A/B a tier on any one
device without spoofing `navigator.deviceMemory`.
