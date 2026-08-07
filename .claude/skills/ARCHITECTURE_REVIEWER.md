---
name: architecture-reviewer-barsik
description: Архитектурный ревью для BARSIK — структура, модули, паттерны
metadata:
  type: skill
  category: architecture
  focus: [architecture, patterns, scalability, maintainability]
  project: barsik
---

# Architecture Reviewer Skill для BARSIK

## Текущая архитектура
```
src/
├── components/     # React компоненты (UI, Game, screens)
├── game/           # Игровая логика (levels, progression, friends)
├── utils/          # Вспомогательные функции
├── hooks/          # Custom React hooks
├── styles/         # CSS/SCSS
├── assets/         # Images, models, sounds
└── types/          # TypeScript interfaces
```

## Проблемы для решения
1. **Модульность** — хорошо ли разделены ответственности?
2. **Масштабируемость** — легко ли добавить 100 новых уровней?
3. **Состояние** — Redux / Zustand / Context? Сейчас что?
4. **API** — как фронт говорит с бэком?
5. **Конфиги** — уровни, друзья, награды — как хранятся?

## Проверки
- Нет циклических зависимостей
- Компоненты не знают друг о друге напрямую
- Бизнес-логика отделена от UI
- Config-driven дизайн (JSON конфиги, не хардкод)
- Type-safe везде

## Как использовать
```
/barsik-architecture [action] [scope]
```

### Примеры
- `/barsik-architecture audit` — полный аудит
- `/barsik-architecture state-management` — проверка состояния
- `/barsik-architecture scaling-plan` — план масштабирования
- `/barsik-architecture refactor-roadmap` — план рефакторинга

## Результаты
- Диаграмма компонентов
- Лист рекомендаций
- Приоритизированная road map
