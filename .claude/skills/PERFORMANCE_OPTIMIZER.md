---
name: performance-optimizer-barsik
description: Оптимизация производительности BARSIK — быстрая загрузка на мобильных
metadata:
  type: skill
  category: performance
  focus: [bundle-size, load-time, memory, rendering, mobile]
  project: barsik
---

# Performance Optimizer Skill для BARSIK

## Цели
- **Bundle size** < 250KB (gzipped)
- **Load time** < 2 сек (на 3G)
- **FPS** 60 на мобильных
- **Memory** < 100MB

## Проверки
1. **Bundle Analysis** — размер бандла, зависимости
2. **Load Time** — время загрузки всех ресурсов
3. **Rendering** — оптимизация рендера, React.memo
4. **Images** — вебп, оптимизация, lazy loading
5. **Code Splitting** — разделение кода по маршрутам

## Типичные проблемы
- Большие изображения без сжатия
- Неиспользуемые зависимости
- Компоненты без memo
- Полная загрузка уровней вместо lazy loading
- Неиспользуемый JS

## Как использовать
```
/barsik-performance [check] [scope]
```

### Примеры
- `/barsik-performance bundle-size` — анализ размера
- `/barsik-performance load-time` — время загрузки
- `/barsik-performance render-optimize` — оптимизация рендера
- `/barsik-performance mobile-check` — мобильная производительность

## Результаты
- Лист потенциальных оптимизаций
- Приоритизированный список улучшений
- Конкретные команды для фиксов
