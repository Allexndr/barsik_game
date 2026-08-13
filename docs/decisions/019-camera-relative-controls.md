# ADR 019 — camera-relative controls and unrestricted orbit

**Status:** accepted · 2026-08-13

## Context

All playable Season 1 scenes except the standalone City use
`BaseLevelScene`. Their camera already accepted pointer drag, but its yaw was
clamped to ±135 degrees, leaving a locked 90-degree sector. Movement then used
local WASD/joystick values directly as world X/Z: after looking behind Barsik,
forward still moved toward world north instead of into the view.

The same input layer also used `E` both for interaction and right camera orbit.
At a yurt door, one press could rotate the view while activating the entrance.
Desktop CSS had a separate cascade bug: a late `.m0-jump { display: flex }`
overrode the earlier precise-pointer hide rule and rendered a phone action
button beside keyboard controls.

## Decision

- Keep camera orbit as a pure render transform around Barsik, with no normal
  play auto-recentre and no yaw clamp. Mouse/touch pointer drag owns orbit;
  keyboard `E` is interaction only and Q/E keyboard orbit is removed.
- Transform normalized local input by the current orbit yaw before world
  bounds, collision resolution and hero facing. Level 12's authored ice
  inertia uses the same transformation before acceleration.
- Track the pointer ID that owns look. A second touch cannot hijack an active
  look gesture, and touches starting in the left 32% remain available to the
  joystick.
- Show one RU/KK camera-look affordance after the loading gate becomes
  interactive. It has no pointer hit area, uses device-specific wording, and
  disappears/records completion only after the scene reports a real owned
  camera drag (a joystick drag cannot dismiss it). The separate
  `RotateHint` remains an orientation suggestion, not a camera tutorial.
- Put the precise-pointer joystick/jump hide after all base/theme display
  declarations so desktop reliably renders keyboard/mouse controls only.

## Consequences

`BaseLevelScene.updateMovement` changes player intent for L0–L11 and L13–L16;
the special Level 12 ice loop opts into the same contract explicitly. Authored
camera positions, phase cinematics, collisions and L0's yurt camera safe-volume
hook are unchanged. A player can keep any heading through a full turn, and W or
joystick-forward now follows that heading.

## Verification

- Desktop L0: pointer orbit measured +6.63 rad left and −6.63 rad right in one
  drag; W movement measured (x,z) deltas 0° `(0,-0.8)`, 90° `(-0.64,0)`,
  180° `(0,+0.8)`.
- Desktop L0 and shared MissionScreen: camera hint visible after the ready
  gate, `pointer-events:none`, then removed by a real mouse drag; computed
  joystick and jump display are both `none`.
- 390×844 L0: swipe set yaw to 0.77 rad; joystick-forward then moved
  `(-0.90,-0.91)` in that camera heading without taking look ownership.
  Joystick is 101 px with 16/24 px left/bottom margins; jump is 78 px with
  20/28 px right/bottom margins. No browser errors.
- 390×844 `?mission=0&l0=inside`: six hard swipes reached target yaw 9.0 rad;
  final rendered camera stayed within the yurt safe volume, no browser errors.
- L4 walking and L12 ice both moved toward the reversed view at yaw π.
  Hero NDC framing was invariant at yaw 0/π in L0, L4 and L12.
- `npm run type-check`, `npm run lint`, `npm run build`, `git diff --check`.
