# ADR 029 — Level 3 trail instancing and route clearance

## Status

Accepted — 2026-08-21.

## Context

A Season 1 mobile scan found 623 renderables in Level 3, the highest count in
the chapter. Two hundred of them were paw prints: every print was a group of
four private meshes. Sixteen dirt-path tiles also owned private geometry and
material, while the scene created a second sky, cloud field and firefly field
after `setupForestEnvironment` had already supplied them.

The optimisation audit exposed gameplay faults that static checks had missed.
The HUD promised three stops although the route contains five; forest scatter
ran before the route was reserved; the mushroom cottage collider sat on the
first visible trail; a rock blocked the second search marker; and the final
log was centred on its marker, stopping Barsik at 2.45 m while interaction
required less than 2 m. Bonuses and the hedgehog also used absolute Y positions
and 3D interaction distance on sculpted terrain.

A real 390×844 camera orbit then found tall cap trees inside the follow-camera
lens volume. The level was technically playable but one valid camera angle was
almost entirely a tree trunk.

## Decision

- Declare the five-stop authored path and reserve its route before any forest
  or prop scatter.
- Draw each trail leg as one shared-geometry `InstancedMesh`; reveal exactly one
  leg at a time. Draw the dirt approach as one instanced family.
- Use the shared forest sky, clouds and fireflies only once.
- Derive HUD progress from the actual five-sector collection.
- Keep honest prop collision, but compose rocks to either side of the incoming
  trail, move the cottage into a reserved side pocket and place the final log
  behind its search marker.
- Snap ground collectibles and the hedgehog to local terrain height; measure
  all ground interactions in the XZ plane.
- Extend `enclosePath` with opt-in visual-clear zones. Inside one, retain the
  low first boundary row but omit mid/far canopy. Level 3 samples these zones
  along its trail; other levels keep their existing composition unchanged.

## Player impact

The child can follow one readable chain of prints through all five stops
without hitting a decorative collider placed on the clue itself. Rewards and
the hedgehog activate where they are visibly standing. A full mobile camera
orbit keeps Barsik, the marker and the landscape readable while the low forest
edge still explains where the playable space ends.

## Verification gates

- Complete five sectors, collect four bonuses, find the hedgehog and reach the
  outro using only normal keyboard input along the visible paw-print route.
- Exercise real mobile swipe, joystick and contextual-action input at 390×844.
- Rotate the mobile follow camera beyond 360 degrees at a search sector and
  inspect four representative orbit frames for canopy occlusion.
- Compare scene renderables, shadow casters, geometry and material counts.
- Pass type-check, lint, production build and diff-check; restore generated
  `dist` before commit.

## Verification evidence

- Scene traversal fell from 623 to 380 renderables, 506 to 273 unique
  geometries and 251 to 168 unique materials. Shadow casters fell from 172 to
  160. A representative pre/post mobile frame fell from 205 to 180 renderer
  calls; triangle variance from seeded decoration is not treated as a gain.
- Frozen 1440×900 route: 5/5 sectors, 4/4 bonuses, hedgehog interaction and
  outro passed with no console or page errors.
- Real 390×844 touch input rotated the camera by 0.63 rad, drove Barsik 19.34 m
  along the first trail, searched the sector and collected its bonus. The
  joystick remained 16 px from the left and roughly 24 px from the bottom.
- Four additional mobile orbit samples covered 7.56 rad. None reproduced the
  previous full-frame trunk occlusion; the low boundary row remained visible.
