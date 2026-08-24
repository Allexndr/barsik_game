# ADR 049 — Level 9 mobile forest-chest route certification

- Status: accepted
- Date: 2026-08-24
- Scope: Level 9 «QR-сундук», berry search, guardian trades, lock recovery and
  mobile reachability/shadow budget

## Analysis

Level 9 had desktop coverage and a mobile first-pick smoke result, but the
actual forest search and chest finale were unproven. The level intentionally
combines a non-linear search with a forgiving trade loop: nine berries are
needed for three guardian seals, three spare berries remain as slack, and the
chest lock must be copied in the visible `sun → leaf → drop` order. A smoke
test could miss an unreachable side branch, a partial three-berry trade, a
wrong-pillar reset that loses progress, or a chest that never opens.

The audit found a real reachability defect. `reserveSideBranch()` reserved
points around the berries, but movement still used the old z-oriented corridor;
the transition from the central trail to a sideways berry branch was clamped
back by an invisible wall. The fix changes the movement contract to a visible
forest arena that contains every berry, shrine and chest clearing. The audit
also found 132 mobile shadow casters from distant dressing assets.

## Plan

1. Replace the corridor-only movement boundary with a visible arena ring
   centred on the forest route, preserving the authored path and colliders.
2. Keep the three shrines, guardians, chest, pillars and key as focal shadow
   sources; make only generic distant trees/props receiving-only.
3. Start a fresh Kazakh mobile scene at 390×844, orbit with a physical touch
   drag, collect/trade three groups of berries, intentionally press one wrong
   lock pillar, recover, complete the lock and wait for the chest outro.
4. Record counters, camera orbit, browser errors, render cost and the final
   reward card.

Risk: an arena that is too small would recreate the same invisible-wall bug;
the radius `33.5` plus the shared corridor slack contains the farthest authored
object while the three-row forest ring remains the visible boundary.

## Patch

`src/three/scenes/Level9Scene.ts` now sets `playArena = { x: 0, z: -20,
r: 33.5 }` and encloses that arena with the visible forest ring. The old
z-corridor remains available to the trail/terrain systems but no longer clamps
sideways berry branches.

The same file records the scene root index before loading generic background
trees/props and disables `castShadow` only for those roots. Shrines, guardians,
seals, lock pillars, chest, key, hero and other focal objects retain shadows.

## QA route

### Continuous mobile golden route — Kazakh, 390×844

- Started from the loading Play control and rotated the camera with a physical
  touch drag (`camYaw=1.1232` at the end).
- Completed three cycles of `3 berries → guardian seal`, then `lock` with one
  genuine wrong-pillar attempt and reset, followed by the correct
  `sun → leaf → drop` sequence and `unlock → open → outro`.
- Result: 9 required berries, 3/3 seals, 16 contextual interactions, 1 wrong
  lock recovery and 319.11 s wall time. Three spare berries remained visible
  by design; no required pickup disappeared unexpectedly.
- Final reward card was visually inspected at 390×844; Kazakh copy, score,
  rare-friend badge, map CTA and green continuation button fit inside the safe
  area.
- No page errors or console errors. Mobile joystick/action controls were
  present during the route and the action control disappeared in outro.

### Render budget along the same route

| Phase sample | Calls | Triangles | Renderables | Shadow casters |
| --- | ---: | ---: | ---: | ---: |
| Quest start | 141 | 145,762 | 349 | 41 |
| Quest / 3 berries | 175 | 131,122 | 358 | 41 |
| Quest / second trade | 177 | 144,209 | 364 | 41 |
| Quest / third trade | 109 | 93,890 | 358 | 41 |
| Lock / first correct pillar | 154 | 100,390 | 362 | 41 |
| Lock / second correct pillar | 169 | 110,470 | 362 | 41 |
| Open | 146 | 87,598 | 458 | 41 |
| Outro | 55 | 88,007 | 351 | 42 |

Compared with the pre-patch baseline, shadow casters fell from 132 to 41
(about 69%) while all objectives remained reachable. The route peaked at 192
draw calls and 150,982 triangles; these are scene snapshots, not a sustained
device thermal proof.

### Engineering gates

Run TypeScript, ESLint, production build, voice freshness and `git diff --check`.
Retain only the known `src/main.tsx` Fast Refresh and Three vendor chunk warnings.
