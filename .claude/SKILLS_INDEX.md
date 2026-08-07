# 🎮 BARSIK Skills Index

Все установленные skills для разработки игры BARSIK находятся в `.claude/skills/`.

## Установленные Skills

### 1. **Game Developer** (`GAME_DEVELOPER.md`)
Помощь с дизайном уровней, механиками, progression-системами.
```bash
/barsik-game-design level-config 15
/barsik-game-design progression-curve
/barsik-game-design friend-unlock-timing
```

### 2. **UI/UX Designer** (`UI_UX_DESIGNER.md`)
Переделка интерфейса в премиум-стиль, адаптивность, иерархия.
```bash
/barsik-ui-redesign main-menu
/barsik-ui-redesign responsive-check
/barsik-ui-redesign color-system
```

### 3. **Code Refactor** (`CODE_REFACTOR.md`)
Упрощение кода, удаление дублей, оптимизация, type-safety.
```bash
/barsik-refactor components simplify
/barsik-refactor performance audit
/barsik-refactor types strengthen
```

### 4. **Level Designer** (`LEVEL_DESIGNER.md`)
Проектирование всех 100 уровней, кривая сложности, нарратив уровней.
```bash
/barsik-level-design generate-all
/barsik-level-design difficulty-curve
/barsik-level-design world-theme 3
```

### 5. **Performance Optimizer** (`PERFORMANCE_OPTIMIZER.md`)
Bundle size, load time, FPS оптимизация для мобильных.
```bash
/barsik-performance bundle-size
/barsik-performance load-time
/barsik-performance mobile-check
```

### 6. **Architecture Reviewer** (`ARCHITECTURE_REVIEWER.md`)
Структура проекта, модули, паттерны, масштабируемость.
```bash
/barsik-architecture audit
/barsik-architecture state-management
/barsik-architecture scaling-plan
```

### 7. **Narrative Writer** (`NARRATIVE_WRITER.md`)
Лор, диалоги, истории персонажей, казахский контекст.
```bash
/barsik-narrative characters-generate
/barsik-narrative main-story
/barsik-narrative dialogues-world 2
```

## Как использовать

1. **Прочитай описание skill** в соответствующем .md файле
2. **Выбери нужное действие** из примеров
3. **Запусти команду** в формате `/barsik-[skill] [action] [params]`
4. Получи результаты и интегрируй в проект

## Приоритеты использования

### Phase 1 (Текущая) — Структура и архитектура
- `/barsik-architecture audit` — понять текущее состояние
- `/barsik-level-design generate-all` — создать конфиги всех 100 уровней

### Phase 2 — UI/UX полировка
- `/barsik-ui-redesign main-menu`
- `/barsik-ui-redesign responsive-check`
- Остальные экраны по очереди

### Phase 3 — Контент и нарратив
- `/barsik-narrative characters-generate`
- `/barsik-narrative main-story`
- Диалоги для всех уровней

### Phase 4 — Оптимизация
- `/barsik-performance bundle-size`
- `/barsik-performance load-time`
- `/barsik-refactor components simplify`

## Файлы проекта для изменения

- `src/components/` — UI компоненты
- `src/game/` — игровая логика
- `src/styles/` — стили
- `src/data/` — конфиги (уровни, персонажи)
- `CLAUDE.md` — документация проекта

## Контакты с Бэком

При работе с API:
- Base URL: `https://api.barsik.me` (если есть)
- Endpoints: `/levels`, `/progress`, `/friends`, `/rewards`
- QR API: `/qr-unlock`

## Дополнительно

- Палитра цветов: `.claude/design/PALETTE.md`
- Brand guide: `.claude/design/BRAND_GUIDE.md`
- Level templates: `.claude/data/level-templates/`
- Character profiles: `.claude/data/characters/`
