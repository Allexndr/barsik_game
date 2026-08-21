# ADR 027 — Level 10 farewell clearing

## Status

Accepted — 2026-08-21.

## Context

Level 10 is a hub-and-spoke farewell: Barsik repeatedly returns to the berry
basket, then follows the guide to one of five friends. The live level instead
derived a narrow serpentine corridor from its objective rooms. The guide arrow
pointed directly to a friend while movement was clamped to that unrelated
corridor. A normal-input route reproduced a hard stop after the third gift:
Barsik remained 15.42 metres from the hedgehog with no visible obstacle.

Fresh 390×844 medium telemetry was already inside the release budget at roughly
157–165 renderer calls, 124.6–125.7k visible triangles and 23 textures. This is
therefore a gameplay-space correction, not a geometry-for-numbers rewrite.

## Decision

- Level 10 uses one authored clearing centred at `(0, -14)` with radius `27`.
- The central basket and every objective room are explicitly reserved from
  decoration. The direct guide and the walkable space now express the same
  route.
- `encloseArena` accepts optional visual-only clear zones. Level 10 removes tall
  canopy from the launch camera volume while retaining the low boundary row;
  movement, objective and collision rules do not change there.
- The extra sky dome and cloud field are removed because
  `setupForestEnvironment` already owns both.
- Existing landmarks, NPC colliders, gift state machine, trail, bounds and
  rewards remain unchanged.

## Player impact

The child can walk directly from the basket to the indicated friend and can see
why the level ends: a dense tree ring surrounds the clearing. The camera starts
on Barsik instead of inside a random canopy, while a low tree row still marks the
rear edge. Visible props still block movement; the removed blocker was only the
invisible corridor.

## Risks and verification

- The clearing could read as empty or expose the world edge. Verify portrait and
  desktop composition at spawn, hub, outer friends and exit.
- Random props could obstruct a direct objective route. Complete all five
  `basket → remember → gift → farewell` cycles using only movement and the
  interaction key, then collect the map.
- The visual camera gap must not become a walkable escape. Confirm movement is
  still clamped by the arena and visible tree boundary.
- Record renderer calls, visible triangles, geometries and textures on the
  normal-phone quality tier; do not accept a regression beyond the Season 1
  guardrails.

## Verification evidence

- Full 1440×900 keyboard route used only WASD and `E`: 21/21 guide objectives,
  five memories, five gifts, five farewells and the exit map all completed;
  browser console and page errors were empty.
- Real 390×844 touch input moved Barsik `8.33 m` with the joystick, exposed the
  basket action, collected the first gift and rotated the camera by `0.71 rad`.
  The joystick retained `16 px` left and `24 px` bottom insets.
- Normal-phone start frame: `168` renderer calls, `127,866` visible triangles,
  `172` geometries and `22` textures. The whole scene contained `341`
  renderables and `136` shadow casters; all release-frame numbers remain inside
  the Season 1 mobile guardrails.
