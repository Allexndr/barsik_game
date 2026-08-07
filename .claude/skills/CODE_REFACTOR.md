---
name: code-refactor-barsik
description: Рефакторинг кода BARSIK — упрощение, оптимизация, чистота
metadata:
  type: skill
  category: code-quality
  focus: [simplification, performance, architecture, type-safety]
  project: barsik
---

# Code Refactor Skill для BARSIK

## Фокус
- Удалить мёртвый код и дублирование
- Упростить сложные компоненты
- Улучшить архитектуру
- Оптимизировать производительность
- Усилить type-safety (TypeScript)

## Приоритеты
1. **Упрощение компонентов** — сокращение на 30-50% если возможно
2. **Удаление дублей** — одна логика = одно место
3. **Типизация** — полный TypeScript, без `any`
4. **Производительность** — React memo, useCallback где нужно
5. **Dead code** — убрать неиспользуемое

## Анализ проекта
- Текущая база: React + TypeScript + Vite
- Стиль: модульный, компонентный
- Цель: Production-ready код

## Как использовать
```
/barsik-refactor [scope] [action]
```

### Примеры
- `/barsik-refactor components simplify` — упростить все компоненты
- `/barsik-refactor performance audit` — проверить производительность
- `/barsik-refactor types strengthen` — усилить типизацию
- `/barsik-refactor dead-code remove` — убрать мёртвый код

## Результаты
- Чище код
- Меньше bundle size
- Быстрее загрузка
- Легче поддерживать
