# RELEASE-READINESS

Дата проверки: 2026-08-31

## Вердикт

**NOT READY / NO-GO.** Временный чистый build и smoke проходят, но критические пользовательские
сценарии и инфраструктурные решения не закрыты.

## Что подтверждено

- Полный локальный Playwright suite: **64/64 PASS** в одном worker (Chromium 63/63, mobile 1/1).
  В baseline входит: 17/17
  level boot, replay, keyboard map pin, restart, pause recovery/accessibility, language switch,
  hidden-tab и touch-style mobile case.
- Дополнительные локальные контуры: gameplay **17/17**, device matrix **18/18**, perf
  harness **4/4**. Perf samples headless и не закрывают minimum-device budget.
- Проверены интерактивно: старт L0/L1/L4/L8/L15, pause/resume, keyboard, touch-style joystick;
  console/page/failed-request ошибок в этих прогонах нет.
- Vitest: 17/17 tests PASS в 9 test files; Playwright: **64/64 PASS** (baseline 25/25,
  дополнительные gameplay/device/perf suites 39/39).
- TypeScript client/API checks PASS; lint без ошибок (2 существующих Fast Refresh warnings);
  voice manifest check PASS (712 clips, 0 missing, 8 orphan candidates).
- Temporary production Vite build PASS; есть chunk warning `three-vendor` 554.23 kB minified.
- `npm run build` отдельно столкнулся с `ENOTEMPTY` при очистке занятого локального
  `dist/assets`; это не compile error, но clean build нужно повторить после остановки preview.
- Исправлены: corrupt local save, replay после сезона, keyboard map pin, onboarding metric
  drift, ErrorBoundary/async-init recovery, L1 unreachable fruit и L4 black winch.

## Обязательные незакрытые gates

| Gate | Статус | Что нужно до релиза |
|---|---|---|
| Полное прохождение L0→L16 | BLOCKED | реальный golden-path playtest с победой, наградой и возвратом на карту |
| L0 crossing / pause semantics | PARTIAL | технические regression/smoke PASS; ручное полное подтверждение на target devices |
| Restart / abandon semantics | PARTIAL | restart работает и покрыт e2e; принять политику незавершённых stars |
| Финальный сезонный flow и child-safety prompt | OPEN | решение по R-4, session-time/consent policy |
| Server-authoritative progression | PARTIAL | reconciliation, conflict policy, RPC/RLS staging verification |
| Identity admin authorization | PARTIAL | staging identity/role matrix и rotation/runbook |
| Durable rate limiting | PARTIAL | production-like multi-instance verification |
| CORS / Realtime policies | OPEN | владелец Supabase подтверждает exact origins, RLS и room scoping |
| Bundle/assets/cache | OPEN | device/network budget, production build asset loading |
| Admin SQL aggregation | PARTIAL | explain/query latency check on representative data |
| Test harness | PARTIAL | локальные progression/admin integration tests, intro→playable regression и device matrix добавлены; нужны Supabase fixtures и full gameplay golden path |
| Performance / memory | OPEN | local headless samples added (L0/L1/L8/L16), but minimum-device FPS, load, long-session leak/soak evidence still missing |
| Release operations | OPEN | backup/rollback, monitoring, privacy/legal/store sign-off |

## Известные риски

- Полный gameplay, WebGL context-loss recovery и real-device performance не доказаны;
  локальная viewport matrix и dev-only intro→playable sweep проходят.
- Local/server progress могут расходиться до принятия reconciliation policy.
- В рабочем дереве есть изменения нескольких потоков; перед merge нужен review границ и
  clean reproducible build.

## Финальный checklist

- [ ] Закрыть все blocker/critical из `MASTER-ROADMAP.md`.
- [ ] Пройти golden path и повторный вход на всех 17 уровнях.
- [x] Прогнать unit и TypeScript/API checks; полный Playwright 64/64 PASS локально
  (baseline 25/25, gameplay/device/perf 39/39).
- [x] Выполнить temporary clean Vite build; предупреждение по размеру chunk занесено в bundle gate.
- [ ] Проверить production-like CORS, Realtime, RLS, rate limit и admin roles в staging.
- [ ] Измерить bundle, assets, load/FPS/memory на минимальном целевом устройстве.
- [ ] Выполнить clean build из согласованного commit и проверить отсутствие секретов.
- [ ] Получить QA, technical, product и release sign-off.

Production, database, secrets, payments и deploy в рамках этого аудита не изменялись.
