# 🎨 BARSIK Color Palette & Design System

## Основная цветовая система

### Primary Colors (Основные)
```css
--color-primary-warm: #FFA500;    /* Тёплый оранжевый — солнце */
--color-primary-red: #FF4444;     /* Красный — энергия */
--color-primary-blue: #4488DD;    /* Синий — казахский колорит */
--color-primary-green: #44BB77;   /* Зелёный — природа */
```

### Secondary Colors (Вторичные)
```css
--color-secondary-yellow: #FFD700;    /* Золотой — звёзды дружбы */
--color-secondary-purple: #9966DD;    /* Фиолетовый — магия */
--color-secondary-cyan: #44DDEE;      /* Голубой — лёд */
--color-secondary-coral: #FF7755;     /* Коралл — тёплый */
```

### Background Colors
```css
--color-bg-light: #F8F9FA;       /* Светлый фон */
--color-bg-white: #FFFFFF;       /* Белый */
--color-bg-light-blue: #E8F4F8;  /* Светло-голубой (льды) */
--color-bg-light-green: #E8F8E8; /* Светло-зелёный (лес) */
--color-bg-dark: #2C2C2C;        /* Тёмный (для контраста) */
```

### Text Colors
```css
--color-text-primary: #1A1A1A;     /* Основной текст (тёмный) */
--color-text-secondary: #666666;   /* Вторичный текст */
--color-text-accent: #FF4444;      /* Акцент текст */
--color-text-light: #FFFFFF;       /* Белый текст */
```

## Специальные цвета

### Status Colors
```css
--color-success: #44BB77;   /* Успех / победа */
--color-warning: #FFA500;   /* Предупреждение */
--color-error: #DD4444;     /* Ошибка */
--color-info: #4488DD;      /* Информация */
```

### UI Element Colors
```css
--color-button-bg: #FFA500;        /* Кнопка фон */
--color-button-hover: #FF8C00;     /* Кнопка при наведении */
--color-button-pressed: #CC6600;   /* Кнопка нажата */
--color-button-disabled: #CCCCCC;  /* Кнопка отключена */

--color-card-bg: #F8F9FA;          /* Карточка */
--color-card-shadow: rgba(0,0,0,0.1);

--color-border: #DDDDDD;           /* Границы */
--color-border-light: #EEEEEE;     /* Лёгкие границы */
```

## Градиенты (для фонов)

### Landscape Gradients
```css
/* Лес */
--gradient-forest: linear-gradient(135deg, #66AA55 0%, #88DD77 100%);

/* Лёд */
--gradient-ice: linear-gradient(135deg, #88CCEE 0%, #AADDFF 100%);

/* Город */
--gradient-city: linear-gradient(135deg, #FF9933 0%, #FFCC66 100%);

/* Радуга */
--gradient-rainbow: linear-gradient(90deg, #FF4444, #FF9933, #FFFF44, #44DD44, #4488DD, #9944DD);

/* Горы */
--gradient-mountains: linear-gradient(135deg, #AA8855 0%, #DD9966 100%);
```

## Shadow System (Тени для глубины)

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.15);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.2);

/* Для карточек */
--shadow-card: 0 4px 12px rgba(0, 0, 0, 0.1);

/* Для UI поверх игры */
--shadow-ui: 0 2px 8px rgba(0, 0, 0, 0.12);
```

## Typography

### Font Families
```css
--font-primary: "Segoe UI", "Roboto", sans-serif;      /* Основной шрифт */
--font-heading: "Arial Rounded MT Bold", sans-serif;   /* Заголовки (мягкий стиль) */
--font-mono: "Courier New", monospace;                 /* Моноширинный */
```

### Font Sizes (для детей)
```css
--fs-xs: 12px;     /* Мелкий текст */
--fs-sm: 14px;     /* Маленький */
--fs-base: 16px;   /* Основной */
--fs-lg: 20px;     /* Большой */
--fs-xl: 24px;     /* Очень большой */
--fs-2xl: 32px;    /* Заголовок 1 */
--fs-3xl: 48px;    /* Заголовок большой */
```

### Font Weights
```css
--fw-light: 300;
--fw-normal: 400;
--fw-semibold: 600;
--fw-bold: 700;
```

## Border Radius (Мягкие углы)

```css
--br-none: 0px;
--br-sm: 4px;
--br-md: 8px;
--br-lg: 12px;
--br-xl: 16px;
--br-2xl: 24px;
--br-full: 9999px;  /* Полный круг для иконок */
```

## Spacing Scale (Отступы)

```css
--space-0: 0px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

## Responsive Breakpoints

```css
--breakpoint-xs: 320px;    /* Mobile */
--breakpoint-sm: 480px;    /* Mobile landscape */
--breakpoint-md: 768px;    /* Tablet */
--breakpoint-lg: 1024px;   /* Tablet landscape / small desktop */
--breakpoint-xl: 1280px;   /* Desktop */
--breakpoint-2xl: 1536px;  /* Large desktop */
```

## Анимации

### Transition Times
```css
--transition-fast: 150ms;
--transition-base: 300ms;
--transition-slow: 500ms;

--easing-ease-in: cubic-bezier(0.4, 0, 1, 1);
--easing-ease-out: cubic-bezier(0, 0, 0.2, 1);
--easing-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--easing-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

## CSS Variables (для использования в коде)

```css
:root {
  /* Colors */
  --primary-warm: #FFA500;
  --primary-red: #FF4444;
  --primary-blue: #4488DD;
  --primary-green: #44BB77;
  
  --secondary-yellow: #FFD700;
  --secondary-purple: #9966DD;
  
  --bg-light: #F8F9FA;
  --text-primary: #1A1A1A;
  --text-secondary: #666666;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  
  /* Spacing */
  --space-unit: 4px;
  
  /* Transitions */
  --transition: all 300ms ease-out;
}

/* Dark mode (опционально) */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-light: #1A1A1A;
    --text-primary: #F8F9FA;
    --text-secondary: #BBBBBB;
  }
}
```

## Правила использования

1. **Для текста**: Используй `--text-primary` на `--bg-light`
2. **Для кнопок**: `--primary-warm` фон + `--text-light` текст
3. **Для карточек**: `--bg-light` с `--shadow-md`
4. **Для фокуса**: Используй `--primary-red` или `--primary-blue`
5. **Для успеха**: `--primary-green` или `--secondary-yellow`
6. **Для привлечения внимания**: `--primary-red` + `--shadow-lg`

## Казахские элементы в дизайне

### Орнаменты
- Используй `--primary-blue` + `--primary-red` для казахских паттернов
- Орнаменты как тонкие линии (1-2px) на фонах

### Символизм цветов
- Красный = жизнь, энергия (используется для Барсика)
- Синий = небо, степь (казахский колорит)
- Жёлтый = солнце, достаток (для звёзд дружбы)
- Зелёный = природа, рост

## Примеры компонентов

### Кнопка
```css
.button {
  background-color: var(--primary-warm);  /* #FFA500 */
  color: var(--text-light);               /* белый */
  padding: var(--space-4) var(--space-6); /* 16px 24px */
  border-radius: var(--br-lg);            /* 12px */
  border: none;
  cursor: pointer;
  transition: var(--transition);
  font-weight: var(--fw-semibold);
}

.button:hover {
  background-color: #FF8C00;
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Карточка
```css
.card {
  background-color: var(--bg-light);      /* #F8F9FA */
  border-radius: var(--br-xl);            /* 16px */
  padding: var(--space-6);                /* 24px */
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-light);
}
```

---

**Версия**: 1.0  
**Последнее обновление**: 2026-08-04  
**Автор**: Claude для BARSIK Project
