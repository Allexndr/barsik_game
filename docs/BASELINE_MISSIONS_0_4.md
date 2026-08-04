# Baseline QA — Missions 0–4

> **Дата:** 2026-07-30  
> **Сборка:** `npm run type-check` ✅ · `npm run build` ✅  
> **Dev:** `http://127.0.0.1:5174`  
> **Viewport desktop:** 1280×720 · **mobile (код):** `isMobile` / coarse pointer

---

## Сводка

| L | Название | Загрузка | 3D рендер | QP (ACES/bloom) | Hero rig | Move hint | Оценка vs M0 |
|---|----------|----------|-----------|-----------------|----------|-----------|--------------|
| 0 | Первое утро | ✅ | ✅ terrain/grass/water/fireflies | ✅ | barsik/trellis/plush | скрывается после 1-го шага | **Эталон** |
| 1 | Первый друг | ✅ | ✅ | ✅ (2026-07-30) | ✅ loadBarsikHeroRig | ✅ после 1-го шага | 🟡 нет terrain; плоский ground |
| 2 | Яблоневый сад | ✅ | ✅ | ✅ BaseLevelScene | ✅ | ✅ | 🟡 плоский ground |
| 3 | Потерявшийся ёжик | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 плотнее лес, нет fireflies |
| 4 | Качающийся мостик | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 мост OK, нет ущелье-VFX M0-уровня |

---

## Регрессия сборки

```bash
cd barsik-game
npm run type-check   # exit 0
npm run build        # exit 0, vite build OK
```

---

## Desktop 1280×720 (браузер)

- **Mission 0 / карта → уровень:** 3D сцена рендерится, WASD overlay виден, диалог «Первое утро».
- Скрин: `docs/baseline_m0_desktop_1280x720.png`
- HUD: чип уровня, подсказки клавиш, нижний диалог — без перекрытия центра экрана.
- **Известно:** полное прохождение 3–5 мин не замерялось автоматически (ручной плейтест).

---

## Mobile 390×844 (ожидания по коду)

| Проверка | M0 | M1–M4 |
|----------|----|-------|
| Джойстик | ✅ | ✅ MissionScreen |
| Bloom off | ✅ `isMobile` | ✅ QualityPipeline |
| Shadow map 1024 | ✅ | ✅ BaseLevelScene |
| Клавиши WASD скрыты | ✅ coarse pointer | ✅ CSS |

Рекомендация: ручной прогон на реальном телефоне перед релизом.

---

## FPS / perf (оценка)

| Платформа | Цель | Наблюдение |
|-----------|------|------------|
| Desktop | 60 fps | Dev-сборка плавная на M0/M1 snapshot |
| Mobile | ≥30 fps | Не замерялось; bloom отключён на mobile |

---

## Soft-lock / камера / RU-KK

| Риск | Статус |
|------|--------|
| Soft-lock L1 thicket | Не обнаружен в код-ревью; нужен ручной прогон |
| Камера clip | Follow lerp; нет terrain snap на L1–L4 |
| RU/KK диалоги | `levels.ts` + pushHud в сценах; KK присутствует |
| Звук | AudioManager в MissionScreen; mute в Settings |

---

## Gaps до premium-bar (§2 BARSIK_S1_PRODUCTION)

1. **L1:** не наследует `BaseLevelScene` (дублирование ~1200 строк) — рефактор отложен.
2. **L1–4:** нет valley terrain / GPU grass / water (только M0).
3. **L1–4:** хронометраж 4–6 мин не верифицирован плейтестом.
4. **Герой:** финальный rigged `barsik.glb` с walk-анимацией — ожидается от владельца/Meshy.
5. **VO:** TTS есть; проф. KK — опционально.

---

## Следующие шаги

1. Ручной плейтест M0–4 с секундомером.
2. Mobile скриншоты 390×844.
3. Выборочно: fireflies на L3, creek water на L1 (если не ломает читаемость).
4. Рефактор `Mission1Scene` → extend `BaseLevelScene` (отдельная задача).

---

## Источники

- `docs/AGENT_HANDOFF_LEVELS_1_4.md` §Этап 0
- `docs/MISSION0_AUDIT.md`
- `docs/SEASON_1_FULL_SPEC.md` §16
