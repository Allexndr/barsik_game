# ADR 047 — Level 2 mobile orchard route certification

- Status: accepted
- Date: 2026-08-24
- Scope: Level 2 «Яблоневый сад», sorting, арық rescue and reward route

## Analysis

Level 2 had a desktop-complete route and a mobile learning-loop smoke result,
but the second act had not been proven on touch. The level is a stateful chain:
the gardener demo teaches the apple pattern, six apples must be sorted, the
sluice opens, three different blockages are removed, water reaches the old
apple tree, and the golden apple is delivered back to the gardener. A smoke
test could miss a stuck carried apple, a wrong-basket recovery, a stale
blockage collider or a gift that becomes visible without a reachable target.

The full mobile audit found no production blocker. Grounded pickups stayed
visible, basket interaction remained readable, the wrong basket retained the
carried apple as intended, each cleared blockage removed its collider, and the
golden-apple handover completed the level. Four optional tree apples remain
available after the required six sort items; they are bonus content, not an
unfinished objective.

## Plan

1. Start from a fresh Level 2 mobile scene in Kazakh at 390×844.
2. Rotate the camera with a physical touch drag and use only the visible
   joystick and contextual action button.
3. Watch the gardener demo, sort all six required apples, intentionally choose
   one wrong basket, then recover and complete the correct matches.
4. Open the sluice, clear the branch, leaf plug and three-push stone, wait for
   the water/golden-apple beat, collect the gift and deliver it.
5. Record phase transitions, state counters, camera orbit, browser errors,
   render cost and the final reward card.

Risk: a route that directly mutates `phase`, positions or inventory would hide
the exact child-facing failures this level is meant to prevent. The harness
therefore reads state only for assertions and sends physical touch events for
every movement and action.

## Patch

No Level 2 gameplay source patch was necessary. The existing contracts were
certified as coherent:

- `collect → sort` preserves the carried apple until the matching basket is
  reached;
- a wrong basket gives feedback without consuming the apple;
- `aryk → clear` moves the task marker to the next visible blockage and removes
  the corresponding collider only after a successful clear;
- the final water delay creates a readable gift beat before `gift → deliver`;
- the guide and contextual interaction radius agree with the orchard geometry.

## QA route

### Continuous mobile golden route — Kazakh, 390×844

- Started from the loading Play control and rotated the camera with a physical
  touch drag (`camYaw=1.0530` at the end).
- Completed `intro → demo → collect → sort 6/6 → aryk → clear 3/3 → gift →
  deliver → outro`.
- Made one genuine wrong-basket attempt, recovered without losing the carried
  apple, cleared the heavy stone with three physical pushes and delivered the
  golden apple. Result: 22 contextual interactions, 8 earned stars and 160.34
  s wall time.
- Final reward card was visually inspected at 390×844; Kazakh copy, score 20
  and the green CTA fit inside the safe area.
- No page errors or console errors. Mobile joystick/action controls remained
  available during gameplay and the action control disappeared in outro.

### Render budget along the same route

| Phase sample | Calls | Triangles | Renderables | Shadow casters |
| --- | ---: | ---: | ---: | ---: |
| Intro | 67 | 99,906 | 336 | 53 |
| Demo | 124 | 115,575 | 336 | 53 |
| Collect | 154 | 107,075 | 355 | 53 |
| Sort / basket recovery | 191 | 121,966 | 347 | 53 |
| Aryk gate | 195 | 118,840 | 371 | 53 |
| Clear / 3 blockages | 142 | 103,247 | 349 | 53 |
| Gift | 129 | 103,094 | 357 | 53 |
| Outro | 182 | 111,859 | 387 | 53 |

The route stayed at or below 195 draw calls, 121,966 triangles and 53 shadow
casters. These are scene snapshots, not a sustained-device thermal proof.

### Engineering gates

Run TypeScript, ESLint, production build, voice freshness and `git diff --check`.
Retain only the known `src/main.tsx` Fast Refresh and Three vendor chunk warnings.
