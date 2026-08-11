# BARSIK — сверка канона (иерархия источников и матрица противоречий)

> **Дата:** 2026-07-30  
> **Статус:** рабочий артефакт для сезонных ТЗ и доводки уровней  
> **Не заменяет:** `GDD_CHAPTER1_FRUIT_FOREST.md` (дизайн уровней) и `BARSIK_S1_PRODUCTION.md` (исполнение)

---

## 1. Иерархия источников (приоритет сверху вниз)

| Уровень | Источник | Что считать каноном |
|---------|----------|---------------------|
| **P0** | Прямые решения заказчика в интервью 16–17.07.2026 | Видение продукта, регистрация, дружба, QR, сезоны, качество > количество |
| **P1** | `docs/PROJECT_MEMORY.md` (журнал) | Зафиксированные decision/fact после интервью |
| **P2** | `docs/BARSIK_CONCEPT_LOCK.md`, `docs/BARSIK_GDD_v2.md`, `docs/BARSIK_GAMEPLAY_CANON.md` | Продуктовый и геймплейный канон |
| **P3** | `docs/GDD_CHAPTER1_FRUIT_FOREST.md` | Дизайн 17 уровней S1 (механики, биты, награды) |
| **P4** | Обёртки `MissionNScreen` + реальные сцены `src/three/scenes/*` | Фактическая реализация в коде |
| **P5** | `docs/BARSIK_S1_PRODUCTION.md`, `docs/AGENT_HANDOFF_LEVELS_1_4.md`, `docs/SEASON_1_QUALITY_GDD.md` | Исполнительные ТЗ и планка премиума |
| **P6** | `docs/BARSIK_SEASONS.md`, `STITCH_PROMPTS.md`, `BARSIK_ARC1_OUTLINE.md` | Рамка сезонов и арт-направление миров |
| **P7** | Старые формальные ТЗ, Deep Research, completion-отчёты | Только если не противоречат P0–P6 |

**Правило:** при конфликте побеждает источник выше. Нижний уровень либо обновляется, либо помечается «устарело».

---

## 2. Подтверждённый продуктовый канон (2026-07)

| Тема | Канон |
|------|-------|
| Платформа | Браузерная игра, React 18 + Vite + TS + imperative Three.js |
| Жанр | 3D детский story-adventure / виртуальный мир (не runner, не match-3) |
| Онбординг | Mission 0 → карта; progressive registration (ник, пол, soft phone) |
| Языки | RU + KK на всём UI и ключевом VO |
| Герой | Барсик — детёныш снежного барса, зелёный худи, очки; base без кепки |
| Друзья | Через квесты помощи, не авто каждые 5 уровней |
| Мягкий «злодей» S1 | Паучок Путало (одиночество → дружба) |
| Первый друг | Айя |
| Миры на карте | 6 миров канона; **S1 играбелен = 2 мира** (Фруктовый лес + Ледяная долина) |
| Уровни S1 | **17 уровней (0–16)** в двух мирах |
| Прогресс | Сохраняется между сезонами (дом, друзья, декор) |
| QR | Сильная награда; пул сезонный; физическая упаковка — позже |
| Насилие / P2W | Нет fail-state, нет pay-to-win |
| Колорит | Мягкий KZ/Almaty (юрта, апорт, домбра, орнамент деликатно) |
| Визуал | Style Lock: soft-3D plush (`ART_DIRECTION.md`) |
| Флагман качества | **Mission 0** — эталон vertical slice |
| Движок | Не переписывать на R3F/viber3D для S1 (решение 2026-07-26) |
| Герой 3D | Приоритет rigged `barsik.glb`; до него TRELLIS/plush fallback |
| Hunyuan raw | **Не использовать** в игре (нет текстур/rig, артефакты) |

---

## 3. Матрица противоречий

| # | Тема | Устаревший / конфликтный источник | Актуальный канон | Действие |
|---|------|-----------------------------------|------------------|----------|
| C1 | Количество уровней | Ранние ТЗ «100 уровней», карта 10×10, `levels.ts` stubs | S1 = 17 уровней (0–16), два мира | ✅ `levels.ts` переписан; карта = 17 пинов S1 |
| C2 | Длительность уровня | «20–40 секунд» (ранний канон) | 3–6 мин первое прохождение, 4–6 gameplay-beat | GDD + production bible; не сжимать искусственно |
| C3 | Друзья | «Новый друг каждые 5 уровней» | Друг = награда квеста по сюжету | GDD реестр друзей; `season1Friends.ts` |
| C4 | Шесть миров сразу | Старые ТЗ «6 обязательных миров в S1» | S1 = 2 мира играбельны; 3–6 = teaser на карте | `TravelMapScreen`, L16 → S2 teaser |
| C5 | Runner / 3 полосы | Canvas runner, lane mechanics | Story episodes, помощь, explore | LEGACY; не строить уровни на runner |
| C6 | `levels.ts` vs GDD | L5 «садовник», расхождения имён | L5 = Белочка + жёлудь-ключ | `levels.ts` синхронизирован с GDD |
| C7 | Mission 1 нумерация | `Mission1Scene` комментарий «Level 2» | Уровень **1** в реестре = «Первый друг» | Косметика в коде; реестр = L1 |
| C8 | Level2Scene файл | `Level2Scene.ts` = GDD **уровень 2** (яблоневый сад) | Экран `Mission2Screen` → `Level2Scene` | Именование файлов ≠ id уровня (legacy) |
| C9 | Статус «S1 готов» | `BARSIK_S1_PRODUCTION.md` §6 «L1–16 ✅» | L0 = premium; L1–4 **ниже планки** M0 | Обновить статусы; handoff L1–4 |
| C10 | Герой | `hero_placeholder.glb` (лиса) в Mission1 | `loadBarsikHeroRig` (barsik/trellis/plush) | Mission1 + BaseLevelScene |
| C11 | Quality pipeline | Только Mission0 | Все уровни 1–4 через BaseLevelScene / M1 | Раскатка `QualityPipeline` |
| C12 | Друзья S1 в CONCEPT | «2–3 друга» (ранняя рамка) | GDD: 9 персонажей (2 rare) за 17 уровней | CONCEPT = минимум MVP; GDD = полный S1 |
| C13 | Хаб vs карта | GDD v2 «меню = Barsik Town» | Текущий flow: Mission0 → TravelMap | Town 3D есть; карта = основной хаб S1 |
| C14 | Суперприз | Физический приз vs билет | Внутриигровой билет до конверсии | Открытое решение для продакшена |
| C15 | L0 механика | `SEASON_1_QUALITY_GDD.md` §6 L0 (2026-08-11, untracked при написании): «3 яблока-апорта», садовник зажигает первый фонарь до реки, порядок фонари→река слитно | Коммит `57b5cb8` (2026-08-06) «Тропа домбры»: `Level0Scene.ts` **сознательно** заменил fetch-паттерн на follow→lanterns→crossing→mend — см. шапку файла, «one verb repeated three times with different skins» отвергнут явно | GDD §6-L0 устарел, код выше по приоритету здесь. Из GDD §6 для L0 брать только визуальные критерии (§2-3), не сюжет/порядок. Подробности: `PROJECT_MEMORY.md` 2026-08-11. Не переносить apples обратно без нового явного решения владельца. |

---

## 4. Реестр уровней: GDD ↔ код ↔ levels.ts

| L | Название | GDD механика | Сцена в коде | Экран | Статус vs M0 |
|---|----------|--------------|--------------|-------|--------------|
| 0 | ~~Первое утро~~ → «Тропа домбры» (2026-08-06, `57b5cb8`, см. C15) | follow звука → фонари → река (прыжки) → войлок → юрта/домбра | `Level0Scene` (не `Mission0Scene` — заменена целиком) | Mission0Screen | ✅ Флагман, quality-pass юрты 2026-08-11 |
| 1 | Первый друг | тяни фрукт ×3 | `Mission1Scene` | Mission1Screen | 🟡 Отдельная сцена, без QP |
| 2 | Яблоневый сад | сортировка | `Level2Scene` | Mission2Screen | 🟡 BaseLevel, без QP |
| 3 | Потерявшийся ёжик | поиск | `Level3Scene` | Mission3Screen | 🟡 BaseLevel, без QP |
| 4 | Качающийся мостик | timing | `Level4Scene` | Mission4Screen | 🟡 BaseLevel, без QP |
| 5–16 | … | GDD | `Level5Scene`–`Level16Scene` | Mission5–16Screen | 🟡 Играбельны, не premium |

---

## 5. Открытые решения (не канон)

| ID | Вопрос | Варианты | Блокирует |
|----|--------|----------|-----------|
| O1 | Суперприз S1 | Розыгрыш / внутриигровой билет / гибрид | Маркетинг упаковки |
| O2 | Финальный `barsik.glb` | Meshy заказ / in-house rig | Анимация героя везде |
| O3 | ElevenLabs vs OpenAI TTS | Качество KK VO | Аудио-бюджет |
| O4 | Старт S2 | Дата / объём первой арки | `SEASON_2_SPEC.md` детализация |
| O5 | Хаб Town vs Map first | Полный 3D Town как home | UX после S1 polish |

---

## 6. Источники (чеклист для агента)

- `WhatsApp Audio 2026-07-17*.txt`, `16 июл*.txt`
- `docs/BARSIK_INTERVIEW_2026-07-16.md`
- `docs/PROJECT_MEMORY.md`
- `docs/BARSIK_CONCEPT_LOCK.md`
- `docs/BARSIK_GDD_v2.md`
- `docs/GDD_CHAPTER1_FRUIT_FOREST.md`
- `docs/BARSIK_SEASONS.md`
- `docs/BARSIK_S1_PRODUCTION.md`
- `docs/MISSION0_AUDIT.md`
- `docs/AGENT_HANDOFF_LEVELS_1_4.md`
- `src/utils/levels.ts`
- `src/three/scenes/Mission0Scene.ts` … `Level16Scene.ts`
