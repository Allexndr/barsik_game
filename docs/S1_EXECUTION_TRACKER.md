# S1 Execution Tracker — полный Season 1 по `SEASON_1_FULL_SPEC.md`

> Старт: 2026-08-03 · Обновлено: 2026-08-04 (quality tiers)

## DoD (из S1_COMPLETION_PLAN §0)

17 уровней без soft-lock · карта 10/7 · RU/KK · mobile ≥30 · meta · regression

## Статус аудита

| Audit item | Статус |
|------------|--------|
| Wire snowman / wood_sign / aya L14 | ✅ |
| L8 / L10 / L16 cast | ✅ |
| Persist ice key | ✅ `barsik_ice_key` (prod без auto-grant) |
| Persist acorn key | ✅ `KEY_ACORN` / `writeFlag` (L5→L9) |
| ice_master / yagodka / bird / stump | ✅ |
| City cast GLB | ✅ |
| S1 Meshy/Kenney props wired | ✅ laconic + kit fill |
| **WinterEnvironment shared** | ✅ `BaseLevelScene.setupWinterEnvironment` (L11–16) |
| **L1 water** | ✅ `WaterSurface` creek + shared `streamSegment`/`bridge` |
| **L1 full → BaseLevelScene class** | ✅ `Mission1Scene extends BaseLevelScene` (~1327→693 lines); loadTrees/Props/layTrail + activate/QP |
| **QR / finale productize** | ✅ keys honest, L16 friends filter, outro CTA → QR tab, `season1Complete` |
| **FPS sampler** | ✅ `?fps=1` → console avg/p5 every 10s |
| visibility pause | ✅ `visibilitychange` → `setPaused(true)` |
| Footstep cadence + surface SFX | ✅ grass/snow/ice cadence in Base + Mission0 |
| Ice valley mechanic SFX | ✅ L11 sparkle, L12 slip/bonus, L14 found/whoosh, L9/L16 chest |
| Hallmark Welcome / design.md | ✅ Barsik Hum; ART_DIRECTION §3b env look |
| **Depth pass** (L6 clues, L9 seals, L10 gifts/farewell, L14 drifts, L16 prep) | ✅ см. `S1_DEPTH_PASS.md` |
| **Quality tiers** (`?quality=low|medium|high`) | ✅ pixel ratio + shadows + postprocess profile |
| Portrait camera offsets (narrow screens) | ✅ Mission0 + Mission1 follow cam bias |
| Full screenshot / mobile matrix | ⏳ manual via `?mission=N&lang=` |
| Premium-bar parity L1–L16 vs L0 | ✅ Mission0 + Mission1 на Base stack |
| Mission0 → BaseLevelScene | ✅ `Mission0Scene extends BaseLevelScene` |

**Verdict:** S1 **играбелен end-to-end**. Depth-pass на тонких уровнях; e2e playtest и mobile matrix — вручную.

## Каст Meshy

| ID | Файл | Статус |
|----|------|--------|
| barsik | chars/barsik.glb | ✅ static Image-to-3D (не rigged) |
| aya / putalo / zhuldyz / squirrel / hedgehog | chars/* | ✅ |
| ice_master / yagodka / bird / aibek | chars/* | ✅ |
| props + s1_kit_* | props/* | ✅ |

## Очередь (остаток polish)

1. Screenshot / FPS matrix на реальном mobile (`?mission=N&lang=&fps=1`)
2. Barsik skins Image-to-3D по запросу
3. Meshy credits → plush scarf + style-match fence
4. Season 2 kickoff по `SEASON_2_SPEC.md` после S1 visual lock
