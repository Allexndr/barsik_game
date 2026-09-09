# GAMEPLAY-EVIDENCE

Дата: 2026-08-31. Артефакты получены локально; production не трогался.

## Команды и результаты

- `npm test -- --run` → **17 passed** в 9 test files.
- `npm run test:e2e` → **64 passed** (Chromium 63 + mobile 1), one worker.
- `npm run test:gameplay` → **17/17 PASS**: каждый L0–L16 прошёл dev-only переход
  `intro → playable`, без собранных QA-ошибок.
- `npm run test:device` → **18/18 PASS**: desktop/portrait/landscape viewport matrix,
  RU/KK, без overflow и QA-ошибок.
- `npm run test:perf` → **4/4 PASS**: локальные headless FPS/p5/heap samples для L0/L1/L8/L16;
  значения не трактуются как device budget pass.
- `npm run type-check` и `npx tsc -p api/tsconfig.json --noEmit` → **pass**.
- `npm run voice:check` → **pass**, manifest содержит 712 clips.
- `npm exec vite -- build --outDir <temporary-dir> --emptyOutDir` → **pass**; Vite
  предупреждает о `three-vendor` 554.23 kB minified.
- `npm run build` → TypeScript pass, затем локальный `dist/assets` не очистился (`ENOTEMPTY`)
  из-за занятого каталога; production output не трогался.
- `tests/manual/playtest_smoke.py` в isolated browser-per-case → все 17 level
  cases и RU/KK sample вернули HTTP 200; `console_errors=[]`, `page_errors=[]`,
  `failed_requests=[]`.
- Интерактивный Playwright smoke: L0/L1/L4 desktop, L8/L15 mobile — `Играть`,
  movement, touch-style joystick, pause/resume; ошибок нет.
- Restart из pause на L1 возвращает loading state и закрывает settings overlay; e2e PASS.
- Pause-first menu на L1 показывает «Пауза» и recovery actions до settings controls; переход
  в настройки и возврат «Вернуться к паузе» покрыты e2e.
- Скрытие вкладки переводит миссию в recoverable pause с кнопкой «Продолжить»; e2e PASS.
- Pause dialog keyboard semantics and language switch without mission restart — e2e PASS;
  full suite remains green after fixing scene hydration race.

## Скриншоты

Скриншоты не коммитятся: они лежат в `/tmp/barsik-playtest/` текущей машины.

- Welcome: `/tmp/barsik-playtest/welcome-desktop.png`, `welcome-mobile.png`
- L1 playable: `/tmp/barsik-playtest/mission-01-interactive.png`
- L8 mobile playable: `/tmp/barsik-playtest/mission-08-mobile-interactive.png`
- L0/L16 loading/play entry: `/tmp/barsik-playtest/mission-00.png`,
  `/tmp/barsik-playtest/mission-16.png`
- Полная JSON-выгрузка последнего smoke: `/tmp/barsik-playtest/full-smoke-final.json`

Визуально подтверждено: landing не обрезает CTA на mobile; L1 показывает маршрут,
героя и цель; L8 на mobile показывает playable scene, HUD и joystick; L16 имеет
понятный loading/play entry.

## Evidence boundaries

Переход `intro → playable` и положительный boot smoke не доказывают прохождение фаз, корректность всех коллизий,
win/restart, сохранение в середине или слуховую проверку TTS/SFX. Эти пункты остаются
`not run`, чтобы не выдавать DOM/код за игровой результат.
