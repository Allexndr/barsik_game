# BARSIK LAND — change history

This is the human-readable counterpart to Git history. It records what changed,
why it changed, how it was checked and which branch owns it. It is deliberately
short: implementation detail remains in the commit and linked ADR.

## Unreleased — Season 1 premium pass

| Commit | Scope | Why / user impact | Verification |
|---|---|---|---|
| `1932ace` | Level 0 start gate | The scene could begin beneath the loading card, so a child could miss the first story beat. `Играть` now starts the actual story timeline. | Fresh mobile ready screen held before starting; type-check, lint, build. |
| `aff1389` | Level 0 arrival/HUD | Purple/glass UI, emoji and a second pixel game fought the soft 3D world. L0 now has a calm paper/lantern entry and scoped cream/pear/cyan/mint HUD without repainting all missions. | Mobile 390×844 start/HUD flow, accessibility state, console check; type-check, lint, build. See ADR 002. |
| `0e3fe9a` | Level 0 yurt camera | A temporary free-look orbit happened after the former yurt clamp and could show the hidden exterior. The final rendered camera pose now respects a conservative yurt safe volume. | Repeated touch orbits at 390×844 and Q/E at 1440×900; no console errors; type-check, lint, build. See ADR 003. |
| `68f53d9` | Season 1 art contract | The team needed one practical definition of “premium, solid and mobile-safe” before replacing assets. | Repository-grounded hero/environment/asset audit; `git diff --check`. See `SEASON_1_ART_PIPELINE.md`. |

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
