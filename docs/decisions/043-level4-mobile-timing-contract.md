# ADR 043 — Level 4 mobile timing contract

- Status: accepted
- Date: 2026-08-24
- Scope: Level 4 green-window semantics, touch golden route and late-route QA state

## Analysis

Level 4 had a complete desktop route and render-budget work, but mobile evidence
stopped after the first plank. A full physical-touch run reached the repaired
bridge and then repeatedly failed on the later timed sections even with the
correct green signal and a full joystick gesture.

The section data names `safeDuration` and `unsafeDuration` and authors them as
seconds: green windows are 3.2, 2.6, 2.2, 2.0 and 1.6. `isSectionSafe()` also
multiplied elapsed time by each section's visual `swaySpeed`, however. The real
green windows were therefore 3.2, 2.17, 1.47, 1.11 and 0.8 seconds. The final
section gave a child less than one second to read a colour change, move a thumb
and cross 2.35 metres. That is reaction-speed punishment, not the intended
"timing without a fail state" mechanic.

The development `?at=x,z` sampler had a second, non-production defect: a drop
onto a late bridge section still reported zero crossed sections and directed
the QA route back toward the near bank.

## Plan

1. Keep the existing authored durations and make them literal seconds.
2. Keep `swaySpeed` on the visual deck/rope movement only; do not let an art
   parameter silently retune gameplay difficulty.
3. Preserve the stumble/retry consequence so the mechanic still teaches
   waiting for green instead of becoming an unconditional walk.
4. Restore already-passed sections for development route samples using the
   same section exit edge as production crossing logic.
5. Complete one continuous Kazakh mobile route using only visible touch input,
   then inspect phase state, fail/retry, final reward UI and render cost.

Risk: longer green windows could make the bridge trivial. The windows still
shrink from 3.2 to 1.6 seconds, red windows remain 1.4–2.0 seconds and the
golden route must record real stumbles before completion.

## Patch

- `isSectionSafe()` now advances its safe/unsafe cycle with elapsed seconds.
  The intended windows are exactly 3.2/2.6/2.2/2.0/1.6 seconds.
- Visual sway continues to use each section's individual `swaySpeed`; the five
  slabs still become progressively more active even though input fairness is
  no longer coupled to that animation multiplier.
- A development start inside the gorge marks only sections whose production
  exit edge is already behind Barsik as crossed. The section under his feet
  remains active, so a late QA sample still exercises real timing.

For the player, green now means "there is enough time to act". A missed window
still produces the visible stumble, sound, short movement lock and safe reset,
but success no longer depends on sub-second mobile reaction time.

## QA route

### Continuous mobile golden route — Kazakh, 390×844

- Clicked the real Play control, rotated the camera with a physical touch drag
  and used only the visible joystick/action button thereafter.
- Completed:
  `intro → edge → repair → bridge → island → bridge → winch → meet → outro`.
- Collected all 3 loose planks, watched all 3 repair flights, crossed 5/5 timed
  sections, turned the winch 3/3 times and waited for Aya's full crossing/wave.
- The route recorded four genuine stumbles and recovered from all four, proving
  the fail/retry mechanic remained active after the timing fix.
- Result: 6 interactions, 17 level stars, final `camYaw=0.9126`, 145.89 s
  automation wall time and zero page/console errors.
- The animated Kazakh reward card was visually inspected after its entrance
  transition; text, score and CTA fit the 390×844 safe area.

### Render budget along the same route

| Phase | Calls | Triangles | Renderables | Shadow casters |
| --- | ---: | ---: | ---: | ---: |
| Intro | 136 | 58,652 | 374 | 163 |
| Edge search | 135 | 45,628 | 374 | 163 |
| Repair | 182 | 50,110 | 387 | 163 |
| First bridge span | 191 | 50,122 | 389 | 163 |
| Island | 151 | 40,280 | 389 | 163 |
| Second bridge span | 146 | 39,794 | 375 | 163 |
| Winch | 175 | 41,900 | 401 | 163 |
| Meet | 130 | 39,478 | 405 | 163 |
| Outro | 79 | 38,688 | 395 | 163 |

The full route stayed at or below 191 draw calls and 58,652 triangles. No new
geometry, material, texture or shadow-caster family was added by the gameplay
patch.

### Late-route regression

`?at=0,-12.65` began with 2/5 sections crossed, left the current slab active,
then completed the remaining three sections, winch and Aya sequence with one
real stumble and zero browser errors. This checks the QA state restoration
without substituting it for the continuous golden route.

### Engineering gates

Run TypeScript, ESLint, production build, voice freshness and
`git diff --check`. Retain only the known `src/main.tsx` Fast Refresh and Three
vendor chunk warnings.
