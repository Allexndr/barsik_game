# ADR 046 — Level 1 mobile bridge-exit contract

- Status: accepted
- Date: 2026-08-24
- Scope: Level 1 «Тропа домбры», creek crossing, mobile golden route

## Analysis

Level 1 already had a complete rescue sequence, but its creek objective was
ambiguous on touch devices. The phase advances only after Barsik reaches the
far bank (`z < -20`), while `objectiveWorldPos()` pointed to the bridge
centre (`z=-18`). A child following the guide arrow could therefore stop on
the bridge while the game was still waiting for the crossing to finish. This
looked like a blocked route even though the collider and phase condition were
working as authored.

The rest of the route was checked as one continuous scenario: two trail
checkpoints, the creek crossing, three pulls on the stuck fruit, the walk to
Aya, the timed dialogue, gift handover and the final invitation. No invisible
boundary or missing interaction was found after the bridge marker was aligned
with the phase contract.

## Plan

1. Keep the creek phase condition and bridge geometry unchanged; move only the
   guide objective to the first safe point beyond the far bank.
2. Run the full route in Kazakh at 390×844 using physical touch orbit, the
   visible joystick and the contextual action button.
3. Assert every phase, all three fruit pulls, gift consumption, camera orbit,
   browser errors and the mobile render envelope.

Risk: changing a guide point can make the route less readable if it lands in
   water or behind a collider. The chosen `z=-22.5` point is on the authored
   ground strip beyond the bridge and before the thicket objective takes over.

## Patch

`src/three/scenes/Mission1Scene.ts` now returns `new THREE.Vector3(0, 0,
-22.5)` during `creek`. The comment documents why the bridge centre is only a
staging point and prevents a future regression back to the ambiguous marker.
No collider, movement speed or phase threshold was widened.

## QA route

### Continuous mobile golden route — Kazakh, 390×844

- Started from the loading Play control and rotated the camera with a physical
  touch drag (`camYaw=1.0062` at the end).
- Completed `intro → trail1 → trail2 → creek → thicket → find_aya →
  give_gift → invite_aya → outro`.
- Collected 3/3 fruit pulls, handed over the fruit and invited Aya. Result: 9
  contextual interactions, 3 earned stars and 70.50 s wall time.
- Final reward card was visually inspected at 390×844; Kazakh copy, score and
  green CTA fit inside the safe area.
- No page errors or console errors. Mobile joystick/action controls were
  present during gameplay and the action control correctly disappeared after
  the final outro state.

### Render budget along the same route

| Phase sample | Calls | Triangles | Renderables | Shadow casters |
| --- | ---: | ---: | ---: | ---: |
| Intro | 199 | 141,146 | 433 | 43 |
| Trail 1 | 142 | 116,695 | 433 | 43 |
| Creek | 132 | 117,739 | 434 | 43 |
| Thicket / pull 2 | 178 | 129,978 | 468 | 43 |
| Find Aya | 193 | 130,450 | 490 | 43 |
| Outro | 153 | 126,502 | 468 | 43 |

The route stayed at or below 199 draw calls, 141,146 triangles and 43 shadow
casters. These are scene snapshots, not a sustained-device thermal proof.

### Engineering gates

Run TypeScript, ESLint, production build, voice freshness and `git diff --check`.
Retain only the known `src/main.tsx` Fast Refresh and Three vendor chunk warnings.
