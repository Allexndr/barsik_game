# BARSIK LAND — change history

This is the human-readable counterpart to Git history. It records what changed,
why it changed, how it was checked and which branch owns it. It is deliberately
short: implementation detail remains in the commit and linked ADR.

## Unreleased — Season 1 premium pass

### Production deployment — 2026-08-11 12:46 Asia/Almaty

- **Source:** integration commit `d966215`.
- **Deployment:** `dpl_Dks6AeMyYscvATkt2JR9syjj6Pmv` →
  `https://barsik-game.vercel.app`.
- **Release check:** production first-play on a 390×844 viewport: onboarding →
  Level 0 arrival gate → `Играть` → live WebGL canvas; no console errors.
- **Rollback:** use the immediately preceding ready production from Vercel
  deployment history, not an arbitrary old preview. Record its URL at the
  moment of any rollback.

### Player-facing changes

- Mobile hub navigation prioritises Journey, Friends and City; Shop, Rating and
  Chest are available from More.
- Hub surfaces follow the cream / cyan / pear Barsik Hum system rather than
  adding violet gradients or glass panels.

| Commit | Scope | Why / user impact | Verification |
|---|---|---|---|
| `95c1296` | Hub navigation | Six equal mobile tabs hid the next adventure among secondary screens. Hub navigation now leads with Journey, Friends and City and moves the rest into More. | Phone/desktop navigation checks; type-check, lint, build. See ADR 001. |
| `1932ace` | Level 0 start gate | The scene could begin beneath the loading card, so a child could miss the first story beat. `Играть` now starts the actual story timeline. | Fresh mobile ready screen held before starting; type-check, lint, build. |
| `aff1389` | Level 0 arrival/HUD | Purple/glass UI, emoji and a second pixel game fought the soft 3D world. L0 now has a calm paper/lantern entry and scoped cream/pear/cyan/mint HUD without repainting all missions. | Mobile 390×844 start/HUD flow, accessibility state, console check; type-check, lint, build. See ADR 002. |
| `0e3fe9a` | Level 0 yurt camera | A temporary free-look orbit happened after the former yurt clamp and could show the hidden exterior. The final rendered camera pose now respects a conservative yurt safe volume. | Repeated touch orbits at 390×844 and Q/E at 1440×900; no console errors; type-check, lint, build. See ADR 003. |
| `68f53d9` | Season 1 art contract | The team needed one practical definition of “premium, solid and mobile-safe” before replacing assets. | Repository-grounded hero/environment/asset audit; `git diff --check`. See `SEASON_1_ART_PIPELINE.md`. |
| `e915dba` → `7c3ed2c` | Qualified Barsik rig | A static model slides and a raw generated model can overload phones. The runtime will take only a qualified rigged Barsik, otherwise it keeps the playable avatar. | Type-check, lint, build, GLB probe and L0 390×844 default/avatar/rigged fallback checks. See ADR 004. |
| `bd3f2b2` → `9245aa2` | Level 0 forest floor | The terrain had relief but still read as a flat coloured field. L0 now gets scoped macro detail, a worn path/green verge and one-draw-call grass tufts. | Type-check, lint, build; live 390×844 and 1440×900 checks without console errors. See ADR 005. |
| `a720d6b` → `aba1448` | Season 1 forest hygiene | Mission 1 used a legacy flat plane and Levels 2/3/10 duplicated environment systems. M1 keeps its level gameplay route while gaining shared horizon/grass; duplicate sky, clouds and fireflies were removed. | Type-check, lint, build; 390×844 smoke for missions 1/2/3/10 with no console errors. See ADR 006. |
| `fea1fd3` | Shared mission HUD | Levels 1–16 still looked like a different violet/glass product beside Level 0. Their shared HUD now uses tactile cream/cyan/pear/mint chrome while preserving controls and Level 0's isolated reference variant. | Type-check, lint, build; L1 390×844 + 1440×900 screenshots; L1/L11 dialogue and pause/resume smoke without console errors. See ADR 007. |

### Known follow-up

- Level 10 mobile begins with a tree canopy occluding too much of the camera.
  This is documented in ADR 006 and deliberately stays out of the environment
  cleanup package; it needs a focused camera/tree-layout pass and screenshot
  approval rather than a hidden one-line move.

## Required entry format

For every implementation branch, add one row after its commit is pushed:

```text
| `<short-sha>` | <scope> | <why and visible player impact> | <commands + device/flow checks> |
```

Also add a focused ADR whenever the change establishes a reusable behaviour,
quality budget or visual-system decision. Production deployments must include
the integrated commit SHA, Vercel URL, environment, time, smoke-test result and
known follow-ups in their release note.

## Release safety

- Generated `dist`, raw high-poly exports and credentials are never committed.
- A preview can validate one atomic package; production receives only an
  integrated branch that has passed the device/quality matrix.
- GitHub/Vercel access uses the workstation's existing authenticated sessions;
  pasted tokens must be revoked/rotated, never copied into commands or files.
