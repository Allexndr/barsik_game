# 🚀 Quick Start — BARSIK LAND React SPA

## ✅ Что уже работает

- **React 18 + Vite** dev-server на `http://localhost:8765`
- **Полная структура компонентов** (Login, NavBar, 6 экранов, widgets)
- **Zustand State Management** (игрок, друзья, уровни, UI)
- **Responsive CSS** (мобила, планшет, десктоп)
- **TypeScript** для типизации

## 🎯 Что делать дальше (приоритет)

### Спринт 2: TravelMapScreen (карта с пинами)
**Цель:** Игрок видит 100 уровней на интерактивной карте, может кликнуть → запуск эпизода.

```bash
# Файл для редактирования:
src/components/screens/TravelMapScreen.tsx

# Задачи:
1. Отрисовать 100 кругов (пины)
   - Пройденные: зелёные
   - Текущий: жёлтый + анимация
   - Заблокированные: серые
2. На клик → startEpisode(levelId) из useUIStore
3. На мобилы добавить zoom/pan
```

### Спринт 3: EpisodeScreen (3D + сценарии)
**Цель:** Запуск реального эпизода с историей, интерактивом, наградой.

```bash
# Файлы:
src/components/screens/EpisodeScreen.tsx (обновить)
src/three/scenes/EpisodeScene.ts (создать)
src/utils/levels/ (создать JSON конфиги)

# Задачи:
1. JSON с описанием 60 уровней (название, диалоги, награда, механика)
2. Three.js сцена для эпизода
3. Диалоговая система (текст на RU/KK)
4. Интерактив: помощь, поиск, выбор маршрута
5. Система наград (звёзды, друзья, украшения)
```

### Спринт 4: CityScreen (3D город)
**Цель:** Живой город, который растёт с прогрессом, друзья гуляют.

```bash
# Файлы:
src/components/screens/CityScreen.tsx (обновить)
src/three/scenes/CityScene.ts (создать)

# Задачи:
1. Three.js город с простой геометрией
2. Динамическое добавление объектов (домики, деревья, фонтан)
3. Анимация друзей (ходят, сидят)
4. Развитие города в 3 состояниях (начальное → среднее → полное)
```

## 📝 Как добавить новый уровень

1. **Создать JSON конфиг** в `src/utils/levels/`:

```json
{
  "id": 0,
  "chapter": 1,
  "title": "Пробуждение Барсика",
  "description": "Барсик просыпается в своём уютном домике",
  "duration": 30,
  "interactivity": "explore",
  "reward": {
    "stars": 10,
    "friend": "putalo"
  },
  "narrative": {
    "ru": "Дверь открывается медленно. Барсик видит огромные фрукты...",
    "kk": "..."
  }
}
```

2. **Загрузить в EpisodeScreen:**

```tsx
const levels = await fetch('/src/utils/levels/chapter1.json');
const level = levels[levelId];
// Рендерить
```

## 🎨 Дизайн-система (уже готова)

Все переменные в `src/index.css`:

```css
--primary: #6c5ce7    /* фиолет */
--accent: #ff7675     /* красно-оранжевый */
--success: #27ae60    /* зелёный */
--star: #f1c40f       /* жёлтый */
```

## 🔗 Полезные ссылки

- **Архитектура:** `ARCHITECTURE.md`
- **Migration план:** `MIGRATION_PLAN.md`
- **GDD:** `docs/BARSIK_GDD_v2.md`
- **Сценарий (60 уровней):** `docs/` (всё рассчитано)

## 💡 Советы для быстрой работы

1. **Dev-server уже работает:**
   ```bash
   npm run dev
   ```
   Откроет браузер на `http://localhost:8765`. Все изменения live-reload.

2. **Быстро добавить компонент:**
   ```tsx
   import './ComponentName.css';
   
   export function ComponentName() {
     return <div className="component">...</div>;
   }
   ```

3. **Использовать состояние:**
   ```tsx
   const friends = useGameStore((s) => s.friends);
   const setActiveTab = useUIStore((s) => s.setActiveTab);
   ```

4. **Добавить аутентификацию (Supabase):**
   - Создать `src/utils/api.ts` с функциями
   - Вызывать при `setPlayer` в LoginScreen

## 🎬 Демо-ход игры (как будет работать)

```
1. Пользователь вводит ник → LoginScreen
2. Переход в GamePage (SPA)
3. Видит NavBar с вкладками
4. По умолчанию TravelMapScreen (карта)
5. Кликает на 1-й уровень
6. EpisodeScreen запускается (3D сцена)
7. Диалог → интерактив → награда
8. Возврат на карту, следующий уровень разблокирован
9. Новый друг ждёт в городе
10. Кликает на CityScreen, видит его там
```

---

## ❓ Вопросы?

- **Как запустить?** `npm run dev` (готово к использованию)
- **Где коды?** `src/` (структурировано по папкам)
- **Как деплоить?** `npm run build && vercel` (после готовности)
- **Как тестировать?** Изменяй файлы, dev-server reload автоматически

---

**Готово к разработке! 🚀**
