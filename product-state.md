# product-state — barsik-game

> Книга 2, Глава 3. Читать с диска в начале сессии. Не из памяти чата.
> `playbook_version` ↔ `book-2-ai-team` + overlay.

```yaml
product_id: barsik-game
updated_at: "2026-08-31"
stage: quality_security   # код S1 в репо зелёный; гейт релиза = deploy + device QA + KK + ops

problem: >
  Детям 3–7 (KZ/RU) нужно спокойное приключение без проигрыша,
  где Барсик собирает друзей в Алматы; родители хотят безопасный web без магазина давления.
audience:
  user: дети 3–7, RU/KK
  buyer: родители / бренд Barsik
  geo: Kazakhstan (+ RU speakers)
value_proposition: soft-3D plush web-игра «Путешествие Барсика»; не кликер, не pay-to-win
not_this:
  - voxel/pixel pivot (отклонён)
  - landscape stretch карты на десктопе
  - фиктивные физические QR-награды до реальной упаковки
  - CityScreen-поляна как «Город» (superseded → HubScreen/Арбат)

constraints:
  stack: Vite + React 18 + Three.js + Zustand + Supabase + Vercel
  team: 1 owner + AI agents (Claude dept / Cursor)
  region: KZ, bilingual RU/KK
  budget: Meshy credits limited; Vercel на murdasoft
  child_safety: no purchase pressure on child screens; soft-fail only

decisions:
  - id: hub-is-city
    status: accepted
    summary: Вкладка «Город» = HubScreen (Арбат + подлокации), не CityScreen
  - id: style-lock-plush
    status: accepted
    summary: soft-3D plush; Barsik Hum palette (design.md / ART_DIRECTION.md)
  - id: map-portrait-desktop
    status: accepted
    summary: travel_map.png портрет, на десктопе по центру без landscape stretch
  - id: s1-code-over-gdd-l0
    status: accepted
    summary: L0 канон = код (Тропа домбры), не SEASON_1_QUALITY_GDD §6 apples
  - id: prod-host
    status: accepted
    summary: Prod https://barsik-game-xi.vercel.app (murdasoft); legacy allexndrs был 402

open_questions:
  - Когда писать в barsik_leaderboard (сейчас read-only)? → S1_REMAINING_SPEC P1-OPS-3
  - Финальный rigged barsik.glb от артиста? → EXT-1
  - city_chat.sql + Realtime RLS подтверждены? → P0-OPS-2
  - Cloud save reconciliation политика? → P1-OPS-4

assumptions:
  - Soft-lock grid §32 = 0/17; browser screenshot matrix ещё руками
  - Hub realtime OFF until VITE_HUB_REALTIME=1 after city_chat.sql
  - Чекбоксы S1_COMPLETION_PLAN §4 B1/B3 частично устарели vs код

risks:
  - L1/L2 camera regress if intro cinematic returns without follow gate
  - Enabling hub realtime without Realtime RLS

metrics:
  - DoD S1: 17 уровней без soft-lock; RU/KK; quality tiers; premium-bar по плану
  - Prod URL HTTP 200

paths:
  books_workspace: "../book-1-guidebook, ../book-2-ai-team (или symlink в корне репо)"
  memory: "../docs/PROJECT_MEMORY.md"
  overlay: "docs/playbook-overlay.md"
  board: "docs/S1_BOARD.md"
  remaining_spec: "docs/S1_REMAINING_SPEC.md"
  readiness: "docs/S1_READINESS_STATUS.md"
  completion: "docs/S1_COMPLETION_PLAN.md"
  code_map: "docs/code-map.md"
  prod: "https://barsik-game-xi.vercel.app"
```
