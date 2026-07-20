# MIGRATION: Vanilla → React SPA

## Цель
Переписать barsik-game с vanilla JS на **React 18 + Vite + TypeScript**, сохраняя весь контент и логику.

## Этапы

### Фаза 0: Setup (сегодня)
- [ ] Инициализация `npm create vite@latest . -- --template react-ts`
- [ ] Структура папок `/src/components`, `/src/pages`, `/src/three`, `/src/store`, `/src/types`, `/src/utils`
- [ ] Переносим ассеты (PNG, GLB, audio, fonts)
- [ ] Zustand setup для состояния

### Фаза 1: Auth & Base Layout (день 1–2)
- [ ] LoginScreen.tsx (регистрация как сейчас)
- [ ] NavBar.tsx (вкладки: Путешествие, Друзья, Город, Магазин, Рейтинги, QR)
- [ ] GamePage.tsx (корневой лейаут + router между экранами)
- [ ] Система хранения (LocalStorage + Supabase sync)

### Фаза 2: Core Screens (день 2–4)
- [ ] TravelMapScreen.tsx (интерактивная карта + пины 100 уровней)
- [ ] CityScreen.tsx (3D город Three.js, друзья, украшения)
- [ ] FriendsScreen.tsx (коллекция, карточки, редкость)
- [ ] ShopScreen.tsx (костюмы, украшения, эмоции)
- [ ] LeaderboardScreen.tsx (дружеские рейтинги)
- [ ] QRChestScreen.tsx (волшебный сундук, частицы)

### Фаза 3: Gameplay (день 4–6)
- [ ] EpisodeScreen.tsx (3D-эпизод, диалоги, интерактив)
- [ ] Система уровней: JSON конфиги для 60 эпизодов
- [ ] Механика: помощь, поиск, выбор маршрута
- [ ] Система наград: друзья, звёзды, украшения

### Фаза 4: Three.js Scenes (день 5–7)
- [ ] CityScene.ts (3D город, развитие, друзья гуляют)
- [ ] EpisodeScene.ts (3D сцена уровня)
- [ ] HubScene.ts (обновление текущего хаба)
- [ ] Объекты: Barsik, Friend, Building, Prop
- [ ] Effects: частицы, переходы

### Фаза 5: Polish & Deploy (день 7–8)
- [ ] Анимации, звук, VO
- [ ] Адаптивность (мобила, планшет, десктоп)
- [ ] Vercel deploy
- [ ] QA

---

## Что сохраняем
- Supabase `barsik_saves`, `barsik_leaderboard`
- Все ассеты (PNG, GLB, audio)
- Логика игры (друзья, уровни, город)
- Дизайн UI (цвета, типография, боксмодель)

## Что переделываем
- Структура JS → компоненты React
- Vanilla DOM → JSX
- GlobalState → Zustand + Context
- Three.js хук вместо глобального `window.scene`

---

## К концу спринта
- [ ] Браузерная SPA (никаких перезагрузок)
- [ ] Все экраны работают
- [ ] Первые 3 уровня Фруктового леса (эпизоды)
- [ ] 3D город + хаб
- [ ] QR механика
- [ ] Готово к Vercel

