# Game / Platform Improvement Tasks

**Источник истины:** `MASTER-ROADMAP.md` · **Дата:** 12.09.2026.

## Blocker

- [ ] M-001 — preview/production parity, smoke и rollback.
- [ ] M-002 — единый безопасный realtime transport.

## Critical

- [ ] M-003 — human golden path L0→L16 с приёмочным журналом.
- [ ] M-004 — server-authoritative rewards/progress policy.

## High

- [ ] M-005 — identity-only admin auth, удалить legacy token.
- [ ] M-006 — real-device FPS/camera/memory matrix.
- [ ] M-007 — детский playtest L6/L7/L11/L15 и точечные assists.
- [ ] M-008 — admin PATCH schema/bounds/version validation.

## Medium

- [ ] M-009 — убрать refresh token из localStorage.
- [ ] M-010 — cloud save/leaderboard policy и integration tests.
- [ ] M-011 — durable rate limit по server-issued subject.

## Low / Polish

- [ ] M-012 — исключить debug/model pages из public artifact.
- [ ] M-013 — убрать Supabase fallback literals после env migration.
- [x] Local baseline: build, type-check, lint, Vitest и Playwright regression.
- [x] Local child-facing fixes L0/L2/L3/L4 из предыдущего Season 1 аудита.
