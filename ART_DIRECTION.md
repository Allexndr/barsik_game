# ART DIRECTION — Путешествие Барсика

## 1. Общий стиль

**Название**: Cute 3D Soft Toy / Kawaii Plastic  
**Визуальный язык**: 3D-rendered игрушки из мягкого пластилина/пластика. Все объекты круглые, дружелюбные, с мягкими тенями. Нет острых углов.  
**Настроение**: яркое, доброе, волшебное, безопасное для детей 5–12 лет.

## 2. Палитра

- **Primary (3D / brand plush)**: warm sky cyan + pear yellow — see also UI lock in `design.md` (**Barsik Hum**: cream / pear / cyan / coral). Avoid purple-violet UI defaults.
- **Secondary**: `#EF6B3A` (coral) — accents, CTA pop
- **Tertiary**: `#F0D24A` (pear) — звёзды, награды, выделение
- **Success**: `#5FBF7A` (mint) — прогресс, forest
- **Info**: `#2AA8D8` (cyan) — лёд, вода, небо, links
- **Surface**: cream `#F7F3E3` — marketing / hub paper
- **Text**: `#1C2430` — cool near-black, не чистый чёрный
- **Legacy violet** (`#6C5CE7`) — deprecated for new UI; keep only if an old asset already uses it

## 3. Персонаж

**Барсик** — детёныш снежного барса. **Канон персонажей = `photos/`** (см. `docs/BRAND_CANON.md`).

- **Игровой дефолт (упаковка)**: красное худи + синие джинсы + красная тюбетейка + прозрачные очки. Меховая база с пятнами; шмот — wardrobe. Альтернатива trio: зелёное худи + синяя тюбетейка + жёлтые очки.
- **Маскот-варианты**: зелёные очки / красная кепка / голубые горные очки — только гардероб.
- **Не канон героя**: Hyper3D nude plush.
- **Пропорции**: голова большая, тело маленькое, лапы короткие, хвост пушистый.
- **Стилистика**: soft-toy / polished mascot, rounded forms.

### Позы для sprite-sheet

1. `idle` — стоит/сидит, дыхание, моргание.
2. `run` — 6–8 кадров бега, профиль, право.
3. `jump` — взлёт, 3 кадра.
4. `fall` — падение/приземление, 3 кадра.
5. `celebrate` — радуется, лапы вверх.
6. `wave` — машет лапой, для меню.

## 3b. Environment look (Three.js Season 1)

Цель кадра — **stylized sunny toy-world**, не фотореализм и не uncanny AI faces:

- **Небо**: `#8fd8f5` fog + `skyDome`, мягкие облака; fill + rim lights из `BaseLevelScene.setupLighting`.
- **Земля**: `makeGrassTexture` / snow|ice winter presets — не плоский серый plane.
- **Деревья / props**: Kenney nature kit через `loadTrees` / `loadProps` / `layTrail`; landmarks через `s1Place` (2–6 на уровень).
- **Тропа**: dirt quads + stone trail + sparse yellow breadcrumbs — не «светящийся конвейер».
- **Камера**: intro keyframes → follow back ~9 / height ~5.5–6; bloom via `QualityPipeline`.
- **Запрет**: фиолетовый ambient, glassmorphism, random Meshy clutter без cast map.

UI marketing tokens: `design.md` (Hallmark · Barsik Hum).

## 4. Фоны и safe zones

### Принцип

Фон разбит на 3–5 parallax-слоёв. Каждый слой — **бесшовный по горизонтали**.

### Safe zones

- **Top 12%** — зона HUD. Не размещать яркие объекты, спокойное небо.
- **Center 40%** — зона персонажа и игровых объектов. Можно декорации, но не перегружать.
- **Bottom 25%** — зона земли/дорожки. Читаемая, не сливается с персонажем.
- **Left 20%** — персонаж бежит слева, поэтому справа — спавн объектов.

### Слои parallax

1. **Sky** — самый далёкий, движется медленнее всего (x 0.1).
2. **Far** — горы/город вдали (x 0.25).
3. **Mid** — деревья, дома, холмы (x 0.5).
4. **Near** — кусты, забор, цветы (x 0.8).
5. **Ground** — земля под ногами (x 1.0).

### Миры

| Мир | Настроение | Основные цвета |
|-----|------------|----------------|
| Фруктовый лес | ягодный, сладкий | зелёный, красный, жёлтый |
| Ледяная долина | холодное, сияющее | голубой, белый, серебряный |
| Радужная страна | волшебное, яркое | радуга, розовый, жёлтый |
| Горы Барсика | горное, свежее | коричневый, зелёный, белый |
| Город Колы | весёлый, сладкий | фиолетовый, голубой, розовый |
| Город Друзей | праздничный, тёплый | жёлтый, оранжевый, золото |

## 5. UI

### Принцип

UI — не картинки, а **CSS + SVG/эмодзи**. Это даёт:
- 100% единообразие.
- Лёгкую адаптацию под любой фон.
- Вес файлов почти ноль.
- Hover/pressed/disabled states без лишних ассетов.

### Элементы

- **Кнопки**: rounded-28px, gradient, shadow, glow на hover, scale на нажатие.
- **Панели**: glassmorphism — `rgba(255,255,255,0.85)` + `backdrop-filter: blur(12px)`.
- **Иконки**: эмодзи + CSS, или SVG-иконки из одного набора.
- **Типографика**: `Baloo 2` — rounded, friendly.
- **HUD**: top bar, translucent, не конфликтует с фоном.

## 6. Анимации

### Персонаж

- sprite-sheet анимация, 8 fps.
- idle — дыхание + моргание.
- run — цикл 6–8 кадров.
- jump — взлёт/падение/приземление.

### Окружение

- parallax — все 5 слоёв.
- облака / листья — медленный дрейф.
- партикулы — звёзды, сердечки, снег, пузыри.

### UI

- fade/slide/scale transitions между экранами.
- bounce на кнопках.
- shimmer на наградах.
- confetti на победе.

## 7. Звук

- **Музыка**: лёгкая,Loop, positive, не навязчивая.
- **SFX**: прыжок, сбор, удар, победа, кнопка, сундук.
- Источник: Kenney Audio, OpenGameArt, freesound (бесплатно).

## 8. Технические требования

- Canvas 1920×1080 logical, CSS 100% viewport.
- `devicePixelRatio` поддержка.
- Файлы: WebP/PNG, прозрачность для персонажей и объектов.
- Lazy load для уровневых фонов.

## 9. Пайплайн генерации (бесплатный, без AI API)

1. **Персонаж**: использовать существующие `barsik_*.png` спрайты. Добавить CSS-варианты костюмов через overlay-иконки.
2. **Друзья**: заменить эмодзи на SVG-иконки/символы или процедурные canvas-спрайты (цвет + форма + глаза), нарисованные в коде.
3. **Фоны**: полностью процедурные — CSS-градиенты + canvas parallax холмы/облака/снежинки.
4. **UI**: CSS + SVG inline icons, без внешних UI-картинок.
5. **Эффекты**: Canvas/CSS particle systems (звёзды, сердечки, пыль, конфетти).
6. **Звук**: бесплатные SFX с OpenGameArt / freesound / Kenney.

## 10. Принцип «Asset-free where possible»

- Не генерировать новые растровые картинки без явного запроса пользователя.
- Все декоративные элементы делать через CSS/SVG/canvas.
- Барсик остаётся PNG; всё остальное — вектор/процедура.

---

## 11. STYLE LOCK v2 (полный визуальный реген)

Пользователь утвердил полный реген всех «дешёвых» плоских SVG-ассетов в единый
soft-3D plush toy стиль. Раздел 10 выше отменяется для этого этапа — картинки
генерируем.

### Единый дизайн-код (эталон)

Референс всей стилистики — существующий спрайт `assets/barsik_run.png`
(детёныш снежного барса, плюшевый soft-3D рендер). Каждая партия генераций
персонажей/предметов передаёт этот файл как reference image, чтобы держать
единый визуальный язык.

### Правила стиля (обязательные для каждого промпта)

- Soft 3D / plush toy рендер: округлые формы, мягкий subsurface, лёгкий rim light.
- Большая голова, короткое тело, короткие лапки, крупные добрые блестящие глаза.
- Дружелюбное выражение, безопасно для детей 5–12.
- Изолированный объект по центру, на ровном фоне, БЕЗ текста, БЕЗ watermark,
  БЕЗ UI-элементов.
- Палитра UI: primary `#6C5CE7`, accent `#FD79A8`, gold `#FDCB6E`,
  success `#00B894`, info `#0984E3`, surface = white glass.
- Шрифт: Baloo 2. В основном UI (кнопки/HUD) — PNG-иконки, не emoji.

### Шаблон промпта

```
Cute soft-3D children's game <SUBJECT>, plush toy style matching the reference
Barsik snow leopard cub: fluffy fur / smooth rounded volumes, soft subsurface
lighting, gentle rim light, friendly, big sparkly eyes where applicable,
centered, isolated on a plain solid white background, no text, no watermark,
high quality game asset.
```

### Пайплайн генерации → игра

1. `GenerateImage` (aspect 1:1 для объектов/персонажей, 16:9 для фонов),
   reference = `barsik_run.png`, фон — сплошной белый.
2. Файл сохраняется в кэш-папку Cursor → обрабатывается скриптом
   `tools/prep_asset.py`:
   - flood-fill фона от углов → альфа (внутренние белые части сохраняются);
   - trim прозрачных полей;
   - resize до целевого размера (персонажи ~512, иконки ~256, фоны без ресайза);
   - запись в `assets/<группа>/<slug>.png`.
3. Пути прописываются в `js/data.js`; рендер (`game.js` / `ui.js`) читает PNG,
   с graceful-fallback на старый SVG/emoji, если файл не загрузился.

### Структура папок ассетов

`assets/{chars, friends, obstacles, items, worlds, bg, map, city, ui, audio}`

### Что оставляем как есть (уже на стиле)

- `assets/barsik_*.png` — поза-спрайты Барсика (это и есть эталон стиля).
- `assets/bg_*.png` + parallax-слои `_sky/_far/_mid/_near` — качественные
  painted-фоны; их не регенерируем, а ПОДКЛЮЧАЕМ в рендер.
- `assets/map.png` — painted travel-карта; показываем как фон хаба.
