# ADR 045 — Level 6 mobile riddle route certification

- Status: accepted
- Date: 2026-08-24
- Scope: Level 6 «Лесная загадка», touch route, wrong-answer recovery and
  render budget

## Analysis

Level 6 had a complete desktop route and a mobile smoke result, but the full
touch journey had not been proven. This matters because the scene deliberately
uses a non-linear-feeling choice loop: three clues teach the forest facts,
the stump asks three questions, a wrong tree requires a visible return to the
stump, and only then may the player try again. A smoke test cannot prove that
the return state, camera-relative travel and final reward all compose.

The scene audit found no production blocker. The tree rooms and connecting
reservations keep all three landmarks reachable, the tree collider stops the
hero at the same distance where interaction is allowed, and the riddle data
maps to visible world facts: tallest green tree, most nests on yellow and
hedgehog under red. The test harness initially used a stricter 1.8 m action
threshold than the scene's honest 2.5 m interaction radius; the harness was
corrected to respect the production contract. No game code was changed for
this certification.

## Plan

1. Start from a fresh Level 6 mobile scene in Kazakh at 390×844.
2. Rotate the camera with a real touch drag, then use only the visible joystick
   and contextual paw button.
3. Collect all three clues, intentionally choose one wrong tree, return to the
   stump, then answer all three riddles correctly.
4. Record phase transitions, stars, wrong attempts, camera orbit, browser
   errors, render cost and the final reward card.

Risk: a route that relies on private state or direct coordinate mutation would
hide a child-facing reachability problem. The run therefore reads state only
for assertions and sends physical touch events for every movement and action.

## Patch

No Level 6 gameplay source patch was necessary. The certification records that
the existing route contract is internally consistent:

- clue collection is ordered by visible, glowing world markers;
- wrong answers do not remove stars and explicitly point back to the stump;
- the three authored facts are observable in the scene rather than encoded in
  the answer text;
- tree colliders and the 2.5 m contextual interaction radius agree;
- the guide arrow intentionally disappears during a riddle so it cannot reveal
  the answer before the child observes the forest.

## QA route

### Continuous mobile golden route — Kazakh, 390×844

- Started from the loading Play control and rotated the camera with a physical
  touch drag (`camYaw=1.0062` at the end).
- Completed `intro → seek 0/3 → seek 1/3 → seek 2/3 → riddle 1 → riddle 2 →
  riddle 3 → outro`.
- Collected 3/3 clues, made one genuine wrong-tree attempt, returned to the
  stump, then answered all three riddles. Result: 8 interactions, 22 level
  stars and 222.37 s wall time.
- Final reward card was visually inspected at 390×844; Kazakh copy, score and
  green CTA fit inside the safe area.
- No page errors or console errors. Desktop and mobile virtual controls obeyed
  the shared input contract.

### Render budget along the same route

| Phase | Calls | Triangles | Renderables | Shadow casters |
| --- | ---: | ---: | ---: | ---: |
| Seek 0/3 | 136 | 123,782 | 372 | 54 |
| Seek 1/3 | 136 | 136,234 | 383 | 54 |
| Seek 2/3 | 128 | 106,908 | 383 | 54 |
| Riddle 1 | 132 | 107,264 | 399 | 54 |
| Riddle 2 | 161 | 99,996 | 412 | 54 |
| Riddle 3 | 195 | 112,896 | 412 | 54 |
| Outro | 145 | 126,837 | 412 | 54 |

The full route stayed at or below 195 draw calls, 136,234 triangles and 54
shadow casters. The scene's existing static-decoration batch and distant-shadow
ownership boundary remain effective on the mobile profile.

### Engineering gates

Run TypeScript, ESLint, production build, voice freshness and `git diff --check`.
Retain only the known `src/main.tsx` Fast Refresh and Three vendor chunk warnings.
