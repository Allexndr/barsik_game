# Release Readiness

**Дата:** 13.09.2026 · **Вердикт: NOT READY для публичного production release.**

## Что подтверждено локально

- 17/17 level boot и 17/17 intro→playable.
- 17/17 уровней завершены техническим golden-path прогоном до `outro` штатным
  WASD/E/Space-вводом; состояния игры и награды не подменялись.
- `npm run test:e2e` — 64/64 PASS.
- `npm test -- --run` — 25/25 PASS.
- `npm run build` — PASS.
- `npm run lint` — 0 errors, 2 Fast Refresh warnings.
- `npm run test:perf` — 4/4 PASS, но headless-only.
- `npm run voice:check` — 716/716.
- Pause/restart, hidden-tab recovery, language switch, replay entry, mobile touch-style input — PASS.
- Security surface reviewed; confirmed critical exploit not found in local static audit.

## Исправления текущей версии

- Видимый маяк цели L0.
- Более понятный выбор корзины L2.
- Синхронная цель и действие замка L9.
- Безопасное положение камеры у деревьев L10.
- Контрастные снежинки и зоны приземления L11.
- Направленное восстановление после соскальзывания L12.
- Recovery после ошибки на L0, L6 и L7.
- L7/8: камера вращается с сенсорного drag, Путало движется с фиксированной
  скоростью и шаговой анимацией, а полный стик больше не замедляет ребёнка.
- L7/8: декоративные карточки больше не висят в воздухе — они собраны у укрытий,
  посажены на рельеф и читаются с обеих сторон.
- Карта desktop/tablet: вертикальные главы вписываются целиком, все узлы текущей
  главы видны над отдельной полосой запуска уровня; phone-режим не получает
  горизонтальный overflow.
- Вход L0 в юрту: отдельный приветственный коврик, домбра сбоку, камера без борьбы с внутренним ограничителем.
- Убран перекрывающий интерьерный световой конус в юрте L0.
- Физика видимых завалов L5: камни и корневые арки блокируют путь до действия и
  освобождают его после расчистки; корни посажены на рельеф.
- Физика зимнего декора L11–L16: доступные камни блокируют героя, сугробы и
  плоский снег остаются проходимыми.
- Читаемая корзина L5: плоский красный проп заменён на объёмную корзину с ручкой
  и орехами, вынесенную в видимую зону рядом с носителем.
- Синхронный счётчик пяти секторов L3.
- Более мягкие безопасные окна L4.
- Ранее закрытые soft-lock/navigation fixes L0/L1/L5/L9/L12 и pacing fixes L8/L10/L15.

## Блокирует release

- Нет production smoke актуального проверенного commit.
- Нет реального телефона с доказанными FPS ≥30, camera/overflow/context-loss.
- Нет наблюдения реального ребёнка/взрослого, который самостоятельно проходит
  L0→L16 без подсказок; технический golden path подтверждён.
- Realtime chat transport не готов к включению: client broadcast и secure `city-say` расходятся.
- Cloud merge/leaderboard write policy не закрыта.
- Native KK proofread не выполнен.

## Риски перед публикацией

- localStorage progression tampering.
- legacy shared admin token при ошибочном включении env.
- публичные model/debug pages.
- refresh token в localStorage.
- headless performance не отражает слабый телефон.

## Рекомендованный порядок выхода

1. Закрыть M-001, M-002 и M-003 в preview/staging.
2. Провести M-006 и M-007 на целевых устройствах/детях.
3. Закрыть M-005 и M-008 для admin API.
4. Принять решение по M-004/M-010: server-authoritative или честно local-only S1.
5. Выполнить native KK review, artifact scan, backup/rollback и только после этого production smoke.
