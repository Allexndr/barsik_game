# ADR 009 — Local render-performance telemetry

**Status:** accepted · 2026-08-11
**Scope:** every `BaseLevelScene` mission, City and the wardrobe avatar preview.

## Context

Season 1 already had a `?fps=1` console sampler, but it did not reveal why a
frame was slow. A visual change could add hidden shadow work, draw calls or
textures and still look fine on the developer machine. The art contract also
has a *visible-mesh* budget, while Three's renderer counters describe the
whole GPU frame, including shadows and desktop post-processing. Treating those
as the same number would make a healthy scene look like a false regression.

## Decision

Use a local, opt-in QA probe:

```text
http://127.0.0.1:5179/?mission=0&perf=1
http://127.0.0.1:5179/?tab=city&perf=1
```

- It exists only in a Vite development build. A production build does not
  expose `window.__perf`; adding `?perf=1` in production changes nothing.
- It mounts no DOM, makes no network request and collects no player identity,
  progress, user agent or fingerprint. Samples live only in the open page and
  browser console.
- A sample appears once per stable ten-second window as
  `[perf:<scene>] …`; DevTools can additionally read
  `window.__perf.latest()` or `window.__perf.all()`.
- The sampler resets `renderer.info` once before an application frame and
  reads it after the complete level render. It therefore counts shadow work
  and, on desktop, composer passes. `renderer.info.autoReset` is restored on
  scene disposal.
- Existing `?fps=1` remains available for compatibility. `?perf=1` includes
  its own avg/p5 FPS sample, so QA normally needs only the latter.

## Two budget lenses

The visible-mesh contract in
[`SEASON_1_ART_PIPELINE.md`](../SEASON_1_ART_PIPELINE.md#4-performance-contract)
remains the asset-integration target: no generated model is accepted merely
because its aggregate frame passes. This probe adds a separate *whole renderer
frame* regression guard:

| Test profile | Render quality / viewport | Calls | Triangles | Geometries | Textures | p5 FPS |
|---|---|---:|---:|---:|---:|---:|
| Low phone | `?quality=low`, 360×800 | ≤320 | ≤160k | ≤260 | ≤32 | ≥30 |
| Normal phone | `?quality=medium`, 390×844 | ≤340 | ≤180k | ≤280 | ≤48 | ≥45 |
| Desktop/high | `?quality=high`, 1280×720 or larger | ≤400 | ≤260k | ≤320 | ≤64 | ≥55 |

These guardrails include the actual renderer's shadow and post-process work;
they are intentionally not substituted for the lower visible-mesh targets.
Any new scene that exceeds a cell is a release-blocking performance review:
first remove duplication / over-dense assets / needless shadow casters, then
consider LOD or pixel-ratio changes. Do not silently raise the cap.

## QA protocol

1. Start the local dev server and open a direct mission URL with `perf=1`.
2. Wait for the loading gate, press `Играть`, then wait **at least 10 seconds
   after the intended assets are visible**.
3. Save the concise console line and compare it to the profile above. Record
   all counts plus avg/p5 FPS in the visual package's PR or change log.
4. Exercise the intended route/camera once, because a first frame can omit
   late-loaded props. Repeat after a scene transition for disposal leaks.
5. Run the same pass at 390×844 and desktop. A browser viewport emulation is a
   smoke test, not a substitute for an actual low-end phone.

## Initial L0 baseline (local QA host, not a device benchmark)

| View | Sample | Result |
|---|---|---|
| 390×844, mobile/medium | 291 calls, 124,192 triangles, 219 geometries, 28 textures; avg/p5 **87.6/73.5 FPS** | Inside normal-phone frame guard. |
| 1440×900, desktop/high | 328 calls, 154,897 triangles, 232 geometries, 41 textures; avg/p5 **94.2/69.0 FPS** | Inside desktop frame guard. |

The host is useful for catching deterministic count regressions; its FPS must
not be presented as an iPhone/Android performance claim.

## Consequences

- Every premium-art package can now prove that its claimed visual improvement
  did not add unbounded rendering cost.
- Level 0's current draw-call baseline is already high compared with its
  visible-mesh budget, so instancing/LOD work remains an optimisation priority
  rather than a metric that can be ignored.
- There is no production analytics, dashboard or user-facing performance HUD
  to maintain or to distract a child from the game.
