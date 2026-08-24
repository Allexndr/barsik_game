# ADR 044 — Level 3 mobile terrain and route contract

- Status: accepted
- Date: 2026-08-24
- Scope: Level 3 search props, animated quest objects and mobile golden route

## Analysis

Level 3 already had a connected five-leg paw-print trail and a complete desktop
route, but mobile evidence stopped after the first sector. A continuous physical
touch run completed the quest and exposed a user-visible terrain defect at its
payoff: the rescued hedgehog rendered about 2.73 metres below the sculpted
ground. Interaction still worked because target distance is intentionally
horizontal, so completion alone concealed the broken frame.

The same defect affected all animated search objects. Their authored spawn
positions used `groundHeightAt()`, then the frame loop replaced world `y` with
an absolute bob value. Question bubbles could sink into raised sectors, bonus
stars dropped back toward `y=0`, and the final hedgehog was almost entirely
underground. Sector effect origins and hand-authored bushes, rocks and the final
log were also placed on the old flat `y=0` plane.

## Plan

1. Preserve the existing five-sector route, interaction radius and quest state.
2. Ground every authored search prop using the shared terrain sampler.
3. Make idle animation additive to terrain height and the object's intended
   hover offset instead of replacing world height.
4. Complete the whole route in Kazakh using only visible mobile controls and
   record state, terrain delta, render cost and browser errors.

Risk: moving physical-looking sector props vertically could expose a collider
mismatch. Colliders remain horizontal by design, so the full route must prove
that every marker is still reachable and the raised props do not block the
intended approach.

## Patch

- Sector roots now sit at `groundHeightAt(x, z)`, so search sparks originate at
  the visible surface rather than under it.
- Search bushes, both rock pairs and the final fallen log use `snapToGround()`.
  Their existing horizontal colliders and authored composition are unchanged.
- Question bubbles animate at `terrainY + bob` while retaining their child
  meshes' 1.95–2.2 metre readable height.
- Bonus stars animate at `terrainY + 0.75 + bob`.
- The hedgehog animates at `terrainY + bob`; reveal scale and plush idle motion
  remain independent.

For the player, following a track now ends in a coherent scene: clues hover
above the place being searched, rewards remain above the grass and the rescued
animal stands on the same hill as Barsik.

## QA route

### Continuous mobile golden route — Kazakh, 390×844

- Clicked the real Play control, rotated the camera with a physical touch drag
  and used the visible joystick/action button without direct scene mutation.
- Completed `intro → tracking 0/5 → 1/5 → 2/5 → 3/5 → 4/5 → found → outro`.
- Checked all 5 sectors, collected all 4 revealed bonuses and interacted with
  the hedgehog: 10 interactions, 15 level stars and 239.05 s wall time.
- Final `camYaw=1.0062`; no page errors or console errors.
- Hedgehog height stayed between -0.030 and +0.010 metres relative to sampled
  terrain. The pre-patch baseline was approximately -2.73 metres.
- The animated Kazakh reward card was visually inspected at 390×844; badge,
  copy, rewards and CTA fit inside the mobile safe area.

### Render budget along the same route

| Phase | Calls | Triangles | Renderables | Shadow casters |
| --- | ---: | ---: | ---: | ---: |
| Intro | 139 | 92,139 | 378 | 161 |
| Tracking 0/5 | 119 | 88,227 | 378 | 161 |
| Tracking 1/5 | 101 | 69,680 | 385 | 161 |
| Tracking 2/5 | 151 | 88,083 | 385 | 161 |
| Tracking 3/5 | 111 | 71,106 | 385 | 161 |
| Tracking 4/5 | 133 | 70,574 | 385 | 161 |
| Found | 140 | 86,371 | 403 | 161 |
| Outro | 160 | 87,571 | 423 | 161 |

The complete route stayed at or below 160 draw calls and 92,139 triangles. The
terrain fix adds no geometry, material, texture or shadow-caster family.

### Engineering gates

Run TypeScript, ESLint, production build, voice freshness and
`git diff --check`. Retain only the known `src/main.tsx` Fast Refresh and Three
vendor chunk warnings.
