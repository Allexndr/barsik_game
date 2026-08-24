# S1 QA — этап A1 (инфра)

> Sprint goal: premium + демо UX + QA notes до 31.08.

## Включено в код

| Инструмент | Как | Статус |
|------------|-----|--------|
| Direct mission URL | `?mission=N&lang=ru\|kk` | ✅ |
| FPS sampler | `?fps=1` → console `[fps:level] avg=… p5=…` (~10 с) | ✅ `src/dev/fpsSampler.ts` |
| Console-error collector | `?qa=1` → `window.__qaErrors()` / `__qaClearErrors()` | ✅ `src/dev/qaConsole.ts` |
| Level audit | `?mission=N` + `window.__audit()` | ✅ `src/dev/levelAudit.ts` |
| Save fixtures | `docs/qa/save-fixtures.json` (fresh / mid / completed) | ✅ шаблоны |

## Ещё руками / CI

- [ ] Screenshot matrix: desktop 1280×720 + mobile 390×844 × RU/KK (L0, L1, L8, L16 минимум)
- [ ] Reload после наград L0 / L5 / L9 / L16
- [ ] Прогон `__audit()` на L1/L8/L16 после фикса камеры (intro → follow)
- [ ] `npm run voice:check` перед релизом

## Hub realtime (P0 ops)

По умолчанию **выкл**. Включить только после `supabase/city_chat.sql` + Realtime RLS:

```
VITE_HUB_REALTIME=1
```

Без этого хаб работает соло (соседей нет) — безопасно для прода.
