# ADR 050 — Level 10 mobile farewell route certification

- Date: 2026-08-24
- Scope: Level 10 (`Level10Scene`), 390×844 mobile Chrome profile, RU entry with
  `?lang=kk` gameplay
- Status: accepted

## Analysis

Level 10 is a five-stop farewell clearing. A complete run must make the player
take five berry gifts, visit each friend, trigger each memory, hand over the
gift, perform the final goodbye, then walk to the exit map. A first route audit
also exposed a defect in the temporary driver: it tried to target a remembered
spot immediately after pickup, while the game correctly requires the memory
interaction first. The route driver was corrected; no gameplay behavior was
changed for that finding.

The authored scene had 139 shadow casters at the mobile peak. Most came from
generic forest dressing rather than the five friends, remembered landmarks,
gift pile or exit map that carry the player's attention.

## Plan

1. Exercise the full route with physical touch events only: intro, gift pickup,
   memory, delivery, goodbye ×5, exit map and outro.
2. Preserve shadows on authored interaction landmarks and characters.
3. Mark only the generic `loadTrees`/`loadProps` additions as receiving-only.
4. Re-run the route and record state, errors, camera orbit and render budget.

## Patch

`Level10Scene.ts` now captures the scene-child boundary around the generic
forest scatter and clears `castShadow` on meshes added by `loadTrees` and
`loadProps`. The dressing remains lit and volumetric; focal authored objects
keep their readable shadows.

## QA route

- Mobile viewport: 390×844, real touch dispatch through the on-screen joystick
  and action button; no direct scene-state mutation.
- Route: `intro → gifts → farewell (memory + gift + goodbye) ×5 → leaving →
  outro`.
- Result: 457.54 s, 21 interactions, 5/5 memories, 5/5 gifts, 5/5 farewells,
  carrying state false, 0 page/console errors, `camYaw=1.0764` after orbit.
- Render peak after patch: 169 calls, 131,262 triangles, 42 shadow casters;
  outro sample: 136 calls, 106,808 triangles, 42 shadow casters.
- Shadow change: 139 → 42 casters (−97, 69.8%) while keeping the authored
  farewell landmarks and exit readable.
- Final screenshot: `/tmp/barsik-level10-mobile-complete.png` (Kazakh outro
  card with continuation CTA visible).

## Release implication

Level 10 is now mobile-route certified in the same headless touch profile as
Levels 0–9 and 11–16. The season matrix has no remaining incomplete mobile
golden route; the remaining release gates are the continuous new-save run and
real Safari/iOS plus Chrome/Android device QA.
