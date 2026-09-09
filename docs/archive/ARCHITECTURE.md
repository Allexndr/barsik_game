# 🎮 BARSIK LAND — React SPA Architecture

**Статус:** В разработке  
**Версия:** 1.0 (React Rewrite)  
**Дата:** 2026-07-18

---

## ✅ Что сделано (Фаза 0–1)

### Setup & Configs ✓
- [x] `vite.config.ts` — сборка, оптимизация, dev-сервер на 8765
- [x] `tsconfig.json` — TypeScript конфиг с path mapping (`@/*`)
- [x] `package.json` — React 18, Vite, Zustand, Three.js

### Global & Foundation ✓
- [x] `src/index.css` — глобальные стили, переменные (цвета, отступы, анимации)
- [x] `src/main.tsx` — React entry point
- [x] `src/App.tsx` — корневой компонент с логикой экранов

### State Management ✓
- [x] `src/store/useGameStore.ts` — Zustand: игрок, друзья, уровни, звёзды, город
- [x] `src/store/useUIStore.ts` — Zustand: текущий экран, вкладки, модалы
- [x] `src/types/index.ts` — все TypeScript интерфейсы

### Components — Auth & Layout ✓
- [x] `src/components/LoginScreen.tsx` — регистрация (ник, пол, возраст, телефон, язык)
- [x] `src/components/LoginScreen.css` — дизайн с градиентом
- [x] `src/components/NavBar.tsx` — top navbar (вкладки, звёзды, аватар, настройки)
- [x] `src/components/NavBar.css` — адаптивный дизайн
- [x] `src/components/BottomActionBar.tsx` — нижняя панель (кнопка играть, режимы, пригласить, прогресс-полоса 100 пинов)
- [x] `src/components/BottomActionBar.css` — grid-layout для мобилы

### Components — Main Screens ✓
- [x] `src/components/screens/TravelMapScreen.tsx`
- [x] `src/components/screens/FriendsScreen.tsx`
- [x] `src/components/screens/CityScreen.tsx`
- [x] `src/components/screens/ShopScreen.tsx`
- [x] `src/components/screens/LeaderboardScreen.tsx`
- [x] `src/components/screens/QRChestScreen.tsx`
- [x] `src/components/screens/EpisodeScreen.tsx`
- [x] Все с CSS-файлами

### Components — Widgets ✓
- [x] `src/components/widgets/SidebarTips.tsx` — левый чат от Барсика
- [x] `src/components/widgets/RewardsBar.tsx` — правый виджет мильстоунов

### Pages ✓
- [x] `src/pages/GamePage.tsx` — главный лейаут SPA (3-колоночная структура)
- [x] `src/pages/GamePage.css` — flex-layout, адаптивность

### HTML & Build
- [x] `index.html` — Vite entry point
- [x] npm install ✓
- [x] Dev-сервер на `http://localhost:8765` ✓

---

## 📊 Архитектура (текущее состояние)

```
┌──────────────────────────────────────────┐
│  App.tsx (корневой компонент)           │
│  - Логика экранов (login / game)         │
│  - Загрузка состояния из localStorage    │
└────────────────┬─────────────────────────┘
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
  LoginScreen         GamePage (SPA)
      │               ├─ NavBar
      │               ├─ game-container
      │               │  ├─ SidebarTips
      │               │  ├─ main (screens)
      │               │  │  ├─ TravelMapScreen
      │               │  │  ├─ FriendsScreen
      │               │  │  ├─ CityScreen
      │               │  │  ├─ ShopScreen
      │               │  │  ├─ LeaderboardScreen
      │               │  │  ├─ QRChestScreen
      │               │  │  └─ EpisodeScreen
      │               │  └─ RewardsBar
      │               └─ BottomActionBar
      │
   Zustand Store ◄─────┐
   - useGameStore      │
   - useUIStore        │
                       │
   LocalStorage ◄──────┴─────► Supabase (sync)
```

---

## 🎯 Следующие этапы (Фаза 2–4)

### Фаза 2: TravelMapScreen (карта интерактивная)
- [ ] Отрисовка 100 пинов (Canvas или SVG)
- [ ] Zoom/pan на мобилы
- [ ] Клик на пин → `startEpisode(levelId)`
- [ ] Визуализация статуса уровня (пройден/текущий/заблокирован)

### Фаза 3: EpisodeScreen (настоящий 3D-эпизод)
- [ ] Three.js интеграция
- [ ] Загрузка сценария из JSON
- [ ] Диалоги + VO (OpenAI TTS)
- [ ] Интерактив (помощь, поиск, выбор)
- [ ] Награда после уровня

### Фаза 4: CityScreen (3D город)
- [ ] Three.js Canvas
- [ ] Динамическое развитие города
- [ ] Друзья гуляют, сидят, взаимодействуют
- [ ] Клик на объект → описание или анимация

### Фаза 5: API Integration
- [ ] Supabase REST для сохранений
- [ ] Синхронизация друзей, прогресса, достижений
- [ ] Аналитика

---

## 🔧 Как запустить

```bash
cd barsik-game
npm install
npm run dev
```

Откроется `http://localhost:8765`

---

## 📁 File Structure (полная)

```
src/
├── main.tsx               # React entry
├── App.tsx                # Root component + router
├── App.css
├── index.css              # Global styles
├── components/
│   ├── LoginScreen.tsx    # Регистрация
│   ├── LoginScreen.css
│   ├── NavBar.tsx         # Top navigation
│   ├── NavBar.css
│   ├── BottomActionBar.tsx
│   ├── BottomActionBar.css
│   ├── screens/
│   │   ├── TravelMapScreen.tsx
│   │   ├── TravelMapScreen.css
│   │   ├── FriendsScreen.tsx
│   │   ├── FriendsScreen.css
│   │   ├── CityScreen.tsx
│   │   ├── CityScreen.css
│   │   ├── ShopScreen.tsx
│   │   ├── ShopScreen.css
│   │   ├── LeaderboardScreen.tsx
│   │   ├── LeaderboardScreen.css
│   │   ├── QRChestScreen.tsx
│   │   ├── QRChestScreen.css
│   │   ├── EpisodeScreen.tsx
│   │   └── EpisodeScreen.css
│   └── widgets/
│       ├── SidebarTips.tsx
│       ├── SidebarTips.css
│       ├── RewardsBar.tsx
│       └── RewardsBar.css
├── pages/
│   ├── GamePage.tsx       # Main SPA layout
│   └── GamePage.css
├── store/
│   ├── useGameStore.ts    # Zustand game state
│   └── useUIStore.ts      # Zustand UI state
├── types/
│   └── index.ts           # All interfaces
├── three/
│   ├── scenes/            # Coming soon
│   ├── objects/           # Coming soon
│   └── effects/           # Coming soon
└── utils/
    ├── api.ts             # Coming soon (Supabase)
    ├── levels/            # Coming soon (JSON configs)
    ├── animations.ts      # Coming soon
    └── constants.ts       # Coming soon (colors, sizes)

index.html                # Vite HTML entry
vite.config.ts           # Build config
tsconfig.json            # TS config
package.json
```

---

## 🎨 Design System

### Colors
- Primary: `#6c5ce7` (фиолет)
- Accent: `#ff7675` (красно-оранжевый)
- Accent Warm: `#fdcb6e` (жёлто-оранжевый)
- Success: `#27ae60` (зелёный)
- Star: `#f1c40f` (жёлтый)

### Fonts
- Main: `Baloo 2` (для текста, чисел)
- Display: `Nunito` (для заголовков)

### Responsive Breakpoints
- Mobile: ≤480px
- Tablet: ≤768px
- Desktop: >1024px

---

## 🚀 Dev Workflow

1. **Разработка компонента:**
   ```bash
   # Мои всегда live-reload благодаря Vite HMR
   npm run dev
   ```

2. **Добавление нового состояния:**
   - Обнови интерфейс в `src/types/index.ts`
   - Добавь action в `useGameStore.ts` или `useUIStore.ts`
   - Используй в компоненте через `const x = useGameStore((s) => s.x)`

3. **Сборка:**
   ```bash
   npm run build
   ```
   Выход в `dist/`

4. **Deploy на Vercel:**
   ```bash
   vercel
   ```

---

## ❓ FAQ

**Q: Почему Zustand?**  
A: Минимальный боilerplate, хорошо работает с TypeScript, легче, чем Redux.

**Q: Где Three.js сцены?**  
A: В `src/three/` (пока пусто). Будут подключены в EpisodeScreen и CityScreen через хук `useThreeScene()`.

**Q: Как работает адаптивность?**  
A: CSS Media queries + CSS Grid/Flexbox. На мобилах боковые сайдбары скрываются, экран растягивается.

**Q: Как скачут ассеты?**  
A: Всё в `public/assets/` будет доступно как `/assets/...` в коде. Пока подключаем через URL-строки.

---

## 🎯 Версионирование

- **v1.0:** React SPA базовая структура (текущее)
- **v1.1:** TravelMapScreen с интерактивной картой
- **v1.2:** EpisodeScreen с Three.js + сценариями
- **v1.3:** CityScreen полный с друзьями
- **v2.0:** Суперприз, рейтинги, API sync

