# S1 QA — этап A1 (инфра)

> Sprint goal: premium + демо UX + QA notes до 31.08.

## Включено в код

| Инструмент | Как | Статус |
|------------|-----|--------|
| Direct mission URL | `?mission=N&lang=ru\|kk` | ✅ |
| FPS sampler | `?fps=1` → console `[fps:level] avg=… p5=…` (~10 с), `window.__fpsSamples()` | ✅ `src/dev/fpsSampler.ts` |
| Console-error collector | `?qa=1` → `window.__qaErrors()` / `__qaClearErrors()` | ✅ `src/dev/qaConsole.ts` |
| Level audit | `?mission=N` + `window.__audit()` | ✅ `src/dev/levelAudit.ts` |
| Save fixtures | `docs/qa/save-fixtures.json` (fresh / mid / completed) | ✅ шаблоны |

Отдельные локальные прогоны: `npm run test:gameplay` (17 уровней, intro → playable),
`npm run test:device` (viewport matrix), `npm run test:perf` (FPS/p5 + Chromium heap
evidence для L0/L1/L8/L16). Все используют local Vite и не являются production smoke.
Полный локальный `npm run test:e2e` после добавления контуров: **64/64 PASS**
(Chromium 63, mobile 1; один worker).

## Ещё руками / CI

- [x] Screenshot matrix: desktop 1280×720 + mobile 390×844 × RU/KK (L0, L1, L8, L16 минимум); артефакты локально в `/tmp/barsik-playtest/`
- [x] Reload после наград L0 / L5 / L9 / L16 через реальный `completeLevel` reducer; повторная награда не дублируется
- [x] Прогон `__audit()` на L1/L8/L16 после фикса камеры (intro → follow); полный sweep 17 уровней выполнен локально
- [x] `npm run voice:check` перед текущей локальной проверкой

## Hub realtime (P0 ops)

По умолчанию **выкл**. Включить только после `supabase/city_chat.sql` + Realtime RLS:

```
VITE_HUB_REALTIME=1
```

Без этого хаб работает соло (соседей нет) — безопасно для прода.

## External smoke target

Для явно разрешённого staging/prod smoke можно переиспользовать тот же Playwright suite
без запуска локального Vite:

```sh
PLAYWRIGHT_BASE_URL=https://staging.example npm run test:e2e -- tests/e2e/levels.spec.ts -g "L0 boots|L16 boots"
```

Это только harness configuration. Перед запуском нужны owner approval, test account/save и
проверка, что target действительно staging, а не production.
