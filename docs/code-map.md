# code-map — barsik-game (S1)

> Книга 2, 8.5 / 12.5. Полстраницы, не роман.

## Вход

- UI shell: `src/App.tsx` → tabs / lazy screens
- Игра: `src/pages/GamePage.tsx` — travel / friends / **city→HubScreen** / shop / …
- Уровни: `Mission0Screen` + `MissionScreen` → `src/three/scenes/Level*Scene.ts` / `Mission*Scene.ts`
- Общий 3D lifecycle: `src/three/scenes/BaseLevelScene.ts`
- Хаб Алматы: `src/components/screens/HubScreen.tsx` + `src/three/scenes/hub/*`
- Quality: `src/three/renderQuality.ts`
- Save / stars: Zustand stores + Supabase `barsik_saves`
- Leaderboard: `src/utils/leaderboard.ts` (**read-only**)

## Опасно

- Двойная выдача звёзд / soft-lock в фазах уровней
- Dispose shared materials / WebGL context leaks
- Секреты: `.env` (MESHY, Supabase service role — не в клиент)

## Legacy (не точка входа)

- `js/*`, `css/style.css` — старый vanilla; `index.html` → Vite `src/main.tsx`
- `CityScreen` / `CityScene` — не на маршруте «Город» (HubScreen); не удалять без confirm
- `public/voxel-prototype/` — эксперимент, не продукт

## Тесты / QA

- Ручной: `?mission=N&lang=&fps=1&quality=`
- Audit helper: `src/dev/levelAudit.ts` → `window.__audit()`
- Voice drift: `npm run voice:check`
