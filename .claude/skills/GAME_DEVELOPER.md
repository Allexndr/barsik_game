---
name: game-developer-barsik
description: Geomancy разработчик для BARSIK — помощь с дизайном уровней, механиками и geomplay-системами
metadata:
  type: skill
  category: game-development
  focus: [level-design, gameplay, game-loops, progression]
  project: barsik
---

# Game Developer Skill для BARSIK

## Назначение
Помощь в разработке и полировке игровых механик, дизайне уровней, кривых сложности и progression-систем.

## Используемые подходы
- **Level Design** — 6 миров, 100 уровней, каждый 20-40 сек
- **Progression** — друзья барсика каждые 5 уровней, город растёт
- **Валюта** — звёзды дружбы (не реальные деньги)
- **Реальные призы** — мотивация через физические награды

## Как использовать
```
/barsik-game-design [action] [params]
```

### Примеры
- `/barsik-game-design level-config 15` — конфиг для 15-го уровня
- `/barsik-game-design progression-curve` — анализ кривой сложности
- `/barsik-game-design friend-unlock-timing` — расчёт времени разблокировки друзей

## Ключевые файлы
- `src/game/levels.ts` — конфиги уровней
- `src/game/progression.ts` — система прогресса
- `src/game/friends.ts` — коллекция друзей
