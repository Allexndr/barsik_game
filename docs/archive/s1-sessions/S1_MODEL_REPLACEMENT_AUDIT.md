# S1 Model Replacement Audit

> 2026-08-25 · Что процедурное / что GLB · приоритеты замены soft-3D  
> Style lock: `ART_DIRECTION.md` (plush, rounded, child-safe)

## Вердикт

| Слой | Сейчас | Цель |
|------|--------|------|
| **Персонажи (друзья)** | Meshy tiny → **Hyper3D aya/zhuldyz/putalo в `chars/*.glb`** | Hedgehog/squirrel/ice_master/yagodka/aibek → `meshy_s1_quality_batch` |
| **Герой Барсик** | Procedural `BarsikAvatar` (ходьба/одежда) | **Не** менять на static Hyper3D; `barsik_quality.glb` = галерея / будущий rig |
| **Хаб ландмарки** | Procedural shells **сняты**; GLB (+ Hyper3D prefer) | Фонтаны/лампы/деревья — quality pack |
| **Геймплей-пропы** | CAST + kit + make* fallback | `PROP_QUALITY` → `s1_quality_*.glb` |
| **Небо / облака** | `DayCycle` dome + procedural spheres | Облака → `s1_quality_cloud.glb` (async upgrade) |
| **Трава** | `WindGrass` GPU blades | Оставляем (инстансы); опционально tuft GLB для клумб |
| **Снег / частицы** | Points snowfall | Catchable snowflake → quality GLB; Points оставляем |
| **Бабочки** | Shared plane wings | `s1_quality_butterfly.glb` (после генерации) |

## Хаб (фокус)

| Локация | GLB сейчас | Было procedural (убрано) |
|---------|------------|---------------------------|
| Arbat | яблоко@-25, еда, NPC, шмотки, aya/putalo ambient | `buildAppleMonument` |
| Panfilova | яблоко, stalls, zhuldyz | — |
| Park28 | cathedral Hyper3D→Meshy, памятник@-22,22 | `buildCathedral`, `buildMemorial` |
| KBTU | university Hyper3D→Meshy, студенты | `buildUniversity` |
| TYUZ | theatre Hyper3D→Meshy | `buildTheatre` |

Файлы: `hubDressing.ts`, `places.ts`, `tools/meshy_hub_batch.py`

## Персонажи (фокус)

| ID | Было | Стало / план |
|----|------|----------------|
| aya | 398K Meshy | **1.5M Hyper3D** (`chars/aya.glb`) |
| zhuldyz | 121K | **1.7M Hyper3D** |
| putalo | 315K | **1.6M Hyper3D** |
| barsik | Avatar procedural | `barsik_quality.glb` на диске; gameplay = avatar |
| hedgehog…aibek | tiny Meshy | генерация quality batch |
| Legacy | `*_meshy_legacy.glb` | откат при необходимости |

## По уровням — топ замен

| L | Интерактив | Env | P0 замена |
|---|------------|-----|-----------|
| 0 | yurt, dombra, lantern, pegs | forest+river | yurt, dombra, felt, stones, Zhuldyz ✓ |
| 1 | makeFruit, sticky, bridge | sculpted | sticky berry, apple, Aya ✓ |
| 2 | apples, baskets, sluice | forest | quality apple, Zhuldyz ✓ |
| 3 | tracks, oak, hedgehog | forest | hedgehog remesh |
| 4 | bridge kit+proc, Aya | custom grass | Aya ✓, bridge quality |
| 5 | acorn key, treehouse, squirrel | forest | acorn key, squirrel |
| 6 | stump, magic trees, Putalo | forest | stump, Putalo ✓ |
| 7 | Putalo, sticky, photo | forest | Putalo ✓, camera |
| 8 | party table, cast | dusk forest | Hyper3D guests ✓ |
| 9 | chest, berry, guards | forest | chest, berry, fox/owl |
| 10 | gifts, snowman teaser | cool forest | Putalo/Zhuldyz ✓ |
| 11–15 | snowman, scarf, ice | winter | snowman, snowflake, ice key, Aya ✓ |
| 16 | chest, group photo | winter | Hyper3D cast ✓ |

## Инструменты

```bash
python3 tools/meshy_s1_quality_batch.py          # cast + props + cloud/butterfly
python3 tools/meshy_hub_batch.py                 # hub pack (уже прогнан)
python3 tools/rebuild_gallery_manifest.py
```

## Что сознательно НЕ GLB

- **Terrain sculpt** (`LevelTerrain`) — коллизии/геймплей
- **WindGrass** — тысячи инстансов; один GLB tuft только для декора
- **Sky dome gradient** — DayCycle; не HDRI без арт-пасса
- **River shader** — `RiverWater`
- **Hero locomotion** — avatar > static Hyper3D

## Статус внедрения (этот проход)

- [x] Audit документ
- [x] Hyper3D → aya/zhuldyz/putalo в chars
- [x] Hub landmark shells removed; Hyper3D prefer
- [x] `PROP_QUALITY` + cloud upgrade hook
- [x] Cast remesh (hedgehog…bird) via `meshy_s1_quality_batch`
- [x] L0 yurt/dombra async quality swap (fallback procedural)
- [x] Butterfly quality swap (no-hinge bob)
- [ ] Остальной `s1_quality_*` pack (batch ещё крутится) → auto via `PROP_QUALITY`
- [ ] Felt/stepping stones — **не** GLB (геймплей userData / platforms)
