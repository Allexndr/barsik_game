# ADR 020 — Level 0 yurt entry contract

**Status:** accepted · 2026-08-13
**Scope:** Level 0's outdoor river, yurt shell, porch and exterior-to-interior
transition. The canonical story order and shared input/HUD systems remain
unchanged.

## Context

The authored route is `dombra → lanterns → river → felt → yurt → kui`, but
five implementation details contradicted it:

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
4. The third lantern was visually on the near bank, but its centre sat on the
   river feather only `0.20 m` above the water. A direct objective-led approach
   could enter the trench or stall on its steep side before interaction range.
5. The first marked stone started sinking in its first loaded frame. A mobile
   child who landed, centred their thumb and aimed the next hop took off from a
   lower surface and repeatedly missed an otherwise reachable fifth stone.

## Decision

1. Before all lanterns are lit, stepping stones rest visibly below the water
   line and do not count as platforms. Water recovery is active throughout
   outdoor play. It returns an early attempt or crossing miss to the near bank,
   and post-crossing exploration to the far bank, without removing progress.
   The third lantern sits on the dry near-bank shelf at `(-1.90, -10.50)`, two
   metres before the conservative channel boundary; its sampled ground is
   `1.76 m` above the water rather than the former `0.20 m` edge clearance.
2. Every platform's support radius equals its visible top. Ordinary stones are
   `1.35 m`; the turn/catch stones are visibly `1.50 m`. Their final layout
   still leaves `0.167–0.467 m` of real water between every adjacent pair, and
   the development reachability check reports an error if supports overlap, so
   walking the centre line without jumping cannot complete the crossing.
3. Three marked stones react to Barsik's weight without creating a hidden
   timing test: they wait `1.20 s`, then settle at most `0.14 m`. Their normal
   top is `0.30 m` above the water, hence the lowest top remains visibly dry at
   `0.16 m`. They float back when unloaded. The interaction teaches aim and
   jump; it never removes the take-off surface beneath a child who stops to
   line up the next hop.
4. The exterior felt cylinder has a real front opening. Its collision follows
   the visible curved wall but leaves the same opening; a closed, visible door
   leaf owns the only threshold collider. The gardener and dombra use separate
   footprints matching their visible bodies, leaving the centre of the porch
   clear.
5. The door ring is a real interaction target. While earlier objectives are
   active, using it explains the current prerequisite and changes no state.
   Nearby lanterns or felt panels retain interaction priority.
6. Completing all three felt repairs changes the objective to the entrance and
   lights the ring. Only an explicit `E`, `Space` or mobile paw action removes
   the leaf collider, opens the visible leaf under blackout and transitions to
   the existing yurt interior. Proximity alone never changes location.
7. The rear felt panel remains intentional: mending is one readable lap around
   a physical building. The child may walk around the yurt wherever visible
   architecture permits; there is no quest wall behind it.

## Consequences

- The first level cannot be shortened by walking through water before the
  river beat, and the feedback says why the route is not ready.
- The lantern route ends on dry ground, and the crossing preserves visible
  water gaps while removing its hidden reaction timer.
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
- Desktop `1200×754`, normal input only: all three lanterns; walking-only
  negative crossing recovered to the near bank; `12/12` explicit hops passed
  on attempt 1 with `0` crossing resets; dry tangent lap; all three panels;
  explicit `E` door action; three kui rounds; outro. Elapsed `252.62 s` under
  SwiftShader; page/console error count `0`.
- Mobile `390×844`, real touch joystick/action only: all three lanterns;
  walking-only negative crossing recovered; a genuine first-stone miss was
  safely retried; all `12/12` hops then passed; dry tangent lap; all three
  panels; explicit touch door action; three kui rounds; outro. Elapsed
  `171.79 s`; page/console error count `0`, contract failure count `0`.
- A separate source-frozen mobile crossing run passed `12/12` on attempt 1
  with `0` resets. The full-route retry above is retained as positive evidence
  that the no-fail recovery works, not hidden to make the run look perfect.
- All successful routes used normal browser input and read scene state only for
  steering/assertions; neither called `devTeleport`, scene input methods or a
  state/store setter.
