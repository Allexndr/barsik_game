# ADR 003 — Level 0 yurt: constrain the rendered camera, not just the player

**Status:** accepted · 2026-08-11

## Context

Level 0 uses the shared free-look orbit. The base scene rotates the camera
around Barsik immediately before rendering and restores the regular follow
camera afterwards. The yurt previously clamped only the regular follow pose,
so a hard Q/E or touch orbit could put the *rendered* lens through the felt
wall or close enough to the low eave for the top of the frame to reveal the
hidden exterior.

This is a room-specific boundary. Applying it to the shared follow camera
would change the feel of wide outdoor levels.

## Decision

- Add a default no-op `beforeRenderCamera()` hook to `BaseLevelScene` and call
  it after the temporary orbit transform, immediately before each render.
- In `Level0Scene`, enable that hook only while `insideYurt` is true.
- Keep the final lens inside a conservative safe volume: three and a half
  units inside the floor radius and at least 1.25 units below the roof curve.
  The extra volume protects the full 46–54° mobile/desktop frame, not merely
  the camera origin.
- Expose `?mission=0&l0=inside` in development builds only for repeatable
  camera QA. It is dead code in a production Vite build.

## Consequences

Near the yurt perimeter the camera may move closer to Barsik. That is an
intentional, preferable trade: a tighter interior shot retains the magical
room, whereas a wall/roof leak exposes the implementation and breaks the
story transition. Outdoor orbit behaviour remains unchanged.

## Verification

- `npm run type-check`
- `npm run lint`
- `npm run build`
- Fresh mobile 390×844 and desktop 1440×900 runs of
  `?mission=0&l0=inside`, including repeated hard touch drags and Q/E orbit.
- Verify no console errors and no unintended outdoor forest/wall clip; the
  deliberately open shanyrak may still show sky.
