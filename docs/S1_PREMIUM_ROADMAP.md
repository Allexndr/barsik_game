# Season 1 premium roadmap

**Status:** active production programme · 2026-08-11  
**Owner:** shared between Codex and Claude through small, attributable Git
commits.  
**North star:** a warm, substantial soft-stylised toy world that reads clearly
to a child on a phone. It is not a race for photorealism or polygon count.

This is the operational companion to
[`SEASON_1_ART_PIPELINE.md`](./SEASON_1_ART_PIPELINE.md): it says what is
worked on next and what proves a pass is genuinely ready.

## Delivery rules

1. One visual concern per branch and commit. Every commit states **Why**,
   **User impact**, **Verification** and **Coordination**.
2. A scene improvement is accepted only after mobile (390×844), desktop and
   console checks. `?perf=1` records a 10-second local renderer sample for
   art packages; it is development-only and never analytics.
3. Reuse a kit before decorating a new level. A forest or snow treatment that
   exists in just one scene is a prototype, not a Season 1 asset system.
4. Production comes only from the integration branch after its release gate;
   raw generated meshes, credentials, `dist` and unlicensed assets never
   enter Git.

## Current baseline

| Area | State | Evidence |
|---|---|---|
| Level 0 vertical slice | established | start gate, cream/cyan/pear HUD, yurt camera volume, terrain/tuft pass and feedback/retry fixes |
| Shared mission HUD | established | Levels 1–16 now use the same scoped Barsik Hum chrome; world art remains separate |
| Forest route hygiene | established | L1 uses shared terrain; L2/L3/L10 no longer duplicate sky/cloud/firefly systems |
| Level 10 first frame | established | visual-only foliage clear zone protects the launch camera without changing the route |
| Quality measurement | established | `?perf=1` for levels, City and avatar preview; production build removes it |
| Hero runtime contract | established, awaiting asset | only a licensed, qualified rigged GLB may replace the safe procedural fallback |

## Work sequence

### 1. Finish the Forest Kit v1 rollout — active

**Scope:** Levels 1–10.

- Fix the legacy dark/needle grass colour path and verify it is still one
  instanced draw call.
- Make ground treatment, verge/path logic, tree-density bands and camera
  clear-zones reusable rather than scene-local.
- Profile L0, L1, L3 and L10 using the normal-phone and desktop lenses before
  adding any new foliage.

**Done when:** the representative forest screenshots read as one world, their
paths and first objectives remain visible, and the renderer samples do not
regress against the recorded guardrails.

### 2. Build the Winter/Ice Kit — active

**Scope:** Levels 11–16.

- First, retain the biome-aware snow boundary and the start-camera safe bays
  established in ADR 011; do not reintroduce green forest caps while adding
  new winter detail.
- Use a distinct snow/ice material, packed snow paths, blue shadow palette,
  frozen-water edge cues and winter-specific silhouettes.
- Keep gameplay ground flat wherever an authored beat uses `y = 0`; relief
  belongs outside the playable volume.
- Replace forest-green carry-over where it contradicts winter depth, without
  cloning the Forest Kit or adding expensive full-screen effects.

**Done when:** L11, L14 and L16 are recognisably one winter biome on phone and
desktop, with readable objectives and the same budget discipline as Forest.

### 3. Upgrade City and hub surfaces — queued behind their audit

**Scope:** CityScene, map, Friends, More and supporting navigation.

- Keep Journey as the primary mobile destination; move secondary promises
  behind intentional choices.
- Apply the locked cream / ink / cyan / pear material language to surfaces
  that still retain prototype or violet/glass chrome.
- Treat City as a playable diorama: foreground silhouette, a readable next
  activity and a controlled mobile render budget matter before extra props.

**Done when:** mobile and desktop screen flows have one clear primary action,
all persistent targets are touch-safe, and City has a measured visual budget.

### 4. Replace the fallback hero only after a real asset handoff — blocked on source asset

**Scope:** Barsik, then friends and hero props.

- Accept only a licensed GLB that passes ADR 004: continuous skinned body,
  meaningful Idle + locomotion clips, PBR maps, 25–35k target triangles for
  LOD0 and the defined texture/mesh ceilings.
- Produce LODs, compressed texture variants and a turntable/screenshot review
  before runtime selection changes.
- Keep the procedural avatar as the functional fallback until that quality
  gate passes; do not ship a static or raw million-face generated export.

**Done when:** the new hero moves, jumps and emotes without sliding, fits both
the City and levels, and passes device checks without raising budget limits.

### 5. Perform level-by-level story and interaction polish

**Scope:** the full Season 1 progression after each biome kit is stable.

- Verify that each level teaches one action, gives a readable feedback loop,
  then adds exactly one new decision or payoff.
- Preserve no-fail child-friendly retries: mistakes explain and repeat the
  lesson rather than reshuffle the target or silently punish the player.
- Capture portrait, landscape, keyboard and touch playthrough evidence for
  every vertical slice; add an ADR only when a rule becomes reusable.

**Done when:** each five-plus-minute world feels like a sequence of short,
legible adventures rather than a field of unrelated tasks.

## Release gate

Before any production update, the integration branch must pass:

- `npm run type-check`, `npm run lint`, `npm run build`, `git diff --check`;
- generated `dist` restoration and a check that `?perf=1` is absent from the
  production bundle;
- phone and desktop first-play smoke for every changed world, including
  loading gate, pause/resume, dialogue fold/reopen and the first objective;
- a concise CHANGELOG row and ADR where a reusable visual or gameplay rule was
  established; and
- a deployment record with source SHA, ready URL and previous production as
  rollback target.

## Explicit dependency

The only intentional external blocker is the final Barsik source model. The
team needs its GLB/source, commercial-use licence and permission to derive
LODs/textures, or explicit permission to submit it to a chosen paid rigging
service. No chat-pasted access tokens are a valid handoff mechanism.
