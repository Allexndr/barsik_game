# ADR 014 — City empty state and scene-update boundary

**Status:** accepted

**Date:** 2026-08-11

**Scope:** `CityScreen` and its CityScene integration boundary.

## Context

An empty City told the child to find a friend, but its only route to do so was
the generic meta-screen footer after the rest of the page. On a desktop it
could be below the first frame; on a phone it competed with a generic action
instead of naming the immediate goal. The progress card also retained the
older violet reward-panel treatment despite the Season 1 paper/ink/cyan/pear/
mint direction.

More importantly, the `residents` value was both the translated React card
copy and the input to `CityScene.setCity`. Switching language rebuilt every
town object and restarted asynchronous model placement. Changing an outfit did
the same, although `CityScene.setOutfit` already exists specifically to
re-dress Barsik without rebuilding the town.

## Decision

1. An empty City owns one in-content primary action: **«Найти первого друга»**
   (and its Kazakh equivalent). It calls `setActiveTab('travel')` directly and
   replaces, rather than duplicates, the generic footer CTA for this state.
2. The City viewer has a desktop height cap that preserves the CTA inside the
   first frame without removing the 3D town as the screen's visual hero.
3. City progress and empty-state surfaces use local paper/ink/cyan/pear/mint
   tokens. No violet progress fill, wash, or selected state remains in
   `CityScreen.css`.
4. React maintains two representations of friends:
   - language-aware `residents` for cards and dialogue; and
   - an ID-based stable `sceneRoster` for the Three scene.

   `CityScene.setCity` runs only when the ordered roster IDs change. It uses
   the current outfit when a roster rebuild is genuinely necessary. An
   outfit-only update calls `CityScene.setOutfit`; a language-only update only
   repaints React copy.
5. The resident-card close control is a 44×44px touch target with a visible
   keyboard focus ring. Existing scene, `ResizeObserver`, and pick-handler
   effects retain their matching teardown paths.

## Consequences

- A first-time child gets an unambiguous, visible next step instead of a city
  that feels complete but has no reachable purpose.
- Russian and Kazakh resident cards remain fully translated without the cost
  or visual flicker of recreating the WebGL city.
- Wardrobe changes only re-dress Barsik. A later CityScene implementation may
  use resident names for 3D labels, but must add an incremental label-update
  method rather than making language part of the roster rebuild key.
- The City CSS is scoped locally; this does not silently migrate legacy violet
  styles in unrelated screens.

## Verification

- `npm run type-check`
- `npm run lint`
- `npm run build` followed by restoration of tracked `dist`
- `git diff --check`
- Fresh 390×844 and 1440×900 City-empty browser passes: CTA visible in the
  viewport, CTA changes the active mobile tab to «Путешествие», and no console
  or page errors.
- Fresh 390×844 resident-card pass: Russian-to-Kazakh switch changed name,
  role, description and meeting text; no new `.glb` resource entries appeared;
  close target measured 44×44px.

## Follow-up

The City visual audit may be implemented later as a separate kit package.
Do not put a CityScene geometry, AssetKit, HUD, or navigation-information
architecture rewrite into this small reliability change.
