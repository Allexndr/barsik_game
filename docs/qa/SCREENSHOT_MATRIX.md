# Screenshot matrix — ручной чеклист (до 31.08)

Base: `http://localhost:8765` или prod. Для каждого кадра: `?mission=N&lang=XX&qa=1&fps=1`.

| # | Viewport | Lang | Mission | Notes |
|---|----------|------|---------|-------|
| 1 | 1280×720 | ru | 0 | intro + play |
| 2 | 1280×720 | kk | 0 | HUD overflow? |
| 3 | 390×844 | ru | 0 | portrait |
| 4 | 390×844 | kk | 0 | |
| 5 | 1280×720 | ru | 1 | after first step — hero framed |
| 6 | 390×844 | ru | 1 | |
| 7 | 1280×720 | ru | 8 | lanterns / garlands / fruits |
| 8 | 390×844 | kk | 8 | |
| 9 | 1280×720 | ru | 16 | chest marker visible |
| 10 | 390×844 | ru | 14 | warmth bar readable |
| 11 | — | ru | 0 | reload after reward |
| 12 | — | ru | 5 | reload after reward |
| 13 | — | ru | 9 | reload after reward |
| 14 | — | ru | 16 | reload after reward |

После прогона: `__qaErrors()` должен быть `[]`. Сохранить скрины в `docs/qa/shots/` (gitignored если тяжелые).
