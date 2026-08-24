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

## Update 2026-08-24: tier-scaled shadow caster cutoff + firefly count

Two follow-ups from the `Ideas` queue, both `renderQuality.ts` +
`BaseLevelScene.ts` only, no level scenes touched.

**`shadowCasterMinHeight` joined the profile.** `demoteSmallShadowCasters`
(shadow-pass triangle/draw-call cutter, see its docstring for the L6
measurement — 47% of the frame was shadow-pass casters) used a hardcoded
`SHADOW_CASTER_MIN_HEIGHT = 0.5` for every tier. It's now
`this.renderQuality.shadowCasterMinHeight`: `0.5` on `medium`/`high`
(unchanged), `1.0` on `low`. A weak phone drops more small props (pinecones,
mushrooms, small crates) out of the shadow pass than before — visually those
never read as "floating" since they're small and low-contrast against ground
shadow anyway, unlike the hero/skinned-mesh exemption which stays absolute
regardless of tier.

**`setupFireflies` default count now reads the tier.** It previously branched
only on `isMobile` (`28` mobile / `52` desktop), so a `low`-tier phone —
already detected as weak by `resolveRenderQualityTier` — still spawned the
same 28-particle system as a mid-range mobile `medium` device. Default is now
`this.renderQuality.tier === 'low' ? 16 : this.isMobile ? 28 : 52`. Only the
default changed; call sites that pass an explicit count (none currently do)
are unaffected.

Both idea entries from the `Ideas` section below are now closed — nothing
left queued from that list. Re-verified with
`?mission=1&quality=low|medium|high` that shadow map still reads as shadows
in all three tiers and fireflies are visibly present (fewer, not absent) on
`low`.

## Why not more

Grass instance counts (`setupWindGrass`) are still gated by `isMobile` only —
several individual levels (`Level4Scene`, `Level5Scene`, hub scenes) pass
their own hardcoded mobile/desktop counts at the call site rather than using
the `BaseLevelScene` default. Tuning those is level content, not a shared
cap, so it's out of scope here (see "avoid redesigning levels"). If a future
perf pass wants to chase this, the fix is to have those call sites read
`this.renderQuality.tier` instead of `this.isMobile` — same shape as the
changes in this pass, just at each level's `setupWindGrass({ count: ... })`
call.

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
