# BALANCE-AUDIT

Дата: 2026-08-30. Это code/design audit, не telemetry analysis.

## Economy

| Показатель | Значение | Оценка |
|---|---:|---|
| playable levels | 17 | согласовано с S1 canon |
| rewards | 322 stars | фиксированная прогрессия |
| friends | 9 | соответствует catalog; landing исправлен с 12+ на 9 |
| level duration target | 200–300 s | 56–85 минут без пауз |
| repeat award | best score delta | защищено reducer + server idempotency |
| fail state | none | соответствует no-fail pillar |

## Динамика

- L0–L1 обучают движение, действие, сбор и помощь; это правильный onboarding order.
- L2–L9 чередуют help/find/timing/choice, но фактическая сложность и время пока не
  измерены на детях или реальных устройствах.
- L10–L16 добавляют снег, скольжение, тепло и финальный сундук; риск перегрузить
  игрока после перехода мира — medium.
- Нет подтверждённого rubber-band/assist telemetry: нельзя утверждать, что timing-
  уровни одинаково проходимы для разных скоростей input.

## Actionable tasks

1. Снять p50/p90 completion time и retry count по каждому уровню.
2. Для L0/L4/L11/L12/L15 проверить мягкий assist после двух неудачных попыток.
3. Показывать промежуточный checkpoint, если уровень длиннее 4 минут.
4. Проверить, что shop costs не требуют grind сверх 322★ и не создают pressure на ребёнка.
5. Не использовать server award bounds как замену проверке реального gameplay.

