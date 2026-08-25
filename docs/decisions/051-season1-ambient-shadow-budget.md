# ADR 051 — Season 1 ambient shadow budget for Levels 3–5

- Date: 2026-08-25
- Scope: Level 3, Level 4 and Level 5 generic forest/undergrowth dressing
- Status: accepted

## Analysis

The season-wide 390×844 mobile intro sweep showed that the earlier Level 8–10
shadow reductions had left three outliers: Level 3 had 161 casters, Level 4
had 163 and Level 5 had 190. Those meshes were mostly the generic tree rings,
grass, rocks and undergrowth produced by `loadTrees`/`loadProps`, while each
level's authored landmarks already provided the visual and gameplay anchors.
Keeping every background mesh as a caster increased shadow-map work without
improving the readable frame.

## Plan

1. Keep shadows on the hero, NPCs, bridge/winch, search/farewell objects,
   blockages, markers and authored landmarks.
2. Capture the scene child boundary immediately around generic forest scatter.
3. Clear `castShadow` only for meshes added inside that boundary; retain their
   normal materials and light reception.
4. Re-run the complete mobile intro sweep and a physical camera-orbit smoke for
   all three changed levels.

## Patch

`Level3Scene.ts`, `Level4Scene.ts` and `Level5Scene.ts` now mark the generic
`loadTrees`/`loadProps` additions as receiving-only. Level 4 covers both banks;
Level 5 covers both undergrowth passes. Authored dressing created before or
after those blocks is not included in the boundary.

## QA

- Full mobile intro sweep: Levels 0–16, no page/console errors, visible
  `.m0-stick` controls on every level.
- Shadow casters: Level 3 `161→46`, Level 4 `163→73`, Level 5 `190→45`.
- Physical touch orbit smoke: Levels 3, 4 and 5 all changed `camYaw` by
  `0.8003`, `0.7640` and `0.6368` respectively; all remained in `intro` with
  no errors.
- Previously certified full golden routes remain the gameplay contract; this
  patch changes only shadow participation for background dressing.

## Release implication

The largest remaining Level 3–5 mobile shadow outliers are removed without a
global quality cut or gameplay collision change. Sustained frame-time,
temperature and memory measurements on physical Safari/iOS and Chrome/Android
devices are still required before gold-master sign-off.
