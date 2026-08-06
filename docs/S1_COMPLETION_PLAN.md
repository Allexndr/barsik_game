# BARSIK Season 1 — Completion Plan

> **Версия:** 1.0 · **Дата:** 2026-07-30  
> **Цель:** довести Season 1 (уровни 0–16, два мира) до честного release-ready состояния.  
> **Эталон:** Mission 0 + §2 `BARSIK_S1_PRODUCTION.md`.  
> **Исполнение:** без смены стека, без R3F, без Hunyuan raw, без коммита/деплоя.

---

## 0. Что означает «Season 1 закончен»

Сезон считается законченным только если одновременно выполнены все условия:

1. Все 17 уровней можно пройти от начала до конца без soft-lock.
2. Уровни 0–9 находятся во «Фруктовом лесу», 10–16 — в «Ледяной долине».
3. Каждый уровень имеет одну понятную механику, правило трёх и 3–5 gameplay-beat.
4. На каждое действие есть визуальный и звуковой feedback.
5. Hero pipeline единый: rigged `barsik.glb` → TRELLIS static → procedural plush.
6. RU/KK работают в HUD, диалогах, наградах и мета-экранах.
7. Desktop 1280×720: цель 60 fps; mobile 390×844: минимум 30 fps.
8. Повтор уровня не дублирует награду; лучший результат может добавить только разницу.
9. Прогресс, друзья, город, магазин и финал сезона сохраняются после reload.
10. Type-check, lint, build и полный browser regression зелёные.

---

## 1. Приоритеты

| Приоритет | Значение | Примеры |
|-----------|----------|---------|
| P0 | Ломает прохождение/прогресс/релиз | soft-lock, двойные звёзды, неверная карта, blank WebGL |
| P1 | Не проходит premium-bar | слабая читаемость, нет feedback, камера, mobile HUD |
| P2 | Полировка | дополнительные VFX, декоративные props, редкие VO |
| External | Нужен внешний ресурс | финальный rigged Barsik, профессиональный KK VO |

---

## 2. Уже исправлено в текущем цикле

- [x] Убрано двойное начисление звёзд (`addStars` + `completeLevel`).
- [x] Добавлен `levelStars`: повтор уровня начисляет только улучшение результата.
- [x] Карта исправлена: 10 уровней леса + 7 уровней льда; миры 3–6 — teaser.
- [x] `QualityPipeline` подключён к L2–L16; Mission1 использует отдельный QP.
- [x] Move hint L1–L16 скрывается после первого реального движения.
- [x] Mission1 использует общий hero loader вместо лисы.
- [x] Hunyuan raw и reference PNG удалены из публичного runtime-пакета (~24 МБ).
- [x] PWA icon больше не emoji-кот; добавлен брендовый paw icon.
- [x] Добавлен dev QA launcher: `/?mission=N&lang=ru|kk`.
- [x] Настоящая пауза замораживает gameplay и временные маркеры L0–L16.
- [x] Купленные городские предметы теперь появляются в `CityScene`.
- [x] QR demo больше не фармит реальные звёзды/друзей.
- [x] Подключён реальный ESLint; lint/type-check зелёные.
- [x] Удалена уязвимая Workbox/PWA build-chain; `npm audit` = 0.
- [x] TypeScript проходит после изменений.

---

## 3. Этап A — честный аудит и тестовая инфраструктура

### A1. Автоматизируемая проверка

- [x] Direct mission URL в dev.
- [ ] Console-error collector для QA.
- [ ] FPS sampler (10 секунд, avg/p5/p1).
- [ ] Screenshot matrix: desktop/mobile × RU/KK.
- [ ] Save-state fixtures: fresh / mid-season / completed.
- [ ] Проверка reload после каждой награды.

### A2. Baseline-матрица для каждого уровня

Записывать:

- load time;
- first playable time;
- duration первого прохождения;
- avg/p5 FPS;
- draw calls / triangles;
- objective и переходы фаз;
- soft-lock / collision / camera;
- RU/KK overflow;
- SFX/TTS;
- dispose после выхода.

---

## 4. Этап B — shared-инфраструктура

### B1. Rendering quality

- [x] ACES + FXAA + desktop bloom.
- [ ] Quality tiers: `low / medium / high`.
- [ ] Mobile pixel ratio ≤1.5, desktop ≤2.
- [ ] Dynamic shadow map 512/1024/2048.
- [ ] Общие forest/winter lighting presets.
- [ ] Проверка color space всех GLB texture maps.

### B2. Environment presets

- [ ] `ForestEnvironment`: ground/terrain, grass density, fog, sky, trees, fireflies.
- [ ] `WinterEnvironment`: snow ground, blue-hour sky, ice sparkle, snow particles.
- [ ] Water preset для ручья/пруда без копирования Mission0.
- [ ] Terrain использовать выборочно; gameplay collider остаётся предсказуемым.

### B3. Character / camera / input

- [x] Единый hero loader.
- [x] Plush/static locomotion.
- [ ] Footstep cadence + surface SFX.
- [ ] Camera collision / минимальная защита от клиппинга.
- [ ] Portrait camera offsets на узких экранах.
- [x] Pause действительно останавливает scene clock/input.
- [ ] `visibilitychange` автоматически ставит игру на паузу.

### B4. Lifecycle / memory

- [ ] Не dispose shared geometry/material несколько раз.
- [ ] Удаление всех listeners/timeouts/intervals.
- [ ] Texture/model cache между уровнями.
- [ ] Проверка WebGL contexts после 10 переходов карта↔уровень.

### B5. Audio

- [x] Общий AudioManager.
- [ ] SFX события должны исходить из gameplay events, а не угадываться по имени phase.
- [ ] Forest/ice/hub music transitions с fade.
- [ ] TTS queue/debounce; не перебивать каждое HUD-обновление.
- [ ] KK fallback: субтитры всегда, RU voice не подставлять незаметно.

---

## 5. Этап C — Фруктовый лес, вертикальные срезы

### L0 «Первое утро» — regression anchor

- [ ] Проверить intro, три шага обучения, apple pick, bird, gardener quest, outro.
- [ ] Убедиться, что награда ровно 10 звёзд один раз.
- [ ] Проверить terrain snap героя и props.
- [ ] Проверить Mission0 custom UI против общего MissionScreen.
- [ ] Desktop/mobile RU/KK screenshots.

### L1 «Первый друг»

- [x] Общий hero pipeline и QP.
- [ ] Убрать дубли shared helpers через миграцию на `BaseLevelScene`.
- [ ] Ручей → shader water preset; мост читаемый в портрете.
- [ ] Pull ×3: anticipation → squash → particles/SFX; три визуально разные стадии.
- [ ] Айя видна как landmark до диалога.
- [ ] Sticky strands заранее намекают на Путало.
- [ ] Финал: Айя unlock + переход к саду.

### L2 «Яблоневый сад»

- [x] BaseLevelScene + QP.
- [ ] Demo нельзя пропустить незаметно; есть понятный CTA.
- [ ] Три цвета доступны не только цветом: shape/icon/pattern.
- [ ] Wrong basket: мягкий отказ, яблоко не исчезает.
- [ ] 6 critical apples + 4 golden bonus.
- [ ] Orchard revive finale (цвет/свет/листья/музыка).
- [ ] Проверить невозможность потерять carried apple.

### L3 «Потерявшийся ёжик»

- [x] BaseLevelScene + QP.
- [ ] Три сектора различаются silhouette и sound cue.
- [ ] Следы читаются на mobile.
- [ ] Два пустых сектора дают небольшую награду.
- [ ] Старый дуб виден от spawn.
- [ ] Ёжик: reveal animation + found SFX + friend unlock.
- [ ] Fireflies/лесная глубина без снижения FPS.

### L4 «Качающийся мостик»

- [x] BaseLevelScene + QP.
- [ ] Пять секций: show → try → combine.
- [ ] Safe/unsafe дублируются движением и символом, не только red/green.
- [ ] Ошибка возвращает на безопасную секцию без падения.
- [ ] Camera не показывает пустоту за ground plane.
- [ ] Rope/wood SFX; stumble feedback.
- [ ] Айя и выход видны как финальная цель.

### L5 «Корзина для белочки»

- [x] QP + shared hero.
- [ ] Escort radius визуализирован мягко.
- [ ] Белочка ждёт, не телепортируется и не застревает в props.
- [ ] Три типа препятствий с правилом трёх.
- [ ] Acorn key сохраняется для L9.
- [ ] Норка — landmark; финал и friend unlock.

### L6 «Лесная загадка»

- [x] QP + shared hero.
- [ ] Три загадки реально последовательны, а не один выбор.
- [ ] Ответы доступны без чтения для 3–5 лет (иконки/VO).
- [ ] Ошибка не штрафует; дерево реагирует.
- [ ] Finale bloom + transition к Путало.

### L7 «Встреча с Путало»

- [x] QP + shared hero.
- [ ] Скорость подхода читаема без числового HUD.
- [ ] Путало прячется/выходит плавно.
- [ ] Два позитивных диалоговых выбора работают RU/KK.
- [ ] Photo flash respects reduced motion.
- [ ] Friend unlock и hook на праздник.

### L8 «Лесной праздник»

- [x] QP + shared hero.
- [ ] Placement points: гирлянды ×3, фонари ×5, фрукты ×4.
- [ ] Задачи можно выполнять в безопасном порядке без soft-lock.
- [ ] Все друзья присутствуют и реагируют.
- [ ] Group photo + finale flash + level complete.

### L9 «QR-сундук»

- [x] QP + shared hero.
- [ ] Acorn key из L5; запасной ключ при legacy save.
- [ ] QR не обещает физическую награду до реальной упаковки.
- [ ] Chest animation, rare friend, карта зимы.
- [ ] Родительский текст и privacy-safe переход.

### L10 «Прощание с лесом»

- [x] QP + shared hero.
- [ ] Четыре точки прощания и круговой маршрут.
- [ ] Мост визуально больше не качается.
- [ ] Награды не дублируются при повторном обходе.
- [ ] Forest→snow color/audio transition.

---

## 6. Этап D — Ледяная долина

### L11 «Первые снежинки»

- [x] QP + shared hero.
- [ ] 5 critical / 10 golden снежинок.
- [ ] Snowman grows in readable stages.
- [ ] Spawn logic гарантирует доступные снежинки.
- [ ] Calm pacing; transition to ice trail.

### L12 «Ледяная тропа»

- [x] QP + shared hero.
- [ ] Inertia predictable on keyboard and joystick.
- [ ] Checkpoint per segment.
- [ ] Edge reset never loops/teleports into collider.
- [ ] Ice trail affordance and slide SFX.

### L13 «Ледяные скульптуры»

- [x] QP + shared hero.
- [ ] Three shard carry cycles.
- [ ] Progressive sculpture silhouette.
- [ ] Carried shard cannot be lost.
- [ ] Ice key persistence.

### L14 «Поделись теплом»

- [x] QP + shared hero.
- [ ] Warmth meter explained visually.
- [ ] No punitive fail-state.
- [ ] Three warmth sources and escalating distance.
- [ ] Sneeze feedback is kind, not mocking.

### L15 «Спасти снеговика»

- [x] QP + shared hero.
- [ ] 30s timer is soft; no hard loss.
- [ ] Snow carry ×3; reset/retry safe.
- [ ] Snowman melt/grow stages.
- [ ] Friend unlock and final chest hook.

### L16 «Зимний QR-сундук»

- [x] QP + shared hero.
- [ ] Ice key / legacy fallback.
- [ ] All unlocked friends in group finale.
- [ ] Rare friend unlock.
- [ ] `currentLevel=17`, map opens Mountain Lake teaser.
- [ ] Season completion card + persistent flag.
- [ ] No route to dead EpisodeScreen.

---

## 7. Этап E — meta game

### Progress/save

- [x] Atomic reward and per-level best.
- [x] Versioned save schema + backward-compatible defaults.
- [x] Corrupt localStorage recovery. `migrateProgress` validates and the catch clears the key.
- [ ] Cloud save reconciliation rules.
- [ ] Season complete flag.

### Map

- [x] Correct 10/7 world split.
- [ ] Portrait future teaser bands need enough visual height.
- [ ] Current marker centers correctly on all aspect ratios.
- [ ] Completed/current/locked states meet contrast target.

### Friends / City / Shop

- [x] RU/KK metadata for all 9 friends.
- [x] Friends appear at fixed places in City.
- [x] Purchased city objects visibly change CityScene.
- [x] Shop double tap cannot double-charge: `buyCityObject` is a functional `set` that no-ops on an already-owned id.
- [x] Friends has a complete state and names the next friend; **City/Shop empty states not audited**.

### QR / leaderboard / privacy

- [ ] Child-facing QR screen contains no purchase pressure.
- [ ] Parent gate for external actions.
- [ ] Leaderboard nickname sanitization and error/empty/loading.
- [x] No secret/service-role in the client bundle — the only JWT shipped carries `role=anon`.

---

## 8. Этап F — localization, accessibility, audio

- [ ] Перечень всех RU/KK строк; убрать mixed-language copy.
- [ ] Носитель проверяет KK до release.
- [x] Meta screens meet the 18px floor under 560px wide; **in-level HUD not yet audited**.
- [x] Meta screens: buttons ≥44px under 560px. **Not audited elsewhere.**
- [ ] Цвет не единственный сигнал.
- [x] `prefers-reduced-motion` dims the full-screen photo flash and thins particle bursts.
- [ ] Mute/volume/TTS сохраняются.
- [ ] Subtitle remains even if TTS unavailable.

---

## 9. Этап G — performance and release

### Budgets

| Метрика | Desktop | Mobile |
|---------|---------|--------|
| FPS | 60 target, p5 ≥50 | avg ≥30, p5 ≥24 |
| Pixel ratio | ≤2 | ≤1.5 |
| Shadow map | 2048 max | 1024 max |
| First level playable | ≤5 s Wi‑Fi | ≤8 s 4G |
| Runtime GLB hero | ≤5 МБ compressed | ≤5 МБ |
| JS initial | отслеживать gzip | route-split missions |

### Build/package

- [x] Raw Hunyuan removed from `public`.
- [ ] Reference/generation assets live outside runtime public.
- [x] Уязвимый PWA/Workbox удалён; S1 остаётся browser-first.
- [ ] Remove stale generated `dist` from review scope or define policy.
- [ ] Bundle warning: Three chunk >500 KB — document or split examples modules.

### Final matrix

- [ ] Desktop 1280×720: L0–16 RU.
- [ ] Mobile 390×844: L0–16 RU.
- [ ] KK: all outro + representative gameplay, then copy audit.
- [ ] Reload after L0, L5, L9, L16.
- [ ] Replay rewards.
- [ ] 10 consecutive scene transitions for memory leaks.
- [x] `npm run lint`.
- [x] `npm run type-check`.
- [x] `npm run build`.

---

## 10. Release blockers outside code

| Blocker | Owner | Fallback |
|---------|-------|----------|
| Final rigged `barsik.glb` | Владелец / Meshy / 3D artist | TRELLIS static + plush locomotion |
| Professional KK VO | Владелец / voice vendor | subtitles + browser TTS when available |
| Real packaging QR pool | Brand/retail | demo chest clearly marked, no fake physical promise |
| Real-device device matrix | QA/owner | Chrome emulation + documented limitation |

External blockers не должны мешать закончить gameplay, UI, fallback и техническую приёмку.

---

## 11. Рабочий порядок

1. Закрыть P0 прогресс/карта/package.
2. Завершить shared rendering/input/audio/lifecycle.
3. L0 regression.
4. L1 → L4 по одному полному vertical slice.
5. L5 → L10.
6. L11 → L16.
7. Meta game.
8. RU/KK/audio/accessibility.
9. Performance.
10. Полный release regression.

Не начинать следующий уровень, пока текущий не проходит gameplay + visual + audio + adaptive + dispose + build + browser QA.

---

## 12. Аудит E–G — что проверено в коде (2026-08-05)

Проверялось чтением кода и сборки, а не по галочкам выше. Разделы A–D в этот
проход не пересматривались.

### Закрыто и подтверждено

| Пункт | Чем подтверждено |
|---|---|
| Corrupt localStorage recovery | `migrateProgress` валидирует форму, `catch` удаляет ключ |
| Double-tap в магазине | `buyCityObject` — функциональный `set`, no-op на купленном id |
| Нет service-role в бандле | единственный JWT в `dist` — `role=anon` |
| reduced-motion для вспышки | пик 0.28 вместо 1.0, частиц ~⅓ |
| 18px / 44px на мета-экранах | media-блок в `meta-screen.css` |
| `npm run build` | зелёная |

### Открыто, с измерением

| Пункт | Что именно |
|---|---|
| **Нет записи в рейтинг** | `leaderboard.ts` только читает. Игрок не может попасть в таблицу; место считается локально. Нужна серверная функция с валидацией — клиентский insert только усугубит |
| **Невозможный счёт в таблице** | 1486 звёзд при потолке сезона ~322 наградных. Следствие того же: таблица пишется без аутентификации |
| **`dist/` в git** | 1201 файл. Каждая сборка мусорит в diff. Не трогал: Vercel может отдавать закоммиченный `dist`, это решение по деплою |
| Cloud save reconciliation | не реализовано |
| Карта: контраст состояний, портретные полосы | не проверялось |
| KK-вычитка носителем | не делалась |
| HUD внутри уровней: размеры текста и тач-таргеты | не проверялись |
| FPS-бюджеты, время до первого уровня | не замерялись |
| Финальная матрица прохождения | не проходилась |

### Отдельно: длительность уровней

Планка «5 минут» не достигнута ни одним уровнем. Минимальные маршруты
(идеальный проход игрока, который знает карту):

| Уровень | Маршрут | Чистая ходьба |
|---|---|---|
| L8 Лесной праздник | 216 м | ~68 с |
| L10 Прощание | 153 м | ~48 с |
| L6 Лесная загадка | 143 м | ~45 с |
| L9 Сундук | 111 м | ~35 с |
| L3 Ёжик | 80 м | ~25 с |
| L7 Путало | 71 м | ~40 с (шаг замедлен) |

С блужданием, диалогами и таймерами это примерно 1.5–4 минуты. До пяти нужны
дополнительные beat'ы, а не большая карта.

---

## 13. Город, Гардероб, L7 — закрыто в этой итерации

### Город больше не зависит от несуществующей покупки

`CityScene` решал, что строить, по `cityObjects`. Пишет в `cityObjects` ровно
одно место — магазин. После превращения магазина в гардероб ни один из 45
предметов не несёт id вида `city_*`, поэтому:

| Симптом | Проверено |
|---|---|
| «Твои украшения» пуст навсегда | `grep -c "id: 'city_" wardrobe.ts` → 0 |
| Кнопка «В Магазин» ведёт за деревом, которого нет в продаже | `SHOP_ITEMS` ids: `city_tree/lamp/bench/fountain` |
| `makeFountain`, `makeBench`, `makeLamp` недостижимы | единственный вызов — под `ownedObjects.includes(...)` |

Заменено на `CITY_STAGES` — одна таблица, из которой читают и сцена, и текст на
экране, поэтому обещание «на площади забьёт настоящий фонтан» — это тот объект,
который появится. `shopCatalog.ts` удалён.

Дополнительно: Барсик теперь стоит в собственном городе в одежде из гардероба
(вне превью магазина одежда не появлялась нигде); жители кликабельны в 3D и
карточками; модели грузятся через `loadCharModel`, поэтому постаменты Meshy
больше не торчат; снеговик собран из примитивов — он единственный без GLB и
стоял безликой капсулой среди восьми моделей.

### Гардероб на телефоне

Экран открывался на заголовке, подзаголовке, **дубле счётчика звёзд** (он уже
есть в шапке приложения), превью 270px и **двух рядах** фильтров. На 812px это
весь экран: до вещей нужно было проскроллить всё, ради чего экран открыт.
Сейчас над сгибом видно четыре карточки. Десктоп не изменился.

### L7 «Встреча с Путало»

| | Было | Стало |
|---|---|---|
| Набор доверия на точку | 2.4 с | 9.6 с (замерено) |
| Точек | 3 | 4 |
| Маршрут | 71 м | 93 м + 69 м на сбор |
| Глаголов | 1 | 2 (подойти, собрать) |
| Идеальный проход | ~70 с | **146 с** |

Механика: пока Путало у видоискателя — можно двигаться; поднял голову — замри.
Проверено вызовом `updateStealth` на синтетических часах: под взглядом стоя
доверие не падает, при движении падает на 0.34, во время съёмки растёт даже на
ходу. Подбираются только три потерянных снимка — ни один из двенадцати
декоративных на деревьях не интерактивен.

**Цель 300 с не достигнута.** 146 с — идеальный проход; ребёнок с неидеальным
маршрутом, парой попаданий под взгляд и чтением диалогов — примерно 220–290 с.
Остаток закрывается ещё одним beat'ом, не замедлением ходьбы.

### Осталось из прошлого списка

Без изменений: запись в рейтинг (нужна серверная функция), `dist/` в git,
ротация ключей, город с мультиплеером, музыка и озвучка.

---

## 14. L3 «Потерявшийся ёжик»

Три дефекта, все — в собственной посылке уровня «иди по следам».

| Дефект | Как проявлялся | Проверено |
|---|---|---|
| Следов не видно | круг r=0.12 на y=0.03 в траве; с 22 м сверху не виден вообще | скриншот сверху — пусто |
| Следы никуда не ведут | все наборы шли из одной точки (0,−8), у спавна три веера в разные стороны | код: `trackStart = {x:0,z:−8}` для каждого сектора |
| Последняя остановка недостижима | `nearestInteract` мерил 3D-дистанцию до точки с y=0; у бревна земля +2.28 м, стоя в 1.2 м получалось 2.58 при пороге 2.0 | лог: `distFlat: 2.58, returned: null` |

Третий дефект был и в `Level2Scene` — проверка корзин мерила в 3D, хотя
проверка яблок двумя строками выше уже мерила по плоскости. Исправлено в обоих.

Сейчас: отпечаток лапы (подушечка + три пальца), развёрнутый по ходу движения,
следы сцеплены от остановки к остановке, видна только текущая нога маршрута.
Остановок 5 вместо 3, маршрут 132 м вместо 80. Счётчик ног — данные, а не
`track1 | track2 | track3` в типе; подсказка читает метку следующего сектора, а
направление («вправо»/«влево») вычисляется по маршруту — раньше было зашито в
строку и на зигзаге врало в половине случаев.

Проверено проходом всех пяти остановок: каждая берётся в цель, открывает ровно
следующую ногу, счётчик показывает N/5, слово направления совпадает с маршрутом
на каждой остановке, ёжик находится.

### Длительность: сводка после двух проходов

| Уровень | Цель | Было | Стало |
|---|---|---|---|
| L7 Путало | 300 с | ~70 с | 146 с (идеальный проход) |
| L3 Ёжик | 300 с | 80 м / ~25 с ходьбы | 132 м, 5 остановок |

Ни один из двух не достигает 300 с при идеальном проходе. Это ожидаемо:
идеальный проход — нижняя граница, реальный ребёнок даёт примерно вдвое больше.
Остальные уровни (L2, L5, L6, L9, L10, глава 2) той же ревизии ещё не получали.
