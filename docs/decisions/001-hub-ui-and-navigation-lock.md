# ADR 001 — Hub UI and navigation lock

- **Status:** accepted
- **Date:** 2026-08-11
- **Owners:** product owner + release owner
- **Applies to:** Welcome, player hub, map, Friends, City, Shop, Rating and QR screens

## Decision

`design.md` is the single source of truth for marketing and hub UI. New hub work
uses the Barsik Hum system: cream paper surfaces, cool ink, pear as the primary
call-to-action, cyan for navigation and coral only for a single accent. New
purple/violet gradients and glassmorphism are prohibited.

On phones the persistent navigation contains four destinations:

1. Journey
2. Friends
3. City
4. More

Shop, Rating and Chest remain reachable from More. They are secondary until
their product promises are fully implemented and must not displace the next
adventure in the child’s thumb bar.

## Why

The previous navigation made six destinations equally important on a 390 px
phone, producing 9.28 px labels and 54 px-wide items. It obscured the central
game loop: find the next story, help a friend, see the collection grow.

The product is a browser story-adventure for children 5–12, not a catalogue of
unrelated meta-screens. The app hub should always make the next adventure
obvious. Level HUD is intentionally not part of this decision: changing in-game
controls needs its own visual and playtest contract.

## Constraints and evidence

- All persistent mobile controls target at least 44×44 CSS px. This exceeds the
  WCAG 2.2 AA 24×24 minimum and follows Apple’s 44×44 pt touch guidance.
- Existing purple PNG assets may stay until they are replaced; the surrounding
  UI must not multiply that legacy language.
- This decision does not remove Shop, Rating or QR functionality; it only
  changes hierarchy.

## Consequences

- New hub components must use tokens in `src/index.css`, rather than raw violet
  values or ad-hoc gradients.
- Every navigation change receives a manual 390×844 mobile check plus desktop
  smoke check before release.
- A later ADR must define the shared level HUD before broad HUD edits begin.
