# Анализ Mission0Scene «Первое утро» — аудит по книгам

> Критический разбор уровня 0 по рекомендациям из:
> - *The Level Design Book* (layout, critical path, signposting, flow, metrics)
> - *UNITY Ebook: Introduction to Level Design* (rule of three, blockout, pacing)
> - *Designing Games for Children* (clear goals, visual feedback, no fail state)
> - *The Narrative Designer's Playbook* (Plan Backward, environmental storytelling)
> - *Game Feel* (juice, response, feedback)
> - *A Theory of Fun* (pattern intro → vary → combine)
> - *Gamebook convention* (player POV, chronological)

---

## Что хорошо ✅

1. **Critical Path** — грязная тропа с жёлтыми стрелками и glowing tiles, невозможно заблудиться
2. **Zone color coding** — 6 zone discs с разными цветами (home=зелёный, bird=тёплый, pond=синий)
3. **Landmarks** — giantAppleLandmark виден издалека, дом с дымоходом, колодец
4. **Rule of Three** — move1→move2→move3, pick1→pick2, help_collect×3
5. **No fail state** — нет урона, нет смерти, ошибки = обучение
6. **Visual feedback** — искры при сборе, praise text, bobbing fruits
7. **Quest markers** — beam + "!" над NPC, видно издалека
8. **Guide arrow** — указывает на текущую цель, вращается относительно героя
9. **Cinematic intro** — камера плавно приближается от wide shot к hero
10. **Bonus collectibles** — 6 бонусных фруктов для исследования

---

## Что нужно исправить 🔧

### Критично (P0)

**1. Нет foreshadowing Путало** — GDD планирует намёки с уровня 1, но в Mission0Scene нет липких нитей, фотографий или странных следов. *Narrative Designer's Playbook: "Setup must precede payoff"*

**2. Bonus collectibles плохо signposted** — guide arrow игнорирует их, нет визуального отличия от quest fruits. *Level Design Book: "Golden path must be visually distinct from critical path"*

**3. Quest fruits появляются внезапно** — они invisible до фазы help_collect, потом pop in. *Game Feel: "No sudden visual changes without anticipation"*

**4. Большие пустые пространства** — между z=-20 и z=-35 почти нет интерактивного контента. *Level Design Book: "Flow must maintain interest throughout"*

### Важно (P1)

**5. Нет audio feedback** — книги по детским играм подчёркивают важность звука. *Designing Games for Children: "Audio files are space hogs but essential for children"*

**6. Intro только текст** — 5-6 летние не читают, нужны визуальные подсказки. *Designing Games for Children: "Simplify text, ensure young children don't try to read"*

**7. Скорость меняется без визуального индикатора** — baseSpeed → runSpeed без feedback. *Game Feel: "Every state change must have visual/audio response"*

**8. Camera может клиппить через дом** — при hero.z≈12, camera на z+9.5=21.5, дом на z=12 с depth=3.6. *Level Design Book: "Camera must never clip through geometry"*

### Менее критично (P2)

**9. Нет idle-анимации NPC** — садовник и птичка стоят неподвижно. *Game Feel: "Idle characters feel dead"*

**10. Нет day-night cycle hint** — уровень называется «Первое утро» но свет не меняется. *Narrative: "Title should match experience"*

**11. Dispose не очищает sharedGeos/Mats** — sharedFruitGeometry и sharedRingMaterial не диспозятся, но они и не должны (shared across levels). Однако fruitMatCache растёт. *Tech debt*

**12. Нет keyboard hint для E/Space** — showActionHint показывает кнопку но не объясняет клавишу. *Onboarding*

---

## Исправления (минимальные, без переделки архитектуры)

### Fix 1: Foreshadowing Путало
Добавить 2-3 липкие нити возле кустов на тропе (z=-15..-20) — визуальный намёк.

### Fix 2: Bonus collectibles — отличный визуал
Сделать бонусные фрукты золотыми (0xf1c40f) с уникальным ring цветом (0xffe066) и добавить guide arrow к ближайшему бонусу когда нет основного интеракта.

### Fix 3: Quest fruits — fade in вместо pop in
Вместо visible=true, использовать opacity 0→1 за 0.5с.

### Fix 4: Заполнить пустое пространство
Добавить декоративные элементы (bushes, flowers, small rocks) между z=-20 и z=-35.

### Fix 5: Idle NPC анимация
Добавить лёгкое покачивание садовника и птички (bobbing).

### Fix 6: Keyboard hint
Добавить "E" или "Space" в action hint.

### Fix 7: Camera clamp
Ограничить camera.z чтобы не клиппить через дом.
