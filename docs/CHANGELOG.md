# BARSIK LAND — change history

This is the human-readable counterpart to Git history. It records what changed,
why it changed, how it was checked and which branch owns it. It is deliberately
short: implementation detail remains in the commit and linked ADR.

## Unreleased — Season 1 premium pass

### Production deployment — 2026-08-11 13:33 Asia/Almaty

- **Source:** integration commit `88e5b6e`.
- **Deployment:** `dpl_HX6chqdsF2ZdaXN2dYh3PSQHG35o` →
  `https://barsik-game-d6s7men1b-allexndrs-projects.vercel.app` →
  `https://barsik-game.vercel.app`.
- **Release gate:** integrated type-check, lint and production build passed;
  the production bundle excludes the local `?perf=1` probe. Local mobile
  first-play/HUD and Level 10 launch smokes passed before promotion.
- **Rollback:** previous ready production
  `dpl_Dks6AeMyYscvATkt2JR9syjj6Pmv`; use Vercel deployment history rather
  than an arbitrary preview if an immediate rollback is required.

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
| `ccc28e4` | Level 10 launch framing | The rear forest cap grew into the follow camera, so the first playable shot could be all trunk/canopy. Level 10 now reserves a visual-only camera bay while retaining its route and collision rules. | Type-check, lint, build; repeated 390×844 starts, 1440×900 start/movement smoke and console checks. See ADR 008. |
| `ec0bc82` | Local render telemetry | Art changes could look fine on one machine while adding hidden calls, triangles or texture work. Dev QA can opt into `?perf=1` whole-frame samples without player UI, network analytics or production code. | Type-check, lint, build; production bundle DCE check; local L0 telemetry smoke plus source mobile/desktop, City and wardrobe checks. See ADR 009. |
| `3dc1a60` | Level 0 teaching feedback | A muted player saw a stale dombra proximity value; repeated lanterns reloaded one model; a wrong dombra note changed the phrase being taught. HUD feedback now updates at visible percentage changes, lanterns clone one loaded template, and a retry repeats the same phrase. | Type-check, lint, build; source mobile follow and desktop yurt retry checks, plus integrated L0 smoke without console errors. See ADR 010. |
| `61ae675` | Winter biome boundary | Ice levels could inherit a green forest wall and L13–L15 could start behind a tree cap. The shared enclosure now selects a low-cost snow boundary, preserves forest behaviour elsewhere, and reserves visual-only opening bays for the affected cameras. | Type-check, lint, build; fresh 390×844 L11–L16 and 1440×900 L13–L15 live checks with no console errors; local medium renderer samples: L13 179,226 and L15 169,868 triangles. See ADR 011. |
| `f5ac797` | Forest wind-grass profile | The default grass received a second colour-space conversion and looked like dark needle scratches. Forest levels now share short crossed green tufts in one instanced draw, while Level 0 retains its authored profile. | Type-check, lint, build; integrated 390×844 L1/L10 and 1440×900 L10 live checks without console errors. See ADR 012; L10’s broader asset triangle debt remains separately recorded. |

### Known follow-up

- Keep screenshot review when new forest caps or camera profiles are added;
  the Level 10 launch-camera occlusion is resolved by the focused layout pass.

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
