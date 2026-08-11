# ADR 012 — Forest wind-grass profile

**Status:** accepted · 2026-08-11
**Scope:** the shared Fruit Forest setup used by Levels 1–3 and 5–10;
`WindGrass` compatibility for direct callers. Level 0 is deliberately
unchanged.

## Context

The legacy shared field applied `convertSRGBToLinear()` to a `THREE.Color`
that Three's colour management had already converted to its linear working
space. Through the final ACES/output pass, default grass therefore read as
near-black, isolated pins — especially on 390×844. It also used tall,
single-card blades, so fixing colour alone made the field brighter but did not
give a child-friendly near-ground silhouette.

Level 0 already has an authored managed-colour profile, a deliberate
mobile/desktop count and its own blade shape. It is the Season 1 visual
benchmark, not an experimental default to be recoloured.

## Decision

- Make `managed` the default path in `createWindGrass`; retain `legacy` only
  as an explicit compatibility option for an intentionally older scene.
- Give `setupForestEnvironment()` one reusable Fruit Forest profile:
  short 0.16–0.38 m leaves, 1.45 horizontal width, and two crossed leaves per
  instanced tuft. The mobile palette is lifted separately from the desktop
  palette because the compact mobile quality path otherwise collapses the
  field toward black at phone pixel density.
- Keep one `InstancedBufferGeometry`, one `ShaderMaterial`, and one grass
  mesh. No texture, network request, collider, path reservation or clear-zone
  rule changes.
- Use 3,200 mobile or 8,000 desktop tufts. At full placement this is
  6,400/16,000 grass triangles, only +1,400/+2,000 from the old 5,000/14,000
  single-card field, with no extra grass draw. Reserved paths and water can
  only reduce the actual count.
- Merge every caller's explicit `grass` configuration *after* the shared
  defaults. Level 0 therefore retains its own colours, counts, heights,
  crossed-leaf count and `colorMode: 'managed'`; its default width remains
  exactly `1`.

## Verification

Live Vite checks opened and played Levels 1, 2, 3 and 10 at **390×844** and
**1440×900**, including a camera sweep where needed to show the field. There
were no console errors. The former L10 black needle carpet became a green,
short-tuft field without grass on the reserved spawn ring or route.

With `?mission=10&perf=1` on the local QA host, the final whole-frame samples
were:

| View | Draw calls | Triangles | Geometries | Textures | avg / p5 FPS |
|---|---:|---:|---:|---:|---:|
| 390×844 mobile/medium | 253 | 224,580 | 175 | 21 | 120.1 / 104.2 |
| 1440×900 desktop/high | 381 | 307,252 | 239 | 61 | 119.8 / 95.2 |

These are host smoke measurements, not phone-device claims. They exceed the
whole-frame Level 10 guardrails defined in ADR 009 because of the pre-existing
scene/asset load; this grass package adds no draw call and is not treated as a
resolution of that separate Level 10 budget issue. The focused Level 10
camera/tree/LOD package remains responsible for bringing the full scene under
its frame budget.

## Consequences

Forest levels now share an intentional, auditable grass look rather than a
hidden colour-space bug. Future biome kits must supply their own profile or
pass explicit grass options; they must not restore a double colour conversion
to make a screenshot darker.
