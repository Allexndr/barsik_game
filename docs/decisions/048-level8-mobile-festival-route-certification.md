# ADR 048 — Level 8 mobile festival route certification

- Status: accepted
- Date: 2026-08-24
- Scope: Level 8 «Лесной праздник», festival acts, celebration finale and
  mobile shadow budget

## Analysis

Level 8 had a complete desktop route and a mobile smoke result, but the full
festival loop had not been proven on touch. The scene has three different
verbs—light lanterns, hang garlands and carry fruit back to the table—followed
by an automatic guest procession and photo finale. A smoke test could miss a
garland hidden behind a tree, a carried fruit that never reaches the table, or
the final gathering moving Barsik out of the shot.

The first full mobile run completed the route, but exposed a mobile rendering
cost issue: the celebration frame had 152 shadow casters. The surrounding
forest dressing does not need to cast a second shadow pass; the readable
shadows belong to the three focal oaks, lanterns, table/fire, hero and guests.

## Plan

1. Keep all focal festival shadows and interaction geometry unchanged.
2. Make the distant tree/prop dressing receiving-only after it is loaded, so
   it retains lit volume without submitting shadow casters.
3. Start a fresh Kazakh mobile scene at 390×844, orbit with a physical touch
   drag, and complete all three acts plus the photo/outro sequence.
4. Record counters, camera orbit, browser errors, render cost and the final
   reward card before/after the shadow-budget change.

Risk: removing shadows from too many objects could flatten the scene. The
patch is scoped to the roots created by the generic distant `loadTrees` and
`loadProps` calls; focal oaks, lantern posts, table/fire, hero and arriving
friends remain shadow-capable.

## Patch

`src/three/scenes/Level8Scene.ts` now records the scene root index before
loading the 26 background trees and 11 background props, then sets only those
meshes to `castShadow=false`. They continue to receive scene lighting. No
interaction, terrain boundary, camera or reward logic changed.

## QA route

### Continuous mobile golden route — Kazakh, 390×844

- Started from the loading Play control and rotated the camera with a physical
  touch drag (`camYaw=0.4446` at the end).
- Completed `lanterns 5/5 → garlands 3/3 → harvest 4/4 → gather → celebrate →
  outro` using 12 contextual interactions and 265.91 s wall time.
- Each carried fruit was physically walked back to the table; the final
  gathering moved the guests and Barsik into the celebration shot.
- Final reward card was visually inspected at 390×844; Kazakh copy, score and
  green CTA fit inside the safe area.
- No page errors or console errors. Mobile joystick/action controls stayed
  visible during the interactive acts and the action control disappeared in
  outro.

### Render budget along the same route

| Phase sample | Calls | Triangles | Renderables | Shadow casters |
| --- | ---: | ---: | ---: | ---: |
| Lanterns (start) | 212 | 141,679 | 388 | 58 |
| Lanterns (1/5) | 212 | 143,429 | 399 | 58 |
| Garlands (1/3) | 135 | 93,597 | 415 | 58 |
| Harvest (0/4) | 169 | 93,148 | 439 | 58 |
| Gather | 171 | 118,158 | 437 | 58 |
| Celebrate/photo | 232 | 153,035 | 493 | 58 |
| Outro | 160 | 148,793 | 425 | 58 |

Compared with the pre-patch baseline, shadow casters fell from 152 to 58
(about 62%) while the full route remained error-free. The peak of 232 draw
calls and 153,035 triangles is a scene snapshot during the deliberately dense
photo celebration, not a sustained-device thermal proof.

### Engineering gates

Run TypeScript, ESLint, production build, voice freshness and `git diff --check`.
Retain only the known `src/main.tsx` Fast Refresh and Three vendor chunk warnings.
