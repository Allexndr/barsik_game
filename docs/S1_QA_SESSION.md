# S1 QA Session — L0 / L1 / L8 / L16

Manual pass checklist for the four levels named in scope: L0 (Level0Scene,
Фруктовый лес intro), L1 (Mission1Scene, `mission1`), L8 (Level8Scene, конец
Фруктового леса), L16 (Level16Scene, конец Ледяной долины). Covers both
worlds and both language tracks with the smallest number of runs.

## Environment note

This pass was run without a browser available in the session (no
Playwright/Puppeteer, no `node_modules` originally installed). What *was*
verified mechanically:

- `npm install && npx tsc --noEmit` — clean, no type errors.
- `npm run build` — clean production build, no errors (only the pre-existing
  "chunk >500kB" size warning, not a correctness issue).
- Static read of `App.tsx`'s dev launcher and of L0/L1/L8/L16 scene source
  for the known trap patterns called out in `CLAUDE.md` (`setupGround`,
  ambient light, raw `placeMany`, `pointAt` recursion).

Everything below that isn't marked "confirmed in code" needs an actual
click-through in a browser — this doc is the checklist for that pass, not a
substitute for it.

## Query params (dev-only, `import.meta.env.DEV`, see `src/App.tsx:179-226`)

| Param | Values | Effect |
|---|---|---|
| `?mission=N` | integer `0`–`16` | Skips onboarding, creates a throwaway QA player if none saved, calls `startEpisode(N)` directly into that level. |
| `&lang=kk` | `kk` (anything else → `ru`) | Sets the QA player's language before launch. Must be combined with `?mission=`; has no effect alone. |
| `?fps=1` | `1` | Enables `createFpsSampler` (`src/dev/fpsSampler.ts`). Logs `[fps:level] avg=… p5=… frames=… windowMs=…` to devtools console every ~10s window (needs ≥30 samples). No on-screen HUD — must watch the console. |
| `?tab=X` | `travel｜friends｜city｜shop｜leaderboard｜qr` | Jumps straight into a navbar meta-screen, bypassing onboarding. Unrelated to `mission`, don't combine. |

Console-only helper once a session is running (dev build): `window.__goto(n)`
switches level in place without a page reload — use it to sweep several
levels in one browser tab instead of 17 navigations.

Example URLs:
```
http://localhost:5173/?mission=0&lang=ru&fps=1
http://localhost:5173/?mission=1&lang=kk&fps=1
http://localhost:5173/?mission=8&lang=ru&fps=1
http://localhost:5173/?mission=16&lang=kk&fps=1
```

## Per-level checklist

Run each level twice — once `lang=ru`, once `lang=kk` — with `fps=1` on both
runs. 8 runs total for full coverage; if time-boxed, at minimum do `L0 ru`,
`L1 kk`, `L8 ru`, `L16 kk` to touch every level and both languages once.

For every run:

- [ ] Level loads to a playable state within a few seconds (no white
      screen — see "known trap" below for the recursion failure mode).
- [ ] Ground is not a flat plane (rules out the `setupGround()` regression —
      see Blockers, this is a **known failure on L1**).
- [ ] No ambient wash / flat lighting — key light reads clearly stronger
      than fill (~4:1 per `CLAUDE.md`; if the scene looks shadowless-flat,
      note it).
- [ ] Exactly one quest marker glows at a time, and it points at something
      reachable, never at more than one target simultaneously.
- [ ] Hero never clips through terrain (walk the full playable footprint,
      including any bridges, banks, or slopes).
- [ ] Hero never passes through a prop that should block (logs, benches,
      tents, crates — anything placed via `placeProps`, not ambient
      decoration like flowers/mushrooms which are intentionally walk-through).
- [ ] Text renders in the selected language only — no leaked RU strings in
      a `kk` run or vice versa (`CLAUDE.md`: "Утёкшие языки — баг").
- [ ] Mistakes/misses are recoverable — no fail state, only "try again"
      framing (`CLAUDE.md`: "Нет проигрыша").
- [ ] Level completes and hands off (to hub/next level) without a stuck
      screen or dead-end UI.
- [ ] Portrait phone width (~390×844), phone-landscape (~844×390), and a
      short/wide desktop window (~1280×620, landscape by pixels but should
      NOT get the phone-landscape treatment) all frame the camera sensibly —
      `this.viewport` is height-driven, not `orientation`-media-query-driven,
      so this is the case most likely to regress silently.
- [ ] `[fps:level]` console samples stay reasonable (no sustained sub-30
      `avg`, no `p5` collapsing far below `avg` — that signals stutter, not
      just a slow device).

### L0 — Level0Scene (Фруктовый лес, first level)

- [ ] Onboarding → first level handoff is smooth (this is most players'
      actual entry point, unlike `?mission=0` direct-launch).
- [ ] "First step taken" beat (scene comment at `Level0Scene.ts:532`) fires
      once movement starts, not before.
- [ ] Uses `setupForestEnvironment()` — confirmed in code
      (`Level0Scene.ts:736`); visually verify rendered rug/rise/fog actually
      show up, not just that the call exists.

### L1 — Mission1Scene (`mission1`)

- [ ] **Known code-level regression, not fixed (see Blockers): the level
      calls `setupGround(makeGrassTexture())` (`Mission1Scene.ts:302`)
      instead of `setupForestEnvironment()`.** Expect a flat plane look.
      Confirm visually and record whether it's as bad as the old "15 levels
      looked cheap" problem `CLAUDE.md` warns about.
- [ ] Creek crossing at `z≈-14`: real collision comes from the two `aabb`
      colliders flanking the built `bridge()` mesh (`Mission1Scene.ts:372-376`),
      not from the decorative `wood_bridge`/`bridge_mini` props layered on
      top via `placeMany` (`Mission1Scene.ts:481-494`, no colliders — expected,
      they're cosmetic dressing over the real bridge). Confirm the player
      can only cross at the bridge gap and can't wade through the water
      banks elsewhere.
- [ ] Aya (friend NPC) quest marker only appears once reachable
      (`find_aya`/`give_gift`/`invite_aya` phases, `Mission1Scene.ts:288-289`).

### L8 — Level8Scene (Фруктовый лес finale)

- [ ] Uses `setupForestEnvironment()` — confirmed in code
      (`Level8Scene.ts:427`). Visually confirm.
- [ ] This is the last Fruit Forest level before the Ice Valley transition —
      verify the handoff into L9/world-switch doesn't strand the player on
      a loading or transition screen.

### L16 — Level16Scene (Ледяная долина finale, season close)

- [ ] Uses `setupWinterEnvironment()` — confirmed in code
      (`Level16Scene.ts:122`). Visually confirm snow/ice dressing renders.
- [ ] Season-1 completion state (last level in the 17-level canon) hands off
      cleanly — no dead end, returns to hub/city or an explicit "season
      complete" screen rather than a blank/stuck scene.

## Blockers

1. **Hero has no skeleton.** `public/assets/models/chars/barsik.glb` — 0
   animations, 0 skins, 1 mesh (documented in `CLAUDE.md`, open question O2
   of the spec). Arms/legs cannot animate on any level, including all four
   in this pass. Not something a code fix in these scenes can address —
   needs a new rigged model. Not touched here.
2. **L1 uses `setupGround()` instead of `setupForestEnvironment()`**
   (`Mission1Scene.ts:302`) — the exact anti-pattern `CLAUDE.md` calls out
   ("из-за неё 15 уровней выглядели дёшево"). This is a **style/visual
   regression, not a soft-lock** — the level is still playable, nothing
   traps the player. Per QA scope ("fix only proven soft-locks"), this was
   **not fixed** in this pass; flagging for a follow-up task explicitly
   scoped to visual/style fixes, with a before/after render since the swap
   also needs new terrain-height sampling (`groundHeightAt`) to stay
   correct for prop placement in the same file.
3. **No browser automation available in this environment.** `node_modules`
   had to be installed from scratch; there's no Playwright/Puppeteer in
   `devDependencies` and no display/screenshot tool wired into this
   session. All checklist items above marked without "confirmed in code"
   need a human (or a session with real browser access) to actually run
   through `npm run dev` and click.

## What was and wasn't fixed

No soft-lock (player-gets-stuck / progression-blocking) bug was found that
could be proven from static code reading alone — quest-marker logic,
collider placement, and completion handoffs in L0/L1/L8/L16 all read
correctly by inspection. Per instructions, nothing was spawn-fixed on
suspicion; item 2 above is a real, provable issue but is explicitly out of
"soft-lock" scope and was left for a dedicated style-fix pass instead of
bundled in here.
