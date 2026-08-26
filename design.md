# Design — Barsik Land

Locked design system for the Barsik kids adventure game UI.
Every marketing / hub screen redesign reads this file first.
Do not regenerate per page — amend this file when the system grows.

## Genre
playful (kids adventure · family · soft-tactile · bilingual RU/ҚАЗ)

## Macrostructure family
- Marketing (Welcome): **photographic journey** — full-bleed AI hero · brand photo meet band · zig-zag world rows · compact how-to · parents · CTA. No 3-equal feature card grid.
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
- **Banned:** purple/violet gradients, italic display headers, glassmorphism, gradient text, emoji-as-ornament replacing icons, indigo accents, decorative left accent stripes, 3-equal icon feature cards.
- **Keep on Welcome:** AI landing hero (`landing_hero_*.webp`) + brand AI photos (`brand/barsik_*.jpg`).

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

## Voice
Warm, direct, specific. RU/ҚАЗ always paired in product copy. No invented metrics.
