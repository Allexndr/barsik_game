# ADR 020 — Level 0 yurt entry contract

**Status:** accepted · 2026-08-13
**Scope:** Level 0's outdoor river, yurt shell, porch and exterior-to-interior
transition. The canonical story order and shared input/HUD systems remain
unchanged.

## Context

The authored route is `dombra → lanterns → river → felt → yurt → kui`, but
three implementation details contradicted it:

1. Water recovery ran only while the phase string was `crossing`. Before the
   third lantern, the hero could walk along the river bed, reach the yurt and
   encounter later quest props out of order.
2. The yurt was a closed cylinder with one full circular collider. Its
   apparent entrance was a red box placed over that wall, so the visual door
   and the physical building both denied the entrance that the story promised.
3. Reaching a radius around the apparent door automatically teleported the
   hero. There was no closed-door response, proximity action or explicit
   consent to change location. A combined NPC/dombra collision footprint also
   extended across the porch, creating a second invisible stand-off.

## Decision

1. Before all lanterns are lit, stepping stones rest visibly below the water
   line and do not count as platforms. Water recovery is active throughout
   outdoor play. It returns an early attempt or crossing miss to the near bank,
   and post-crossing exploration to the far bank, without removing progress.
   Each platform's support radius equals its visible `1.35 m` top: adjacent
   support discs leave real water between them, so walking the centre line
   without jumping cannot complete the crossing.
2. The exterior felt cylinder has a real front opening. Its collision follows
   the visible curved wall but leaves the same opening; a closed, visible door
   leaf owns the only threshold collider. The gardener and dombra use separate
   footprints matching their visible bodies, leaving the centre of the porch
   clear.
3. The door ring is a real interaction target. While earlier objectives are
   active, using it explains the current prerequisite and changes no state.
   Nearby lanterns or felt panels retain interaction priority.
4. Completing all three felt repairs changes the objective to the entrance and
   lights the ring. Only an explicit `E`, `Space` or mobile paw action removes
   the leaf collider, opens the visible leaf under blackout and transitions to
   the existing yurt interior. Proximity alone never changes location.
5. The rear felt panel remains intentional: mending is one readable lap around
   a physical building. The child may walk around the yurt wherever visible
   architecture permits; there is no quest wall behind it.

## Consequences

- The first level cannot be shortened by walking through water before the
  river beat, and the feedback says why the route is not ready.
- The yurt now obeys one geometry/collision contract: felt stops the hero,
  the opening is visibly open space, and the door leaf is the closed blocker.
- Entry behaves like an authored doorway rather than an automatic trigger.
  The added action is local to Level 0 and reuses the existing desktop/mobile
  input path, so later missions and the shared HUD API are unaffected.
- The curved shell is approximated with small static collision points. Their
  full side/rear tangent must remain part of hands-on QA if the yurt radius,
  doorway angle or player radius changes.

## Verification

- `npm run type-check`
- `npm run lint -- --max-warnings=0`
- `npm run build`
- `git diff --check`
- Desktop 1440×900 normal-input route: first two lanterns, early water attempt,
  third lantern, an attempted all-centres walk **without** jumping (must recover
  to the near bank), every stepping stone with explicit jumps, early closed
  door, tangent wall lap, all three felt panels including the rear, explicit
  entry action and kui completion.
- Mobile 390×844 normal-input check: virtual joystick, all lantern actions,
  early water recovery and the walking-only negative crossing were verified.
  The local two-thumb driver repeatedly reached the first four visible support
  discs (including the first sinking stone, sampled at `1.19–1.30 m` from its
  `1.35 m` centre) but did not produce one deterministic 12-hop run after the
  support-radius correction. The combined canonical mobile driver must repeat
  the full crossing and remaining paw-button route after integration; this is
  an explicit merge gate, not claimed as passed here.
- The successful desktop route and completed mobile checks used normal input
  without state mutation or `devTeleport`; their captured console/page error
  arrays were empty.
