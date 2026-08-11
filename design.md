# Design — Barsik Land

Locked design system for the Barsik kids adventure game UI.
Every marketing / hub screen redesign reads this file first.
Do not regenerate per page — amend this file when the system grows.

## Authority
- This file is the single visual source of truth for **marketing and hub UI**.
- `ART_DIRECTION.md` governs the 3D world, character and environment. Its
  sections 2 and 3b align with this UI system; its old violet/glass snippets
  are historical references, not instructions for new UI.
- Level HUD is deliberately a separate future migration. Do not change it as a
  side-effect of a hub/navigation task.

## Genre
playful (kids adventure · family · soft-tactile · bilingual RU/ҚАЗ)

## Macrostructure family
- Marketing (Welcome): **photographic fold** — full-bleed hero image + left copy band; worlds as tinted accent cards; parents band; single CTA close.
- App hub (map / friends / city / shop): **workbench** — sticky nav + one job per screen; no marketing hero.
- Level HUD: keep existing MissionScreen chrome (do not redesign mid-session).

## Theme — Barsik Hum (catalog Hum adapted for soft-3D plush brand)
- `--color-paper`     oklch(97% 0.012 95)   /* cream */
- `--color-paper-2`   oklch(94% 0.016 95)
- `--color-ink`       oklch(22% 0.02 250)   /* cool near-black — never pure black */
- `--color-ink-2`     oklch(42% 0.03 250)
- `--color-accent`    oklch(86% 0.18 95)    /* pear — primary CTA */
- `--color-accent-2`  oklch(66% 0.18 235)   /* sky-cyan — links / Land chip */
- `--color-accent-3`  oklch(68% 0.22 35)    /* warm coral — single pop */
- `--color-mint`      oklch(72% 0.12 150)   /* forest world */
- `--color-ice`       oklch(78% 0.08 230)   /* ice world */
- `--color-focus`     oklch(55% 0.16 235)
- **Banned:** purple/violet gradients, italic display headers, glassmorphism, gradient text, emoji-as-ornament replacing icons.

## Typography
- Display: **Baloo 2** 700/800 (already shipped; rounded kids display). Style: **roman only** — never italic headers.
- Body: **Nunito** 600/700
- Mono labels: system-ui tabular for counters
- Tracking on display: `-0.03em`

## Interaction
- Primary CTA: Hum **push button** (solid colour edge + press-down on `:active`). One pear push per primary moment.
- Secondary: soft lift / outline cyan.
- Motion: short hover lift; honour `prefers-reduced-motion`.
- Touch targets ≥ 44×44 CSS px.

## Brand rules (product)
- Brand name **BARSIK** must dominate first viewport (hero-level), not only nav.
- First viewport budget: brand · one headline · one support line · CTA group · one dominant image.
- Soft-3D plush art direction (see `ART_DIRECTION.md`); map stays portrait-centred on desktop.

## Hub navigation
- Mobile has four persistent destinations only: **Journey · Friends · City · More**.
- The game loop comes first: Journey is the default and primary destination.
- Shop, Rating and Chest stay reachable under More until their product promises
  are complete; they must not compete with the next adventure in the thumb bar.
- Every persistent mobile navigation target is at least 44×44 CSS px; labels
  remain readable at normal phone viewing distance.

## Voice
Warm, direct, specific. RU/ҚАЗ always paired in product copy. No invented metrics.
