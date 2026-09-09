# QA-TEST-CASES — Season 1

Тесты сформулированы как executable plan. `pass` означает наличие автоматической
проверки; `planned` требует реализации или ручного прогона.

## Unit

| ID | Что проверяет | Где | Входные данные | Ожидаемый результат | Реальный риск |
|---|---|---|---|---|---|
| U-001 | санитизацию local save | `tests/progress-migration.test.ts` | `currentLevel=9999`, пустой progress | L0, season incomplete | битый save блокирует карту |
| U-002 | финальную миграцию | `tests/progress-migration.test.ts` | unlocked L16 + stars | pointer 17, season complete | потеря финала после reload |
| U-003 | best-score/idempotency | `tests/score.test.ts` | повторная награда | нет двойных звёзд | economy exploit |
| U-004 | moderation | `tests/moderation.test.ts` | phone/link/обычное имя | unsafe rejected | утечка контактов детей |
| U-005 | server progress contract | `tests/progression.test.ts` | malformed/canonical JSON | reject/normalize | corrupted authoritative state |

## Integration

| ID | Что проверяет | Где | Входные данные | Ожидаемый результат | Реальный риск |
|---|---|---|---|---|---|
| I-001 | `barsik_complete_level` order/idempotency | Supabase integration suite (planned) | user, L0→L1, skip L4 | ordered grant; skip rejected | progression tampering |
| I-002 | expired token refresh | `tests/net/progression.integration.test.ts` | 401 then refresh | one retry, no duplicate grant | stuck sync / duplicate award |
| I-003 | admin identity and role | `tests/api/admin.integration.test.ts` | admin role, player role, legacy mode off | only authorized admin | admin data exposure |
| I-004 | realtime CORS/rate limit | staging edge test (planned) | origins, burst messages | exact origin, durable limit | abuse and cross-origin writes |

## E2E

| ID | Что проверяет | Где | Входные данные | Ожидаемый результат | Риск |
|---|---|---|---|---|---|
| E-001 | boot всех уровней | `tests/e2e/levels.spec.ts` | L0–L16 RU | HTTP 200, canvas, no runtime errors | broken route/asset |
| E-002 | replay после финала | `tests/e2e/levels.spec.ts` | valid L16 save | CTA enabled, replay L16 | completed player has no next action |
| E-003 | keyboard map pin | `tests/e2e/levels.spec.ts` | focus + Enter | mission opens | keyboard-only dead end |
| E-004 | mobile input/pause | `tests/e2e/mobile.spec.ts` | Pixel 5, joystick, pause | input accepted, resume works | mobile soft-lock |
| E-005 | restart from pause | `tests/e2e/levels.spec.ts` | pause L1 → restart | fresh loading state, no settings overlay | stuck state / impossible retry |
| E-006 | L0 golden path | `tests/e2e/golden-path.spec.ts` (planned) | controlled input | lanterns→crossing→mend→song→outro | first-level blocker |
| E-007 | L1 golden path | same | six fruits + bridge + Aya | `outro`, friend, stars | season path blocker |
| E-008 | all phase transitions | same | dev fixture per level | every phase has exit | soft-lock |

## Regression

| ID | Что проверяет | Где | Входные данные | Ожидаемый результат | Риск |
|---|---|---|---|---|---|
| R-001 | corrupt save | `tests/progress-migration.test.ts` | oversized pointer | no false finale | user data corruption |
| R-002 | replay map | `tests/e2e/levels.spec.ts` | 17 completed levels | L16 replay CTA | dead-end after season |
| R-003 | pin accessibility | `tests/e2e/levels.spec.ts` | focus/Enter | mission starts | inaccessible navigation |
| R-004 | camera/terrain fixes | `window.__audit`, visual matrix (planned) | L3/L6/L16 corners | no canopy/NPC sinking | visual gameplay obstruction |
| R-005 | no double awards | store reducer + reload | same/better/worse score | only best delta | economy exploit |
| R-006 | restart remount | `tests/e2e/levels.spec.ts` | paused L1 → restart | loading state returns, settings closes | unrecoverable mid-level state |

## Manual QA

| ID | Что проверяет | Где | Входные данные | Ожидаемый результат | Риск |
|---|---|---|---|---|---|
| M-001 | L0 full play | physical mobile + desktop | fresh profile, no sound/sound | first goal clear, crossing works | onboarding failure |
| M-002 | collisions/bounds | each level | diagonal movement, jumps, corners | no escape/soft-lock | unreachable objective |
| M-003 | animation races | each objective | spam action during phase change | one transition, no duplicate | state corruption |
| M-004 | save/load | each chapter | reload during intro/play/outro | safe restore and reward | progress loss |
| M-005 | audio | RU/KK | mute, TTS, first gesture | correct language, no stuck audio | inaccessible guidance |
| M-006 | responsive | 320/375/390/844 + landscape | touch, rotate, long KK strings | controls visible and hittable | mobile abandonment |
| M-007 | offline | browser network offline | map, hub, leaderboard | honest fallback, no spinner forever | unavailable recovery |
