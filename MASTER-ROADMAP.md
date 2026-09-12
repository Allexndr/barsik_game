# Master Roadmap — platform audit

**Дата:** 12.09.2026 · порядок: Blocker → Critical → High → Medium → Low/Polish.

| ID | Priority | Проблема | Решение | Файлы/система | Зависимость | Оценка | Критерий готовности | Тест |
|---|---|---|---|---|---|---|---|---|
| M-001 | Blocker | production/staging parity не доказана | собрать согласованный commit, preview smoke и rollback checklist | Vercel, build, docs | доступ владельца deploy | M | preview bundle = проверенный commit, smoke 200/0 errors | release smoke |
| M-002 | Blocker | realtime child-safety path расходится | отключить client broadcast или перевести все сообщения на Edge Function + private RLS | `src/net/hub.ts`, `city-say`, Supabase | schema/RLS staging | L | forged client cannot publish to child room | security integration |
| M-003 | Critical | full human season path не подтверждён | провести L0→L16 с картой/reload/reward и acceptance log | levels/meta | тестировщик/телефон | L | 17/17 human completion records | manual QA |
| M-004 | Critical | local save можно подделать | server-authoritative rewards + explicit offline policy | progression RPC/store | cloud design decision | L | impossible rewards rejected server-side | integration |
| M-005 | High | shared legacy admin token | identity-only short-lived admin auth | `api/admin/_lib.ts`, Supabase Auth | admin identity setup | M | legacy flag removed, role matrix passes | API auth tests |
| M-006 | High | mobile FPS/camera not proven | test target phones and tune quality tiers | Three quality/lifecycle | physical devices | M | ≥30 FPS p5 and no context loss | device/perf |
| M-007 | High | children may fail L6/L7/L11/L15 | observe, then add targeted assist without removing mechanics | level scenes/UI | child playtest | M | ≥80% complete without adult hint | playtest |
| M-008 | High | admin PATCH accepts malformed values | schema/bounds/version validation | `api/admin/players.ts` | API fixtures | S | invalid body returns 400, no DB mutation | integration |
| M-009 | Medium | refresh token in localStorage | BFF/httpOnly session or short-lived flow | `progression.ts`, deployment | auth architecture | M | token absent from localStorage | security test |
| M-010 | Medium | cloud save merge/leaderboard write undefined | document and implement policy or mark local-only S1 | Supabase progression | product decision | M | conflict tests and documented ownership | integration |
| M-011 | Medium | city-say rate limit identity spoofable | server-issued subject + durable quota/alerts | Edge Function/SQL | Supabase migration | M | abuse test cannot evade quota | security test |
| M-012 | Low | debug pages public | exclude from production artifact or protect preview | `public/`, build | deployment config | S | output has no prototype/debug pages | artifact scan |
| M-013 | Low | public fallback anon config | require build env, rotate if needed | `hub.ts`, `leaderboard.ts` | deployment env | S | no fallback literals in release bundle | secret/config scan |

## First sprint: 8 tasks

1. M-001 — align preview with verified commit.
2. M-003 — human golden-path acceptance session.
3. M-006 — real-phone performance/camera matrix.
4. M-007 — child difficulty observation and targeted assists.
5. M-002 — freeze realtime and decide one safe transport.
6. M-008 — validate admin PATCH schema.
7. M-005 — remove legacy admin token after identity check.
8. M-012 — exclude internal/debug static pages from public release.
