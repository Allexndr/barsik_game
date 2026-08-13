# BARSIK skills index

## Канонический workflow

Для gameplay, камеры, управления, уровней, коллизий, квестов, HUD и игрового QA
используется один источник правил:

- `.agents/skills/barsik-game-director/SKILL.md`

Он требует цикл `Анализ → План → Патч → QA`, реальное прохождение, журнал
изменений и проверку desktop/mobile. Маршрутизация закреплена также в `AGENTS.md`
и `CLAUDE.md`.

## Совместимые Claude entries

- `skills/GAME_DEVELOPER.md` — alias на BARSIK Game Director;
- `skills/LEVEL_DESIGNER.md` — alias для level-design задач;
- `skills/NARRATIVE_WRITER.md` — alias для нарратива в рамках канона;
- `skills/UI_UX_DESIGNER.md` — дополнительная UI/UX специализация;
- `skills/PERFORMANCE_OPTIMIZER.md` — дополнительная performance специализация;
- `skills/ARCHITECTURE_REVIEWER.md` — дополнительный архитектурный аудит;
- `skills/CODE_REFACTOR.md` — дополнительный локальный рефакторинг.

Дополнительные специализации не переопределяют `BARSIK Game Director`,
`CLAUDE.md`, `AGENTS.md` или `docs/CANON_RECONCILIATION.md`.

## Актуальный scope

- Season 1: L0–L16;
- Forest и Winter — игровые миры сезона;
- прочие миры — только тизеры до отдельного продуктового решения;
- целевая продолжительность содержательного уровня задаётся актуальным gameplay
  blueprint, а не устаревшими генераторами уровней.
